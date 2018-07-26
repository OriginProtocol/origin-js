// For now, we are just wrapping the methods that are already in
// contractService and ipfsService.

import Ajv from 'ajv'
import ajvEnableMerge from 'ajv-merge-patch/keywords/merge'
import listingSchema from '../../schemas/listing.json'
import unitListingSchema from '../../schemas/unit-listing.json'
import fractionalListingSchema from '../../schemas/fractional-listing.json'

const unitListingType = 'unit'
const fractionalListingType = 'fractional'

const unitSchemaId = 'unit-listing.json'
const fractionalSchemaId = 'fractional-listing.json'

const ajv = new Ajv({
  schemas: [listingSchema, unitListingSchema, fractionalListingSchema]
})
ajvEnableMerge(ajv)

const validateUnitListing = ajv.getSchema(unitSchemaId)
const validateFractionalListing = ajv.getSchema(fractionalSchemaId)

const purchaseStageNames = [
  'BUYER_REQUESTED',
  'BUYER_CANCELED',
  'SELLER_ACCEPTED',
  'SELLER_REJECTED',
  'BUYER_FINALIZED',
  'SELLER_FINALIZED'
]

function validate(validateFn, data, schema) {
  if (!validateFn(data)) {
    throw new Error(
      `Data invalid for schema. Data: ${JSON.stringify(
        data
      )}. Schema: ${JSON.stringify(schema)}`
    )
  }
}

class Listings {
  constructor({
    contractService,
    ipfsService,
    fetch,
    indexingServerUrl,
    purchases
  }) {
    this.contractService = contractService
    this.ipfsService = ipfsService
    this.contractDefinition = this.contractService.listingContract
    this.fetch = fetch
    this.indexingServerUrl = indexingServerUrl
    this.purchases = purchases
  }

  /*
      Public mehods
  */

  async get(listingIndex) {
    const v01_Listings = await this.contractService.deployed(
      this.contractService.v01_ListingsContract
    )
    const listing = await v01_Listings.methods.getListing(listingIndex).call()
    const ipfsData = await this.getIpfsData(listing._ipfsHash)
    return {
      ipfsData,
      seller: listing._seller,
      purchasesLength: listing._purchasesLength
    }
  }

  async create(ipfsData) {
    const ipfsHash = await this.ipfsService.submitFile(ipfsData)
    const transactionReceipt = await this.createBlockchainListing(ipfsHash)
    return transactionReceipt
  }

  async update(listingIndex, ipfsData = {}) {
    // Submit to IPFS
    const ipfsHash = await this.ipfsService.submitFile(ipfsData)

    // Submit to ETH contract
    const account = await this.contractService.currentAccount()
    const v01_Listings = await this.contractService.deployed(
      this.contractService.v01_ListingsContract
    )
    const version = await v01_Listings.methods.getListingVersion(listingIndex).call()
    const ipfsBytes32 = this.contractService.getBytes32FromIpfsHash(ipfsHash)

    return await this.contractService.contractFn(
      this.contractService.v01_ListingsContract,
      null,
      'updateListing',
      [listingIndex, version, ipfsBytes32],
      { from: account, gas: 4476768 }
    )
  }

  async requestPurchase(listingIndex, ifpsData, ethToPay) {
    // TODO: ethToPay should really be replaced by something that takes Wei.
    const value = this.contractService.web3.utils.toWei(
      String(ethToPay),
      'ether'
    )
    const ipfsHash = await this.ipfsService.submitFile(ifpsData)
    const ipfsBytes32 = this.contractService.getBytes32FromIpfsHash(ipfsHash)
    return await this.contractService.contractFn(
      this.contractService.v01_ListingsContract,
      null,
      'requestPurchase',
      [listingIndex, ipfsBytes32],
      {
        value: value,
        gas: 850000
      }
    )
  }

  async getPurchases(listingIndex) {
    const v01_Listings = await this.contractService.deployed(
      this.contractService.v01_ListingsContract
    )
    const purchasesLength = await v01_Listings.methods.purchasesLength(listingIndex).call()
    const indices = []
    for (let i = 0; i < purchasesLength; i++) {
      indices.push(i)
    }
    return await Promise.all(
      indices.map(async purchaseIndex => {
        return this.getPurchase(listingIndex, purchaseIndex)
      })
    )
  }

  async getPurchase(listingIndex, purchaseIndex) {
    const result = await this.contractService.contractFn(
      this.contractService.v01_ListingsContract,
      null,
      'getPurchase',
      [listingIndex, purchaseIndex],
      { gas: 850000 }
    )
    const ipfsData = await this.getPurchaseIpfsData(listingIndex, purchaseIndex)
    return {
      ipfsData,
      stage: purchaseStageNames[result._stage],
      buyer: result._buyer,
      escrowContract: result._escrowContract
    }
  }

  /*
      Private methods
  */

  async createBlockchainListing(ipfsListing) {
    const account = await this.contractService.currentAccount()
    return await this.contractService.contractFn(
      this.contractService.v01_ListingsContract,
      null,
      'createListing',
      [this.contractService.getBytes32FromIpfsHash(ipfsListing)],
      { from: account, gas: 4476768 }
    )
  }

  async getIpfsData(asBytes32) {
    const ipfsHash = this.contractService.getIpfsHashFromBytes32(asBytes32)
    return await this.ipfsService.getFile(ipfsHash)
  }

  async getPurchaseIpfsData(listingIndex, purchaseIndex) {
    const v01_ListingsContract = await this.contractService.deployed(
      this.contractService.v01_ListingsContract
    )
    const events = await new Promise((resolve) => {
      v01_ListingsContract.getPastEvents(
        'PurchaseChange',
        {
          fromBlock: 0,
          toBlock: 'latest',
          filter: { _listingIndex: listingIndex, _purchaseIndex: purchaseIndex }
        },
        (error, logs) => {
          resolve(logs)
        }
      )
    })
    if (!events || !events.length) {
      throw new Error('No matching events found!')
    }
    const latestEvent = events[events.length - 1]
    return await this.getIpfsData(latestEvent.returnValues._ipfsHash)
  }
}

module.exports = Listings
