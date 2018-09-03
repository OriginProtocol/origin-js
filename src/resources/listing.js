import Ajv from 'ajv'
import URL from 'url-parse'
import Money from '../utils/money'

import schemaV1 from '../schemas/listing-core.json'

const SCHEMA_V1 = '1.0.0'
const schemaIdV1 = 'http://schema.originprotocol.com/listing-core-v1.0.0'

const ajv = new Ajv({allErrors: true})
// To use the draft-06 JSON schema, we need to explicitly add it to ajv.
ajv.addMetaSchema(require('ajv/lib/refs/json-schema-draft-06.json'))
ajv.addSchema(schemaV1)


class Listing {
  /**
   * A Listing is constructed based on its on-chain and off-chain data.
   */
  constructor(chainListing, ipfsListing) {
    // FIXME(franck): Exposing directly the chain data will make it difficult
    // to support backward compatibility of the Listing interface in the future. We should
    // select and possibly abstract what data from the chain gets exposed.
    Object.assign(this, chainListing, ipfsListing)
  }

  get unitsSold() {
    // Lazy caching.
    if (this._unitsSold !== undefined) {
      return this._unitsSold
    }
    this._unitsSold = Object.keys(this.offers).reduce((acc, offerId) => {
      if (this.offers[offerId].status === 'created') {
        return acc + 1
      }
      // TODO: we need to subtract 1 for every offer that is canceled
      return acc
    }, 0)
    return this._unitsSold
  }

  get unitsAvailable() {
    // Units available is derived from units for sale and offers created.
    // Should never be negative.
    return Math.max(this.unitsForSale - this.unitsSold, 0)
  }

}

/**
 * Returns an adapter based on a schema version.
 * @param {string} schemaVersion
 * @returns {ListingSchemaAdapter}
 * @throws {Error}
 */
function schemaAdapterFactory(schemaVersion) {
  if (schemaVersion === SCHEMA_V1) {
    return SchemaAdapterV1
  } else {
    throw new Error(`Unsupported schema version ${schemaVersion}`)
  }
}

class SchemaAdapterV1 {
  /**
   * Validates the data is compliant with Origin Protocol core listing schema V1.
   * @param {object} data - Listing data to validate.
   * @throws {Error}
   */
  static validate(data) {
    if (data.schemaVersion !== SCHEMA_V1) {
      throw new Error(`Listing schema version ${data.schemaVersion} != ${SCHEMA_V1}`)
    }

    const validator = ajv.getSchema(schemaIdV1)
    if (!validator(data)) {
      throw new Error(
        `Invalid V1 listing data.
        Listing: ${JSON.stringify(data)}.
        Schema: ${JSON.stringify(schemaV1)}
        Validation errors: ${JSON.stringify(validator.errors)}`
      )
    }
  }

  /**
   * Populates an IpfsListing object from listing data that uses V1 schema.
   * @param {object} data - Listing data, expected to use schema V1.
   * @throws {Error}
   */
  static deserialize(data) {
    // Validate the data against the Origin Protocol V1 core listing schema.
    SchemaAdapterV1.validate(data)

    const listing = {
      schemaVersion:  data.schemaVersion,
      id:             data.listingId,
      type:           data.listingType,
      category:       data.category,
      subCategory:    data.subCategory,
      language:       data.language,
      title:          data.title,
      description:    data.description,
      media:          data.media,
      expiry:         data.expiry,
    }

    // Unit data.
    if (listing.type === 'unit') {
      listing.unitsForSale = data.unitsForSale
      listing.price = new Money(data.price)
      listing.commission = new Money(data.commission)
      listing.securityDeposit = new Money(data.securityDeposit)
    } else if (listing.type === 'fractional') {
      // TODO(franck): fill this in.
    }
    return listing
  }
}


class ListingIpfsStore {
  constructor(ipfsService) {
    this.ipfsService = ipfsService
  }

  /**
   * Helper method that rewrites the IPFS Url in the listing to point to the configured gateway.
   */
  _rewriteMediaUrls(media) {
    if (!media) {
      return
    }
    for (const medium of media) {
      medium.url = this.ipfsService.rewriteUrl(medium.url)
    }
  }

  /**
   * Helper method that uploads to IPFS binary data passed the URL of media object by the DApp.
   * @param media
   * @returns {Promise<[any , any , any , any , any , any , any , any , any , any]>}
   * @private
   */
  // Apply filtering to pictures and uploaded any data: URLs to IPFS
  async _saveMediaData(media) {
    if (!media) {
      return
    }
    const uploads = media
      .filter(medium => {
        try {
          // Only allow data:, dweb:, and ipfs: URLs
          return ['data:', 'dweb:', 'ipfs:'].includes(new URL(medium.url).protocol)
        } catch (error) {
          // Invalid URL, filter it out
          return false
        }
      })
      .map(async medium => {
        // Upload any data: URLs to IPFS
        // TODO possible removal and only accept dweb: and ipfs: URLS from dapps
        if (medium.url.startsWith('data:')) {
          const ipfsHash = await this.ipfsService.saveDataURIAsFile(medium.url)
          medium.url = `ipfs://${ipfsHash}`
        }
      })
    return Promise.all(uploads)
  }

  /**
   * Loads and validates listing data from IPFS.
   * @param {bytes} ipfsHash - Base58 encoded IPFS hash.
   * @returns {object} Listing data read from IPFS.
   * @throws {Error}
   */
  async load(ipfsHash) {
    // Fetch the data from IPFS.
    const data = await this.ipfsService.loadObjFromFile(ipfsHash)

    // Deserialize and validate the data into a Listing object.
    const adapter = schemaAdapterFactory(data.schemaVersion)
    const listing = adapter.deserialize(data)

    // Rewrite the IPFS URLs to point to configured IPFS gateway.
    this._rewriteMediaUrls(listing.media)

    // Decorate the listing with Ipfs data. Useful for troubleshooting purposes.
    listing.ipfs = {
      hash: ipfsHash,
      data: data
    }

    return listing
  }

  /**
   * Validates and saves listing data to IPFS.
   * @param {object} ipfsData - Object compliant with Origin Protocol core listing schema.
   * @returns {bytes} Base58 encoded IPFS Hash.
   */
  async save(ipfsData) {
    // Validate the listing's data against the schema.
    const adapter = schemaAdapterFactory(ipfsData.schemaVersion)
    adapter.validate(ipfsData)

    await this._saveMediaData(ipfsData.media)

    const ipfsHash = await this.ipfsService.saveObjAsFile({ data: ipfsData })
    return ipfsHash
  }

}

module.exports = {
  Listing,
  ListingIpfsStore
}