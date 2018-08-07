import v00MarketplaceAdapter from '../adapters/v00/marketplace_adapter'
import { parseListingId, parseOfferId } from '../utils/id'

class Adaptable {
  constructor(args) {
    this.adapters = {
      '000': new v00MarketplaceAdapter(
        Object.assign({}, args, { contractName: 'v00_MarketplaceContract' })
      ),
      '001': new v00MarketplaceAdapter(
        Object.assign({}, args, { contractName: 'v01_MarketplaceContract' })
      )
    }
    this.versions = ['000', '001']
    this.currentVersion = this.versions[this.versions.length - 1]
    this.currentAdapter = this.adapters[this.currentVersion]
  }

  parseListingId(listingId) {
    const { version, listingIndex } = parseListingId(listingId)
    // use appropriate adapter for version
    const adapter = this.adapters[version]
    if (!adapter) {
      throw new Error(`Adapter not found for version ${version}`)
    }
    return { adapter, listingIndex, version }
  }

  parseOfferId(offerId) {
    const { version, listingIndex, offerIndex } = parseOfferId(offerId)
    // use appropriate adapter for version
    const adapter = this.adapters[version]
    if (!adapter) {
      throw new Error(`Adapter not found for version ${version}`)
    }
    return { adapter, listingIndex, offerIndex , version }
  }
}

module.exports = Adaptable
