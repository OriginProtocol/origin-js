import Ajv from 'ajv'
import ajvEnableMerge from 'ajv-merge-patch/keywords/merge'
import listingSchema from '../../schemas/listing.json'
import unitListingSchema from '../../schemas/unit-listing.json'
import unitPurchaseSchema from '../../schemas/unit-purchase.json'
import fractionalListingSchema from '../../schemas/fractional-listing.json'
import fractionalPurchaseSchema from '../../schemas/fractional-purchase.json'
import reviewSchema from '../../schemas/review.json'
import {
  createBlockchainListing,
  getIpfsData,
  getPurchase as getPurchaseHelper,
  getPurchaseLogs as getPurchaseLogsHelper,
  purchaseStageNames,
  weiToEth
} from './helpers'

const listingsContract = 'v01_ListingsContract'

const unitListingType = 'unit'
const fractionalListingType = 'fractional'

const validListingTypes = [unitListingType, fractionalListingType]

const unitListingSchemaId = 'unit-listing.json'
const fractionalListingSchemaId = 'fractional-listing.json'
const unitPurchaseSchemaId = 'unit-purchase.json'
const fractionalPurchaseSchemaId = 'fractional-purchase.json'
const reviewSchemaId = 'review.json'

const buyerReviewStage = 4
const sellerReviewStage = 5
const reviewStages = [buyerReviewStage, sellerReviewStage]
const emptyIpfsHash =
  '0x0000000000000000000000000000000000000000000000000000000000000000'

const ajv = new Ajv({
  schemas: [
    listingSchema,
    unitListingSchema,
    unitPurchaseSchema,
    fractionalListingSchema,
    fractionalPurchaseSchema,
    reviewSchema
  ]
})
ajvEnableMerge(ajv)

const validateUnitListing = ajv.getSchema(unitListingSchemaId)
const validateUnitPurchase = ajv.getSchema(unitPurchaseSchemaId)
const validateFractionalListing = ajv.getSchema(fractionalListingSchemaId)
const validateFractionalPurchase = ajv.getSchema(fractionalPurchaseSchemaId)
const validateReview = ajv.getSchema(reviewSchemaId)

function validate(validateFn, schema, data) {
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
    const ipfsData = await getIpfsData(
      this.contractService,
      this.ipfsService,
      listing._ipfsHash
    )
    return {
      ipfsData,
      seller: listing._seller,
      purchasesLength: listing._purchasesLength,
      priceEth: weiToEth(this.contractService, ipfsData.priceWei)
    }
  }

  async create(ipfsData) {
    if (!ipfsData.listingType) {
      console.warn('Please specify a listing type. Assuming unit listing type.')
    } else if (!validListingTypes.includes(ipfsData.listingType)) {
      console.error(
        'Listing type ${ipfsData.listingType} is invalid. Assuming unit listing type.'
      )
    }
    const listingType = ipfsData.listingType || unitListingType
    let validateFn, schema
    if (listingType === unitListingType) {
      validateFn = validateUnitListing
      schema = unitListingSchema
    } else if (listingType === fractionalListingType) {
      validateFn = validateFractionalListing
      schema = fractionalListingSchema
    }
    validate(validateFn, schema, ipfsData)
    const ipfsHash = await this.ipfsService.submitFile(ipfsData)
    const transactionReceipt = await createBlockchainListing(
      this.contractService,
      ipfsHash
    )
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
    if (!ipfsData.purchaseType) {
      console.warn(
        'Please specify a purchase type. Assuming unit purchase type.'
      )
    } else if (!validListingTypes.includes(ipfsData.purchaseType)) {
      console.error(
        'Purchase type ${ipfsData.purchaseType} is invalid. Assuming unit purchase type.'
      )
    }
    const purchaseType = ipfsData.purchaseType || unitListingType
    let validateFn, schema
    if (purchaseType === unitListingType) {
      validateFn = validateUnitPurchase
      schema = unitPurchaseSchema
    } else if (purchaseType === fractionalListingType) {
      validateFn = validateFractionalPurchase
      schema = fractionalPurchaseSchema
    }
    validate(validateFn, schema, ipfsData)

    const ipfsHash = await this.ipfsService.submitFile(ipfsData)
    const ipfsBytes32 = this.contractService.getBytes32FromIpfsHash(ipfsHash)
    return await this.contractService.call(
      listingsContract,
      'requestPurchase',
      [listingIndex, ipfsBytes32],
      { value: offerWei, gas: 350000 }
    )
  }

  async acceptPurchaseRequest(
    listingIndex,
    purchaseIndex,
    ipfsData,
    confirmationCallback
  ) {
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

  async rejectPurchaseRequest(
    listingIndex,
    purchaseIndex,
    ipfsData,
    confirmationCallback
  ) {
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

  async buyerFinalizePurchase(
    listingIndex,
    purchaseIndex,
    ipfsData,
    confirmationCallback
  ) {
    validate(validateReview, reviewSchema, ipfsData)
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

  async sellerFinalizePurchase(
    listingIndex,
    purchaseIndex,
    ipfsData,
    confirmationCallback
  ) {
    validate(validateReview, reviewSchema, ipfsData)
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
    return await getPurchaseHelper(
      this.contractService,
      this.ipfsService,
      listingIndex,
      purchaseIndex
    )
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
        return getPurchaseHelper(
          this.contractService,
          this.ipfsService,
          listingIndex,
          purchaseIndex
        )
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

  async findReviewForPurchase(
    contractService,
    ipfsService,
    listingId,
    purchaseId
  ) {
    const v01_ListingsContract = await contractService.deployed(
      contractService.v01_ListingsContract
    )
    const logs = await new Promise((resolve, reject) => {
      v01_ListingsContract.getPastEvents(
        'PurchaseChange',
        {
          fromBlock: 0,
          toBlock: 'latest',
          filter: { _listingIndex: listingId, _purchaseIndex: purchaseId }
        },
        function(error, logs) {
          if (error) {
            reject(error)
          }
          resolve(logs)
        }
      )
    })
    const createItem = async log => {
      const asBytes32 = log.returnValues._ipfsHash
      const stage = log.returnValues._stage
      const ipfsHash = contractService.getIpfsHashFromBytes32(asBytes32)
      let ipfsData
      if (ipfsHash !== emptyIpfsHash) {
        ipfsData = await ipfsService.getFile(ipfsHash)
      }
      return { ipfsData, stage }
    }
    const itemsPromise = logs
      .filter(log => {
        return reviewStages.includes(Number(log.returnValues._stage))
      })
      .map(createItem)
    const items = await Promise.all(itemsPromise)
    const buyerReviewItems = items.filter(({ stage }) => {
      return Number(stage) === buyerReviewStage
    })
    const sellerReviewItems = items.filter(({ stage }) => {
      return Number(stage) === sellerReviewStage
    })
    const format = item => {
      return { ipfsData: item.ipfsData }
    }
    const fromBuyer = buyerReviewItems.length
      ? format(buyerReviewItems[0])
      : null
    const fromSeller = sellerReviewItems.length
      ? format(sellerReviewItems[0])
      : null
    return { fromBuyer, fromSeller }
  }
}

module.exports = ListingsAdapter
