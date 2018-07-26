import v01ListingsAdapter from '../adapters/v01/listings_adapter'

const evolvingRegistry = 'evolvingRegistryContract'

const appendSlash = url => {
  return url.substr(-1) === '/' ? url : url + '/'
}

class Listings {
  constructor({
    contractService,
    ipfsService,
    fetch,
    indexingServerUrl,
    purchases
  }) {
    this.contractService = contractService
    this.ipfsService = ipfsService
    this.indexingServerUrl = indexingServerUrl
    this.fetch = fetch
    this.adapters = {
      'V01_Listings': new v01ListingsAdapter(...arguments)
    }
    this.currentAdapter = this.adapters.V01_Listings
  }

  /*
      Public mehods
  */

  // fetches all listings (all data included)
  async all() {
    const url = appendSlash(this.indexingServerUrl) + 'listing'
    const response = await this.fetch(url, { method: 'GET' })
    const json = await response.json()
    return Promise.all(
      json.objects.map(async obj => {
        const ipfsData = obj['ipfs_data']
        // While we wait on https://github.com/OriginProtocol/origin-bridge/issues/18
        // we fetch the array of image data strings for each listing
        const indexedIpfsData = await this.ipfsService.getFile(obj['ipfs_hash'])
        const pictures = indexedIpfsData.data.pictures
        return {
          address: obj['contract_address'],
          ipfsHash: obj['ipfs_hash'],
          sellerAddress: obj['owner_address'],
          price: Number(obj['price']),
          unitsAvailable: Number(obj['units']),
          created: obj['created_at'],
          expiration: obj['expires_at'],

          name: ipfsData ? ipfsData['name'] : null,
          category: ipfsData ? ipfsData['category'] : null,
          description: ipfsData ? ipfsData['description'] : null,
          location: ipfsData ? ipfsData['location'] : null,
          listingType: ipfsData ? ipfsData['listingType'] : unitListingType,
          pictures
        }
      })
    )
  }

  async allIds() {
    const range = (start, count) =>
      Array.apply(0, Array(count)).map((element, index) => index + start)
    const size = await this.contractService.call(evolvingRegistry, 'size')
    return range(0, Number(size))
  }

  async get(listingIndex) {
    const adapter = await this.getAdapter(listingIndex)
    return await adapter.get(listingIndex)
  }

  // This method is DEPRECATED (just use get instead)
  async getByIndex(listingIndex) {
    return await this.get(listingIndex)
  }

  async create(data, schemaType) {
    const adapter = this.currentAdapter
    return await adapter.create(...arguments)
  }

  async update(listingIndex, data = {}) {
    const adapter = await this.getAdapter(listingIndex)
    return await adapter.update(listingIndex, data)
  }

  async requestPurchase(listingIndex, ifpsData, ethToPay) {
    const adapter = await this.getAdapter(listingIndex)
    return await adapter.requestPurchase(...arguments)
  }

  async getPurchases(listingIndex) {
    const adapter = await this.getAdapter(listingIndex)
    return await adapter.getPurchases(...arguments)
  }

  async getAdapter(listingIndex) {
    // get entry type of listing from evolving registry
    const entryType = await this.contractService.call(
      evolvingRegistry,
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

module.exports = Listings
