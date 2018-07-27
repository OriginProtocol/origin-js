import Ajv from 'ajv'
import ajvEnableMerge from 'ajv-merge-patch/keywords/merge'
import listingSchema from '../../schemas/listing.json'
import unitListingSchema from '../../schemas/unit-listing.json'
import fractionalListingSchema from '../../schemas/fractional-listing.json'
import {
  createBlockchainListing,
  getIpfsData,
  getPurchase as getPurchaseHelper,
  getPurchaseLogs as getPurchaseLogsHelper,
  purchaseStageNames
} from './helpers'

const listingsContract = 'v01_ListingsContract'

const unitListingType = 'unit'
const fractionalListingType = 'fractional'

const validListingTypes = [unitListingType, fractionalListingType]

const unitSchemaId = 'unit-listing.json'
const fractionalSchemaId = 'fractional-listing.json'

const ajv = new Ajv({
  schemas: [listingSchema, unitListingSchema, fractionalListingSchema]
})
ajvEnableMerge(ajv)

const validateUnitListing = ajv.getSchema(unitSchemaId)
const validateFractionalListing = ajv.getSchema(fractionalSchemaId)

const schemaFor = {
  unit: unitListingSchema,
  fractional: fractionalListingSchema
}
const validateFor = {
  unit: validateUnitListing,
  fractional: validateFractionalListing
}

function validate(listingType, data) {
  const schema = schemaFor[listingType]
  const validateFn = validateFor[listingType]
  if (!validateFn(data)) {
    throw new Error(
      `Data invalid for schema. Data: ${JSON.stringify(
        data
      )}. Schema: ${JSON.stringify(schema)}`
    )
  }
}

class ListingsAdapter {
  constructor({
    contractService,
    ipfsService,
    fetch,
    indexingServerUrl,
    purchases
  }) {
    this.contractService = contractService
    this.ipfsService = ipfsService
    this.fetch = fetch
    this.indexingServerUrl = indexingServerUrl
    this.purchases = purchases
  }

  async get(listingIndex) {
    const listing = await this.contractService.call(
      listingsContract,
      'getListing',
      [listingIndex]
    )
    const ipfsData = await getIpfsData(this.contractService, this.ipfsService, listing._ipfsHash)
    return {
      ipfsData,
      seller: listing._seller,
      purchasesLength: listing._purchasesLength
    }
  }

  async create(ipfsData) {
    if (!ipfsData.listingType) {
      console.warn('Please specify a listing type. Assuming unit listing type.')
    } else if (!validListingTypes.includes(ipfsData.listingType)) {
      console.error('Listing type ${ipfsData.listingType} is invalid. Assuming unit listing type.')
    }
    const listingType = ipfsData.listingType || unitListingType
    validate(listingType, ipfsData)
    const ipfsHash = await this.ipfsService.submitFile(ipfsData)
    const transactionReceipt = await createBlockchainListing(this.contractService, ipfsHash)
    return transactionReceipt
  }

  async update(listingIndex, ipfsData = {}) {
    // Submit to IPFS
    const ipfsHash = await this.ipfsService.submitFile(ipfsData)

    // Submit to ETH contract
    const account = await this.contractService.currentAccount()
    const version = await this.contractService.call(
      listingsContract,
      'getListingVersion',
      [listingIndex]
    )
    const ipfsBytes32 = this.contractService.getBytes32FromIpfsHash(ipfsHash)

    return await this.contractService.call(
      listingsContract,
      'updateListing',
      [listingIndex, version, ipfsBytes32],
      { from: account }
    )
  }

  async requestPurchase(listingIndex, ipfsData, offerWei) {
    const ipfsHash = await this.ipfsService.submitFile(ipfsData)
    const ipfsBytes32 = this.contractService.getBytes32FromIpfsHash(ipfsHash)
    return await this.contractService.call(
      listingsContract,
      'requestPurchase',
      [listingIndex, ipfsBytes32],
      { value: offerWei, gas: 350000 }
    )
  }

  async acceptPurchaseRequest(listingIndex, purchaseIndex, ipfsData, confirmationCallback) {
    const ipfsHash = await this.ipfsService.submitFile(ipfsData)
    const ipfsBytes32 = this.contractService.getBytes32FromIpfsHash(ipfsHash)
    return await this.contractService.call(
      listingsContract,
      'acceptPurchaseRequest',
      [listingIndex, purchaseIndex, ipfsBytes32],
      {},
      confirmationCallback
    )
  }

  async rejectPurchaseRequest(listingIndex, purchaseIndex, ipfsData, confirmationCallback) {
    const ipfsHash = await this.ipfsService.submitFile(ipfsData)
    const ipfsBytes32 = this.contractService.getBytes32FromIpfsHash(ipfsHash)
    return await this.contractService.call(
      listingsContract,
      'rejectPurchaseRequest',
      [listingIndex, purchaseIndex, ipfsBytes32],
      {},
      confirmationCallback
    )
  }

  async buyerFinalizePurchase(listingIndex, purchaseIndex, ipfsData, confirmationCallback) {
    const ipfsHash = await this.ipfsService.submitFile(ipfsData)
    const ipfsBytes32 = this.contractService.getBytes32FromIpfsHash(ipfsHash)
    return await this.contractService.call(
      listingsContract,
      'buyerFinalizePurchase',
      [listingIndex, purchaseIndex, ipfsBytes32],
      {},
      confirmationCallback
    )
  }

  async sellerFinalizePurchase(listingIndex, purchaseIndex, ipfsData, confirmationCallback) {
    const ipfsHash = await this.ipfsService.submitFile(ipfsData)
    const ipfsBytes32 = this.contractService.getBytes32FromIpfsHash(ipfsHash)
    return await this.contractService.call(
      listingsContract,
      'sellerFinalizePurchase',
      [listingIndex, purchaseIndex, ipfsBytes32],
      {},
      confirmationCallback
    )
  }

  async getPurchase(listingIndex, purchaseIndex) {
    return await getPurchaseHelper(this.contractService, this.ipfsService, listingIndex, purchaseIndex)
  }

  async getPurchases(listingIndex) {
    const purchasesLength = await this.contractService.call(
      listingsContract,
      'purchasesLength',
      [listingIndex]
    )
    const indices = []
    for (let i = 0; i < purchasesLength; i++) {
      indices.push(i)
    }
    return await Promise.all(
      indices.map(async purchaseIndex => {
        return getPurchaseHelper(this.contractService, this.ipfsService, listingIndex, purchaseIndex)
      })
    )
  }

  async getPurchaseLogs(listingIndex, purchaseIndex) {
    const events = await getPurchaseLogsHelper(
      this.contractService,
      listingIndex,
      purchaseIndex
    )
    const mapped = events.map(log => {
      const stageNumber = Number(log.returnValues._stage)
      const stage = purchaseStageNames[stageNumber]
      return {
        transactionHash: log.transactionHash,
        stage: stage,
        blockNumber: log.blockNumber,
        blockHash: log.blockHash,
        event: log.event
      }
    })
    // Fetch user and timestamp information for all logs, in parallel
    const addUserAddressFn = async event => {
      event.from = (await this.contractService.getTransaction(
        event.transactionHash
      )).from
    }
    const addTimestampFn = async event => {
      event.timestamp = (await this.contractService.getBlock(
        event.blockHash
      )).timestamp
    }
    const fetchPromises = [].concat(
      mapped.map(addUserAddressFn),
      mapped.map(addTimestampFn)
    )
    await Promise.all(fetchPromises)
    return mapped
  }
}

module.exports = ListingsAdapter
