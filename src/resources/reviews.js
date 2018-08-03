import Adaptable from './adaptable'
import { parseListingId } from '../utils/id'

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
      const { listingIndex } = parseListingId(where.listingId)
      return await adapter.findReviewForPurchase(
        this.contractService,
        this.ipfsService,
        listingIndex,
        where.purchaseId
      )
    }
  }
}

module.exports = Reviews
