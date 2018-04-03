import userSchema from '../schemas/user.json'

var Ajv = require('ajv')
var ajv = new Ajv()

async function create(data) {
  let validate = ajv.compile(userSchema)
  if (!validate(data)) {
    throw new Error('invalid user data')
  } else {
    // Submit to IPFS
    let ipfsHash = await this.origin.ipfsService.submitFile(data)

    // Submit to ETH contract
    let txReceipt = await this.origin.contractService.setUser(ipfsHash)
    return txReceipt
  }
}

async function get(address) {
  let userIpfsHash = await this.origin.contractService.getUser(address)
  let userJson = await this.origin.ipfsService.getFile(userIpfsHash)
  return userJson
}

module.exports = {
  create,
  get
}
