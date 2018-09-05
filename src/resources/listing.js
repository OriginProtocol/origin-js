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


//
// Listing is the main interface exposed by Origin Protocol to access data from a listing.
//
class Listing {
  /**
   * A Listing is constructed based on its on-chain and off-chain data.
   * #param {string} listingId - Unique listing ID.
   * @param {Object} chainListing - Listing data from the blockchain.
   * @param {Object} ipfsListing - Listing data from IPFS.
   */
  constructor(listingId, chainListing, ipfsListing) {
    this.id = listingId
    // FIXME(franck): Exposing directly the chain data will make it difficult
    // to support backward compatibility of the Listing interface in the future. We should
    // select and possibly abstract what data from the chain gets exposed.
    Object.assign(this, ipfsListing, chainListing)
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

  get unitsRemaining() {
    // Should never be negative.
    return Math.max(this.unitsTotal - this.unitsSold, 0)
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
      listing.unitsTotal = data.unitsTotal
      listing.price = new Money(data.price)
      listing.commission = data.commission ? new Money(data.commission) : null
      listing.securityDeposit = data.securityDeposit ? new Money(data.securityDeposit) : null
    } else if (listing.type === 'fractional') {
      // TODO(franck): fill this in.
    }
    return listing
  }
}

//
// ListingIpfsStore exposes methods to read and write listing data from/to IPFS.
//
class ListingIpfsStore {
  constructor(ipfsService) {
    this.ipfsService = ipfsService
  }

  /**
   * Rewrites IPFS media URLs to point to the configured IPFS gateway.
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
   * Uploads to IPFS content passed as data URL.
   */
  async _saveMediaData(listing) {
    if (!listing.media) {
      return
    }

    // Only allow data:, dweb:, and ipfs: URLs
    listing.media = listing.media.filter(medium => {
      if (medium.url) {
        try {
          return ['data:', 'dweb:', 'ipfs:'].includes(new URL(medium.url).protocol)
        } catch (error) {
          // Invalid URL, filter it out
          return false
        }
      } else {
        // No url. Invalid entry.
        return false
      }
    })

    // Upload to IPFS data URL content.
    const uploads = listing.media.map(async medium => {
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

    // Deserialize the data into a Listing object.
    const adapter = schemaAdapterFactory(data.schemaVersion)
    const listing = adapter.deserialize(data)

    // Rewrite any IPFS URL to point to configured IPFS gateway.
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
    // Validate the listing's data against schema.
    const adapter = schemaAdapterFactory(ipfsData.schemaVersion)
    adapter.validate(ipfsData)

    // Save media data as separate files.
    await this._saveMediaData(ipfsData)

    // Save listing data to IPFS in JSON format.
    const ipfsHash = await this.ipfsService.saveObjAsFile(ipfsData)
    return ipfsHash
  }
}

module.exports = {
  Listing,
  ListingIpfsStore
}