// For now, we are just wrapping the methods that are already in
// contractService and ipfsService.

import ResourceBase from './_resource-base'
import Ajv from 'ajv'
import ajvEnableMerge from 'ajv-merge-patch/keywords/merge'
import listingSchema from '../schemas/listing.json'
import unitListingSchema from '../schemas/unit-listing.json'
import fractionalListingSchema from '../schemas/fractional-listing.json'

const unitListingType = 'unit'
const fractionalListingType = 'fractional'

const listingSchemaId = 'listing.json'
const unitSchemaId = 'unit-listing.json'
const fractionalSchemaId = 'fractional-listing.json'

let ajv = new Ajv({
  schemas: [
    listingSchema,
    unitListingSchema,
    fractionalListingSchema
  ]
})
ajvEnableMerge(ajv)

const validateListing = ajv.getSchema(listingSchemaId)
const validateUnitListing = ajv.getSchema(unitSchemaId)
const validateFractionalListing = ajv.getSchema(fractionalSchemaId)

const appendSlash = url => {
  return url.substr(-1) === '/' ? url : url + '/'
}

function validate(validateFn, data, schema) {
  if (!validateFn(data)) {
    throw new Error(`Data invalid for schema. Data: ${JSON.stringify(data)}. Schema: ${JSON.stringify(schema)}`)
  }
}

class Listings extends ResourceBase {
  constructor({ contractService, ipfsService, fetch, indexingServerUrl }) {
    super({ contractService, ipfsService })
    this.contractDefinition = this.contractService.unitListingContract
    this.fetch = fetch
    this.indexingServerUrl = indexingServerUrl
  }

  /*
      Public mehods
  */

  // fetches all listings (all data included)
  async all({ noIndex = false } = {}) {
    if (noIndex) {
      // TODO: fetch directly from blockchain when noIndex is true
    } else {
      return await this.allIndexed()
    }
  }

  async allIds() {
    const range = (start, count) =>
      Array.apply(0, Array(count)).map((element, index) => index + start)

    let instance
    try {
      instance = await this.contractService.deployed(
        this.contractService.listingsRegistryContract
      )
    } catch (error) {
      console.log('Contract not deployed')
      throw error
    }

    // Get total number of listings
    let listingsLength
    try {
      listingsLength = await instance.methods.listingsLength().call()
    } catch (error) {
      console.log(error)
      console.log("Can't get number of listings.")
      throw error
    }

    return range(0, Number(listingsLength))
  }

  async allAddresses() {
    const contract = this.contractService.listingsRegistryContract
    const deployed = await this.contractService.deployed(contract)
    const events = await deployed.getPastEvents('NewListing', {
      fromBlock: 0,
      toBlock: 'latest'
    })
    return events.map(({ returnValues }) => {
      return returnValues['_address']
    })
  }

  async get(address) {
    const contractData = await this.contractFn(address, 'data')
    const ipfsHash = this.contractService.getIpfsHashFromBytes32(
      contractData[1]
    )
    const ipfsData = await this.ipfsService.getFile(ipfsHash)
    const hasIpfsData = ipfsData && ipfsData.data

    const listing = {
      address: address,
      ipfsHash: ipfsHash,
      sellerAddress: contractData[0],
      priceWei: contractData[2].toString(),
      price: this.contractService.web3.utils.fromWei(contractData[2], 'ether'),
      unitsAvailable: contractData[3],
      created: contractData[4],
      expiration: contractData[5],

      name: hasIpfsData ? ipfsData.data.name : null,
      category: hasIpfsData ? ipfsData.data.category : null,
      description: hasIpfsData ? ipfsData.data.description : null,
      location: hasIpfsData ? ipfsData.data.location : null,
      pictures: hasIpfsData ? ipfsData.data.pictures : null,
      listingType: hasIpfsData ? ipfsData.data.listingType : unitListingType
    }

    return listing
  }

  // This method is DEPRCIATED
  async getByIndex(listingIndex) {
    const contractData = await this.getListing(listingIndex)
    const ipfsData = await this.ipfsService.getFile(contractData.ipfsHash)
    // ipfsService should have already checked the contents match the hash,
    // and that the signature validates

    // We explicitly set these fields to white list the allowed fields.
    const listing = {
      name: ipfsData.data.name,
      category: ipfsData.data.category,
      description: ipfsData.data.description,
      location: ipfsData.data.location,
      pictures: ipfsData.data.pictures,
      listingType: ipfsData.data.listingType || unitListingType,

      address: contractData.address,
      index: contractData.index,
      ipfsHash: contractData.ipfsHash,
      sellerAddress: contractData.lister,
      price: Number(contractData.price),
      unitsAvailable: Number(contractData.unitsAvailable)
    }

    return listing
  }

  async create(data, schemaType) {
    const listingType = data.listingType || unitListingType
    data.listingType = listingType // in case it wasn't set
    if (listingType === unitListingType) {
      return await this.createUnit(data, schemaType)
    } else if (listingType === fractionalListingType) {
      return await this.createFractional(data)
    }
  }

