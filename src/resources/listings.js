import Adaptable from './adaptable'

const unitListingType = 'unit'

const appendSlash = url => {
  return url.substr(-1) === '/' ? url : url + '/'
}

class Listings extends Adaptable {
  constructor({ contractService, ipfsService, fetch, indexingServerUrl }) {
    super(...arguments)
    this.contractService = contractService
    this.ipfsService = ipfsService
    this.indexingServerUrl = indexingServerUrl
    this.fetch = fetch
  }

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
    const size = await this.contractService.call(
      'evolvingRegistryContract',
      'size'
    )
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

  async create(data) {
    return await this.currentAdapter.create(data)
  }

  async update(listingIndex, data = {}) {
    const adapter = await this.getAdapter(listingIndex)
    return await adapter.update(listingIndex, data)
  }

  async requestPurchase(listingIndex, ipfsData, offerWei, confirmationCallback) {
    const adapter = await this.getAdapter(listingIndex)
    return await adapter.requestPurchase(listingIndex, ipfsData, offerWei, confirmationCallback)
  }

  async getPurchases(listingIndex) {
    const adapter = await this.getAdapter(listingIndex)
    return await adapter.getPurchases(listingIndex)
  }
}

module.exports = Listings
