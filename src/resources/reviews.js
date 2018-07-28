const buyerReviewStage = 4
const sellerReviewStage = 5
const reviewStages = [buyerReviewStage, sellerReviewStage]
const emptyIpfsHash = '0x0000000000000000000000000000000000000000000000000000000000000000'

class Reviews {
  constructor({ contractService, ipfsService }) {
    this.contractService = contractService
    this.ipfsService = ipfsService
    this.contractDefinition = this.contractService.purchaseContract
  }

  async find(where = {}) {
    const hasListingId = where.listingId !== undefined
    const hasPurchaseId = where.purchaseId !== undefined
    if (hasListingId && hasPurchaseId) {
      return await this._find_by_purchase_id(where.listingId, where.purchaseId)
    }
  }

  // Temporary, until bridge server intergration
  async _find_by_purchase_id(listingId, purchaseId) {
    const v01_ListingsContract = await this.contractService.deployed(
      this.contractService.v01_ListingsContract
    )
    const logs = await new Promise((resolve, reject) => {
      v01_ListingsContract.getPastEvents(
        'PurchaseChange',
        {
          fromBlock: 0,
          toBlock: 'latest',
          filter: { _listingIndex: listingId, _purchaseIndex: purchaseId }
        },
        function(error, logs) {
          if (error) {
            reject(error)
          }
        resolve(logs)
      })
    })
    const itemsPromise = logs
      .filter(log => {
        return reviewStages.includes(Number(log.returnValues._stage))
      })
      .map((log) => this.createItem(log))
    const items = await Promise.all(itemsPromise)
    const buyerReviewItems = items.filter(({ stage }) => {
      return Number(stage) === buyerReviewStage
    })
    const sellerReviewItems = items.filter(({ stage }) => {
      return Number(stage) === sellerReviewStage
    })
    const format = (item) => {
      return { ipfsData: item.ipfsData }
    }
    const fromBuyer = buyerReviewItems.length ? format(buyerReviewItems[0]) : null
    const fromSeller = sellerReviewItems.length ? format(sellerReviewItems[0]) : null
    return { fromBuyer, fromSeller }
  }

  async createItem(log) {
    const asBytes32 = log.returnValues._ipfsHash
    const stage = log.returnValues._stage
    const ipfsHash = this.contractService.getIpfsHashFromBytes32(asBytes32)
    let ipfsData
    if (ipfsHash !== emptyIpfsHash) {
      ipfsData = await this.ipfsService.getFile(ipfsHash)
    }
    return { ipfsData, stage }
  }
}

module.exports = Reviews
