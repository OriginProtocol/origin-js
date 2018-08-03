import v01ListingsAdapter from '../adapters/v01/listings_adapter'
import v02MarketplaceAdapter from '../adapters/v02/marketplace_adapter'
import { parseListingId } from '../utils/id'

class Adaptable {
  constructor() {
    this.adapters = {
      '001': new v01ListingsAdapter(...arguments),
      '002': new v02MarketplaceAdapter(...arguments)
    }
    this.versions = [
      '001', '002'
    ]
    this.currentVersion = this.versions[this.versions.length - 1]
    this.currentAdapter = this.adapters[this.currentVersion]
  }

  async getAdapter(listingId) {
    const { version } = parseListingId(listingId)
    // use appropriate adapter for version
    const adapter = this.adapters[version]
    if (!adapter) {
      throw new Error(`Adapter not found for version ${version}`)
    }
    return adapter
  }
}

module.exports = Adaptable
