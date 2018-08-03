import Adaptable from './adaptable'
import { parseListingId } from '../utils/id'

const appendSlash = url => {
  return url.substr(-1) === '/' ? url : url + '/'
}

class Purchases extends Adaptable {
  constructor({ contractService, ipfsService, fetch, indexingServerUrl }) {
    super(...arguments)
    this.contractService = contractService
    this.ipfsService = ipfsService
    this.fetch = fetch
    this.indexingServerUrl = indexingServerUrl
  }

  // fetches all purchases (all data included)
  async all() {
    try {
      return await this.allIndexed()
    } catch (error) {
      console.error(error)
      console.log('Cannot get all purchases')
      throw error
    }
  }

  async get(listingId, purchaseIndex) {
    const adapter = await this.getAdapter(listingId)
    const { listingIndex } = parseListingId(listingId)
    return await adapter.getPurchase(listingIndex, purchaseIndex)
  }

  async request(listingId, ipfsData, offerWei) {
    const adapter = await this.getAdapter(listingId)
    const { listingIndex } = parseListingId(listingId)
    return await adapter.requestPurchase(listingIndex, ipfsData, offerWei)
  }

  async acceptRequest(
    listingId,
    purchaseIndex,
    ipfsData,
    confirmationCallback
  ) {
    const adapter = await this.getAdapter(listingId)
    const { listingIndex } = parseListingId(listingId)
    return await adapter.acceptPurchaseRequest(
      listingIndex,
      purchaseIndex,
      ipfsData,
      confirmationCallback
    )
  }

  async rejectRequest(
    listingId,
    purchaseIndex,
    ipfsData,
    confirmationCallback
  ) {
    const adapter = await this.getAdapter(listingId)
    const { listingIndex } = parseListingId(listingId)
    return await adapter.rejectPurchaseRequest(
      listingIndex,
      purchaseIndex,
      ipfsData,
      confirmationCallback
    )
  }

  async buyerFinalize(
    listingId,
    purchaseIndex,
    ipfsData,
    confirmationCallback
  ) {
    const adapter = await this.getAdapter(listingId)
    const { listingIndex } = parseListingId(listingId)
    return await adapter.buyerFinalizePurchase(
      listingIndex,
      purchaseIndex,
      ipfsData,
      confirmationCallback
    )
  }

  async sellerFinalize(
    listingId,
    purchaseIndex,
    ipfsData,
    confirmationCallback
  ) {
    const adapter = await this.getAdapter(listingId)
    const { listingIndex } = parseListingId(listingId)
    return await adapter.sellerFinalizePurchase(
      listingIndex,
      purchaseIndex,
      ipfsData,
      confirmationCallback
    )
  }

  async getLogs(listingId, purchaseIndex) {
    const adapter = await this.getAdapter(listingId)
    const { listingIndex } = parseListingId(listingId)
    return await adapter.getPurchaseLogs(listingIndex, purchaseIndex)
  }

  /*
      private
  */

  async allIndexed() {
    const url = appendSlash(this.indexingServerUrl) + 'purchase'
    const response = await this.fetch(url, { method: 'GET' })
    const json = await response.json()
    return json.objects.map(obj => {
      return {
        address: obj['contract_address'],
        buyerAddress: obj['buyer_address'],
        // https://github.com/OriginProtocol/origin-bridge/issues/102
        buyerTimeout: +new Date(obj['buyer_timeout']),
        created: +new Date(obj['created_at']),
        listingAddress: obj['listing_address'],
        stage: obj['stage']
      }
    })
  }
}

module.exports = Purchases
