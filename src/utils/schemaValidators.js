import Ajv from 'ajv'
import listingCoreSchema from '../schemas/listing-core.json'
import unitPurchaseSchema from '../schemas/unit-purchase.json'
import fractionalPurchaseSchema from '../schemas/fractional-purchase.json'
import reviewSchema from '../schemas/review.json'

const coreListingSchemaId = 'listing-core.json'

const ajv = new Ajv({allErrors: true})
// To use the draft-06 JSON schema, we need to explicitly add it to ajv.
ajv.addMetaSchema(require('ajv/lib/refs/json-schema-draft-06.json'))
ajv.addSchema([
  listingCoreSchema,
  unitPurchaseSchema,
  fractionalPurchaseSchema,
  reviewSchema,
])

const listingValidator = ajv.getSchema(coreListingSchemaId)

/**
 * Validate a listing object against the core listing schema.
 * @param {object} listingData - Listing object to validate. This is typically data read from IPFS.
 * @throws {Error}
 */
export function validateListing(listingData) {
  /*
  TODO(FRANCK:: decide to keep this or not.

    if (!ipfsData.unitsAvailable) {
    ipfsData.unitsAvailable = 1
  }
  if (!ipfsData.priceWei && ipfsData.price) {
    ipfsData.priceWei = contractService.web3.utils.toWei(
      String(ipfsData.price),
      'ether'
    )
  }
   */
  const valid = listingValidator(listingData)
  if (!valid) {
    throw new Error(
      `Invalid listing data.
      Listing: ${JSON.stringify(listingData)}.
      Schema: ${JSON.stringify(listingCoreSchema)}
      Errors: ${JSON.stringify(listingValidator.errors)}`
    )
  }
}