  async buy(address, unitsToBuy, ethToPay) {
    // TODO: ethToPay should really be replaced by something that takes Wei.
    const value = this.contractService.web3.utils.toWei(
      String(ethToPay),
      'ether'
    )
    return await this.contractFn(address, 'buyListing', [unitsToBuy], {
      value: value,
      gas: 850000
    })
  }

  async close(address) {
    return await this.contractFn(address, 'close')
  }

  async purchasesLength(address) {
    return Number(await this.contractFn(address, 'purchasesLength'))
  }

  async purchaseAddressByIndex(address, index) {
    return await this.contractFn(address, 'getPurchase', [index])
  }

  /*
      Private methods
  */

  async createUnit(data, schemaType) {
    validate(validateUnitListing, data, unitListingSchema)

    const formListing = { formData: data }

    // TODO: Why can't we take schematype from the formListing object?
    const jsonBlob = {
      schema: `http://localhost:3000/schemas/${schemaType}.json`,
      data: formListing.formData
    }

    let ipfsHash
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
    let transactionReceipt
    try {
      transactionReceipt = await this.submitUnitListing(
        ipfsHash,
        formListing.formData.price,
        units
      )
    } catch (error) {
      console.error(error)
      throw new Error(`ETH Failure: ${error}`)
    }

    // Success!
    console.log(
      `Submitted to ETH blockchain with transactionReceipt.tx: ${
        transactionReceipt.tx
      }`
    )
    return transactionReceipt
  }

  async createFractional(data) {
    validate(validateFractionalListing, data, fractionalListingSchema)
    const json = { data }

    // Submit to IPFS
    let ipfsHash
    try {
      ipfsHash = await this.ipfsService.submitFile(json)
    } catch (error) {
      throw new Error(`IPFS Failure: ${error}`)
    }

    // Submit to ETH contract
    let transactionReceipt
    try {
      transactionReceipt = await this.submitFractionalListing(ipfsHash)
    } catch (error) {
      console.error(error)
      throw new Error(`ETH Failure: ${error}`)
    }

    return transactionReceipt
  }

  async submitUnitListing(ipfsListing, ethPrice, units) {
    try {
      const account = await this.contractService.currentAccount()
      const instance = await this.contractService.deployed(
        this.contractService.listingsRegistryContract
      )

      const weiToGive = this.contractService.web3.utils.toWei(
        String(ethPrice),
        'ether'
      )
      // Note we cannot get the listingId returned by our contract.
      // See: https://forum.ethereum.org/discussion/comment/31529/#Comment_31529
      return instance.methods
        .create(
          this.contractService.getBytes32FromIpfsHash(ipfsListing),
          weiToGive,
          units
        )
        .send({ from: account, gas: 4476768 })
    } catch (error) {
      console.error('Error submitting to the Ethereum blockchain: ' + error)
      throw error
    }
  }

  async submitFractionalListing(ipfsListing) {
    try {
      const account = await this.contractService.currentAccount()
      const instance = await this.contractService.deployed(
        this.contractService.listingsRegistryContract
      )

      return instance.methods
        .createFractional(
          this.contractService.getBytes32FromIpfsHash(ipfsListing)
        )
        .send({ from: account, gas: 4476768 })
    } catch (error) {
      console.error('Error submitting to the Ethereum blockchain: ' + error)
      throw error
    }
  }

  async getListing(listingId) {
    const instance = await this.contractService.deployed(
      this.contractService.listingsRegistryContract
    )

    let listing
    try {
      listing = await instance.methods.getListing(listingId).call()
    } catch (error) {
      console.log('Error fetching listingId: ' + listingId)
      throw error
    }

    // Listing is returned as array of properties.
    // IPFS hash (as bytes32 hex string) is in results[2]
    // Convert it to regular IPFS base-58 encoded hash
    // Address of Listing contract is in: listing[0]
    const listingObject = {
      index: listingId,
      address: listing[0],
      lister: listing[1],
      ipfsHash: this.contractService.getIpfsHashFromBytes32(listing[2]),
      price: this.contractService.web3.utils.fromWei(listing[3], 'ether'),
      unitsAvailable: listing[4]
    }
    return listingObject
  }

  async allIndexed() {
    const url = appendSlash(this.indexingServerUrl) + 'listing'
    const response = await this.fetch(url, { method: 'GET' })
    const json = await response.json()
    return json.objects.map(obj => {
      const ipfsData = obj['ipfs_data']
      return {
        address: obj['contract_address'],
        ipfsHash: obj['ipfs_hash'],
        sellerAddress: obj['owner_address'],
        price: obj['price'],
        unitsAvailable: obj['units'],
        created: obj['created_at'],
        expiration: obj['expires_at'],

        name: ipfsData ? ipfsData['name'] : null,
        category: ipfsData ? ipfsData['category'] : null,
        description: ipfsData ? ipfsData['description'] : null,
        location: ipfsData ? ipfsData['location'] : null,
        pictures: ipfsData ? ipfsData['pictures'] : null,
        listingType: ipfsData ? ipfsData['listingType'] : unitListingType
      }
    })
  }
}

module.exports = Listings
