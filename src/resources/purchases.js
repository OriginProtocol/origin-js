import Adaptable from './adaptable'

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

  async get(listingIndex, purchaseIndex) {
    const adapter = await this.getAdapter(listingIndex)
    return await adapter.getPurchase(listingIndex, purchaseIndex)
  }

  async request(listingIndex, ipfsData, offerWei) {
    const adapter = await this.getAdapter(listingIndex)
    return await adapter.requestPurchase(listingIndex, ipfsData, offerWei)
  }

  async acceptRequest(
    listingIndex,
    purchaseIndex,
    ipfsData,
    confirmationCallback
  ) {
    const adapter = await this.getAdapter(listingIndex)
    return await adapter.acceptPurchaseRequest(
      listingIndex,
      purchaseIndex,
      ipfsData,
      confirmationCallback
    )
  }

  async rejectRequest(
    listingIndex,
    purchaseIndex,
    ipfsData,
    confirmationCallback
  ) {
    const adapter = await this.getAdapter(listingIndex)
    return await adapter.rejectPurchaseRequest(
      listingIndex,
      purchaseIndex,
      ipfsData,
      confirmationCallback
    )
  }

  async buyerFinalize(
    listingIndex,
    purchaseIndex,
    ipfsData,
    confirmationCallback
  ) {
    const adapter = await this.getAdapter(listingIndex)
    return await adapter.buyerFinalizePurchase(
      listingIndex,
      purchaseIndex,
      ipfsData,
      confirmationCallback
    )
  }

  async sellerFinalize(
    listingIndex,
    purchaseIndex,
    ipfsData,
    confirmationCallback
  ) {
    const adapter = await this.getAdapter(listingIndex)
    return await adapter.sellerFinalizePurchase(
      listingIndex,
      purchaseIndex,
      ipfsData,
      confirmationCallback
    )
  }

  async getLogs(listingIndex, purchaseIndex) {
    const adapter = await this.getAdapter(listingIndex)
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
