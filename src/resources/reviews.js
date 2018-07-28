import Adaptable from './adaptable'

class Reviews extends Adaptable {
  constructor({ contractService, ipfsService }) {
    super(...arguments)
    this.contractService = contractService
    this.ipfsService = ipfsService
    this.contractDefinition = this.contractService.purchaseContract
  }

  async find(where = {}) {
    const hasListingId = where.listingId !== undefined
    const hasPurchaseId = where.purchaseId !== undefined
    if (hasListingId && hasPurchaseId) {
      const adapter = await this.getAdapter(where.listingId)
      return await adapter.findReviewForPurchase(
        this.contractService,
        this.ipfsService,
        where.listingId,
        where.purchaseId
      )
    }
  }
}

module.exports = Reviews
