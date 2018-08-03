import Adaptable from './adaptable'
import { generateListingId, parseListingId } from '../utils/id'

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
    const network = '999' // TODO don't hard code this
    const adapters = this.adapters
    const versions = this.versions
    const sizesByVersionPromise = versions.map(version => {
      const adapter = adapters[version]
      return new Promise(async (resolve) => {
        const size = await adapter.listingsLength()
        resolve({ version, size })
      })
    })
    const sizesByVersion = await Promise.all(sizesByVersionPromise)
    const idsByVersion = sizesByVersion.map(({ version, size }) => {
      const listingIndices = [...Array(size).keys()]
      return listingIndices.map(listingIndex => {
        return generateListingId({ version, network, listingIndex })
      })
    })
    // flatten array
    return [].concat.apply([], idsByVersion)
  }

  async get(listingId) {
    const adapter = await this.getAdapter(listingId)
    const { listingIndex } = parseListingId(listingId)
    return await adapter.get(listingIndex)
  }

  // This method is DEPRECATED (just use get instead)
  async getByIndex(listingId) {
    return await this.get(listingId)
  }

  async create(data) {
    return await this.currentAdapter.create(data)
  }

  async update(listingId, data = {}) {
    const adapter = await this.getAdapter(listingId)
    const { listingIndex } = parseListingId(listingId)
    return await adapter.update(listingIndex, data)
  }

  async requestPurchase(listingId, ipfsData, offerWei, confirmationCallback) {
    const adapter = await this.getAdapter(listingId)
    const { listingIndex } = parseListingId(listingId)
    return await adapter.requestPurchase(listingIndex, ipfsData, offerWei, confirmationCallback)
  }

  async getPurchases(listingId) {
    const adapter = await this.getAdapter(listingId)
    const { listingIndex } = parseListingId(listingId)
    return await adapter.getPurchases(listingIndex)
  }
}

module.exports = Listings
