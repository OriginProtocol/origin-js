import v01ListingsAdapter from '../adapters/v01/listings_adapter'

class Adaptable {
  constructor() {
    this.adapters = {
      V01_Listings: new v01ListingsAdapter(...arguments)
    }
    this.currentAdapter = this.adapters.V01_Listings
  }

  async getAdapter(listingIndex) {
    // get entry type of listing from evolving registry
    const entryType = await this.contractService.call(
      'evolvingRegistryContract',
      'getEntryTypeOfEntry',
      [listingIndex]
    )
    const entryTypeName = entryType['_name']

    // use appropriate adapter for entry type
    const adapter = this.adapters[entryTypeName]
    if (!adapter) {
      throw new Error(`Adapter not found: ${entryTypeName}`)
    }
    return adapter
  }
}

module.exports = Adaptable
