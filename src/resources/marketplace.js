import Ajv from 'ajv'
import ajvEnableMerge from 'ajv-merge-patch/keywords/merge'
import listingSchema from '../schemas/listing.json'
import unitListingSchema from '../schemas/unit-listing.json'
import unitPurchaseSchema from '../schemas/unit-purchase.json'
import fractionalListingSchema from '../schemas/fractional-listing.json'
import fractionalPurchaseSchema from '../schemas/fractional-purchase.json'
import reviewSchema from '../schemas/review.json'

import { generateListingId, generateOfferId } from '../utils/id'

const unitListingType = 'unit'
const fractionalListingType = 'fractional'

const validListingTypes = [unitListingType, fractionalListingType]

const unitListingSchemaId = 'unit-listing.json'
const fractionalListingSchemaId = 'fractional-listing.json'

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
const validateFractionalListing = ajv.getSchema(fractionalListingSchemaId)

function validate(validateFn, schema, data) {
  if (!validateFn(data)) {
    throw new Error(
      `Data invalid for schema. Data: ${JSON.stringify(
        data
      )}. Schema: ${JSON.stringify(schema)}`
    )
  }
}

import Adaptable from './adaptable'

class Marketplace extends Adaptable {
  constructor({ contractService, ipfsService, fetch, indexingServerUrl }) {
    super(...arguments)
    this.contractService = contractService
    this.ipfsService = ipfsService
    this.indexingServerUrl = indexingServerUrl
    this.fetch = fetch
  }

  async getListingsCount() {
    let total = 0
    for (const version of this.versions) {
      total += await this.adapters[version].getListingsCount()
    }
    return total
  }

  async getListings(opts = {}) {
    const network = await this.contractService.web3.eth.net.getId()
    const listingIds = []
    console.log(opts)
    for (const version of this.versions) {
      const listingIndexes = await this.adapters[version].getListings(opts)
      listingIndexes.forEach(listingIndex => {
        listingIds.unshift(generateListingId({ version, network, listingIndex }))
      })
    }

    if (opts.idsOnly) {
      return listingIds
    }

    // TODO: return full listings with data
    return listingIds
  }

  async getListing(listingId) {
    const { adapter, listingIndex } = this.parseAdaptableId(listingId)
    const listing = await adapter.getListing(listingIndex)

    const ipfsHash = this.contractService.getIpfsHashFromBytes32(listing.ipfsHash)
    const ipfsJson = await this.ipfsService.getFile(ipfsHash)

    return Object.assign({}, listing, { ipfsData: ipfsJson || {} })
  }
  // async getOffersCount(listingId) {}
  // async getOffer(listingId, offerId) {}
  async getOffers(listingId, opts) {
    const network = await this.contractService.web3.eth.net.getId()
    const { adapter, listingIndex, version } = this.parseAdaptableId(listingId)
    const offers = await adapter.getOffers(listingIndex, opts)
    return offers.map(offerIndex => {
      return generateOfferId({ network, version, listingIndex, offerIndex })
    })
  }

  async createListing(ipfsData) {

    if (!ipfsData.listingType) {
      console.warn('Please specify a listing type. Assuming unit listing type.')
    } else if (!validListingTypes.includes(ipfsData.listingType)) {
      console.error(
        'Listing type ${ipfsData.listingType} is invalid. Assuming unit listing type.'
      )
    }

    if (!ipfsData.unitsAvailable) {
      ipfsData.unitsAvailable = 1
    }
    if (!ipfsData.priceWei && ipfsData.price) {
      ipfsData.priceWei = this.contractService.web3.utils.toWei(String(ipfsData.price), 'ether')
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

    const ipfsHash = await this.ipfsService.submitFile({ data: ipfsData })
    const ipfsBytes = this.contractService.getBytes32FromIpfsHash(ipfsHash)

    return await this.currentAdapter.createListing(ipfsBytes, ipfsData)
  }

  // updateListing(listingId, data) {}
  // withdrawListing(listingId, data) {}

  async makeOffer(listingId, data) {
    const { adapter, listingIndex } = this.parseAdaptableId(listingId)

    data.price = this.contractService.web3.utils.toWei(String(data.price), 'ether')

    const ipfsHash = await this.ipfsService.submitFile({ data })
    const ipfsBytes = this.contractService.getBytes32FromIpfsHash(ipfsHash)

    return await adapter.makeOffer(listingIndex, ipfsBytes, data)
  }

  // updateOffer(listingId, offerId, data) {}
  // withdrawOffer(listingId, offerId, data) {}
  //
  // acceptOffer(listingId, offerId, data) {}
  // finalizeOffer(listingId, offerId, data) {}
  // setOfferRefund(listingId, offerId, data) {}
  //
  // initiateDispute(listingId, offerId) {}
  // disputeRuling(listingId, offerId, data) {}
  // manageListingDeposit(listingId, data) {}
  //
  // addData(data, listingId, offerId) {}

}

module.exports = Marketplace