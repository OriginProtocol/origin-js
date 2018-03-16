import contractService from './contract-service'
import ipfsService from './ipfs-service'
import userSchema from './schemas/user.json'

var Ajv = require('ajv')
var ajv = new Ajv()

var ethereumjsUtil = require('ethereumjs-util')

class OriginService {
  constructor({ contractService, ipfsService }) {
    this.contractService = contractService;
    this.ipfsService = ipfsService;
  }

  async submitListing(formListing, selectedSchemaType) {

    // TODO: Why can't we take schematype from the formListing object?
    const jsonBlob = {
      'schema': `http://localhost:3000/schemas/${selectedSchemaType}.json`,
      'data': formListing.formData,
    }

    let ipfsHash;
    try {
      // Submit to IPFS
      ipfsHash = await this.ipfsService.submitFile(jsonBlob)
    } catch (error) {
      throw new Error(`IPFS Failure: ${error}`)
    }

    console.log(`IPFS file created with hash: ${ipfsHash} for data:`)
    console.log(jsonBlob)

    // Submit to ETH contract
    const units = 1 // TODO: Allow users to set number of units in form
    let transactionReceipt;
    try {
      transactionReceipt = await this.contractService.submitListing(
        ipfsHash,
        formListing.formData.price,
        units)
    } catch (error) {
      console.error(error)
      throw new Error(`ETH Failure: ${error}`);
    }

    // Success!
    console.log(`Submitted to ETH blockchain with transactionReceipt.tx: ${transactionReceipt.tx}`)
    return transactionReceipt

  }

  setUser(data) {
    return new Promise((resolve, reject) => {
      var validate = ajv.compile(userSchema)
      if (!validate(data)) {
        reject('invalid user data')
      } else {
        // Submit to IPFS
        this.ipfsService.submitFile(data)
        .then((ipfsHash) => {
          console.log(`IPFS file created with hash: ${ipfsHash} for data:`)
          console.log(data)

          // Submit to ETH contract
          this.contractService.setUser(
            ipfsHash)
          .then((transactionReceipt) => {
            // Success!
            console.log(`Submitted to ETH blockchain with transactionReceipt.tx: ${transactionReceipt.tx}`)
            resolve(transactionReceipt.tx)
          })
          .catch((error) => {
            console.error(error)
            reject(`ETH Failure: ${error}`)
          })
        })
        .catch((error) => {
          reject(`IPFS Failure: ${error}`)
        })
      }
    })
  }

  generateSignedMessage(message) {
    let hashedMessage = window.web3.sha3(message)
    return new Promise((resolve, reject) => {
      window.web3.eth.getAccounts((error, accounts) => {
        if (error) {
          reject(error)
        }
        window.web3.eth.sign(accounts[0], hashedMessage, (error, signedMessage) => {
          if (error) {
            reject(error)
          }
          resolve(signedMessage)
        })
      })
    })
  }

  verifySignedMessage(message, address, signature) {
    // web3 will release signature verification in v1.0. For now we have to do it this way.
    let r = ethereumjsUtil.toBuffer('0x' + signature.slice(2, 66))
    let s = ethereumjsUtil.toBuffer('0x' + signature.slice(66, 130))
    let v = window.web3.toDecimal('0x' + signature.slice(130, 132))
    let hashedMessage = ethereumjsUtil.toBuffer(window.web3.sha3(message))
    let pub = ethereumjsUtil.ecrecover(hashedMessage, v, r, s)
    let addressFromSignature = '0x' + ethereumjsUtil.pubToAddress(pub).toString('hex')
    return addressFromSignature === address
  }
}

export default OriginService
