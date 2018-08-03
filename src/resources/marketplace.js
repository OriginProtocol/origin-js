import Ajv from 'ajv'
import ajvEnableMerge from 'ajv-merge-patch/keywords/merge'
import listingSchema from '../schemas/listing.json'
import unitListingSchema from '../schemas/unit-listing.json'
import unitPurchaseSchema from '../schemas/unit-purchase.json'
import fractionalListingSchema from '../schemas/fractional-listing.json'
import fractionalPurchaseSchema from '../schemas/fractional-purchase.json'
import reviewSchema from '../schemas/review.json'

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
// import { generateListingId, parseListingId } from '../utils/id'

class Marketplace extends Adaptable {
  constructor({ contractService, ipfsService, fetch, indexingServerUrl }) {
    super(...arguments)
    this.contractService = contractService
    this.ipfsService = ipfsService
    this.indexingServerUrl = indexingServerUrl
    this.fetch = fetch
  }

  async getListingsCount() {
    return await this.currentAdapter.getListingsCount()
  }
  async getListings(opts) {}
  async getListing(listingId) {}
  async getOffersCount(listingId) {}
  async getOffers(listingId, opts) {}
  async getOffer(listingId, offerId) {}

  async createListing(ipfsData) {

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

    return await this.currentAdapter.createListing(ipfsHash, ipfsData)
  }

  updateListing(listingId, data) {}
  withdrawListing(listingId, data) {}

  makeOffer(listingId, data) {

  }
  
  updateOffer(listingId, offerId, data) {}
  withdrawOffer(listingId, offerId, data) {}

  acceptOffer(listingId, offerId, data) {}
  finalizeOffer(listingId, offerId, data) {}
  setOfferRefund(listingId, offerId, data) {}

  initiateDispute(listingId, offerId) {}
  disputeRuling(listingId, offerId, data) {}
  manageListingDeposit(listingId, data) {}

  addData(data, listingId, offerId) {}

}

module.exports = Marketplace
