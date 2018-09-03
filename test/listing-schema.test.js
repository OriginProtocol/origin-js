import { expect } from 'chai'
import {validateListing} from '../src/utils/schemaValidators.js'

import validListing from './data/listing-valid.json'
import listingCoreSchema from '../src/schemas/listing-core.json'

describe('Listing schema validation', () => {

  it(`Valid listing should validate`, () => {
    expect(() => {validateListing(validListing)}).to.not.throw()
  })

  for (const fieldName of listingCoreSchema.required) {
    it(`Listing with missing required ${fieldName} should not validate`, () => {
      const badListing = Object.assign({}, validListing)
      // Remove a field from the listing.
      delete badListing[fieldName]
      // Listing should fail validation.
      expect(() => {validateListing(badListing)}).to.throw()
    })
  }

})
