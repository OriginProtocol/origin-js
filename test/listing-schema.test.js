import Ajv from 'ajv'
import { expect } from 'chai'

import listingCoreSchema from '../src/schemas/listing-core.json'
import validListing from './data/listing-valid.json'

import {validateListing} from '../src/utils/schemaValidators.js'

describe('ListingSchema', () => {

  let listingValidator

  before( () => {

    const ajv = new Ajv({allErrors: true})
    // To use Ajv with draft-06 schema we need to explicitly add it.
    ajv.addMetaSchema(require('ajv/lib/refs/json-schema-draft-06.json'))
    listingValidator = ajv.compile(listingCoreSchema)
  })

  describe('Listing schema validation', () => {
    it(`Valid listing should validate`, () => {
      const valid = listingValidator(validListing)
      expect(valid, JSON.stringify(listingValidator.errors, null, 2)).to.be.true
    })

    for (const fieldName of listingCoreSchema.required) {
      it(`Listing with missing required ${fieldName} should not validate`, () => {
        const badListing = Object.assign({}, validListing)
        // Remove a field from the listing.
        delete badListing[fieldName]
        const valid = listingValidator(badListing)
        // Listing should fail validation.
        expect(valid).to.be.false
      })
    }

  })

})

describe('Util validator', () => {
  it(`Should validate`, () => {
    validateListing(validListing)
  })
})