import notificationSchema from "../schemas/notification.json"
import Ajv from "ajv"

const ajv = new Ajv()

const unreadStatus = "unread"
const readStatus = "read"

class NotificationObject {
  constructor({ id, type, status = unreadStatus } = {}) {
    let validate = ajv.compile(notificationSchema)
    if (validate({ id, type, status })) {
      this.id = id // id can be anything as long as it is unique and reproducible
      this.type = type
      this.status = status
    }
  }
}

class Notifications {
  constructor({ listings, purchases, contractService, store }) {
    if (!store.get("notificationSubscriptionStart")) {
      store.set("notificationSubscriptionStart", Date.now())
    }
    this.listings = listings
    this.purchases = purchases
    this.contractService = contractService
    this.store = store
  }

  // public methods

  async all(account) {
    const currentAccount = account || await this.contractService.currentAccount()
    // get this all at once and use as a cache
    const blockchainData = await this.blockchainData()
    const params = [
      blockchainData,
      currentAccount
    ]

    const sellerListingPurchased = this.sellerListingPurchasedNotifications.apply(this, params)
    const sellerReviewReceived = this.sellerReviewReceivedNotifications.apply(this, params)
    const buyerListingSent = this.buyerListingSentNotifications.apply(this, params)
    const buyerReviewReceived = this.buyerReviewReceivedNotifications.apply(this, params)

    return sellerListingPurchased
      .concat(sellerReviewReceived)
      .concat(buyerListingSent)
      .concat(buyerReviewReceived)
  }

  // private methods

  sellerListingPurchasedNotifications(blockchainData, account) {
    const purchaseStage = "shipping_pending"
    const logs = this.sellerPurchaseLogsFor(blockchainData, account)
    const logsForStage = logs.filter(({ stage }) => stage === purchaseStage)
    return this.purchaseNotifications(
      logsForStage,
      "seller_listing_purchased"
    )
  }

  sellerReviewReceivedNotifications(blockchainData, account) {
    const purchaseStage = "seller_pending"
    const logs = this.sellerPurchaseLogsFor(blockchainData, account)
    const logsForStage = logs.filter(({ stage }) => stage === purchaseStage)
    return this.purchaseNotifications(
      logsForStage,
      "seller_review_received"
    )
  }

  buyerListingSentNotifications(blockchainData, account) {
    const purchaseStage = "buyer_pending"
    const logs = this.buyerPurchaseLogsFor(blockchainData, account)
    const logsForStage = logs.filter(({ stage }) => stage === purchaseStage)
    return this.purchaseNotifications(
      logsForStage,
      "buyer_listing_sent"
    )
  }

  buyerReviewReceivedNotifications(blockchainData, account) {
    const purchaseStage = "complete"
    const logs = this.buyerPurchaseLogsFor(blockchainData, account)
    const logsForStage = logs.filter(({ stage }) => stage === purchaseStage)
    return this.purchaseNotifications(
      logsForStage,
      "buyer_review_received"
    )
  }

  purchaseNotifications(logs, type) {
    return logs.map(log => {
      const id = `${type}_${log.transactionHash}`
      const isWatched = log.timestamp > this.store.get("notificationSubscriptionStart")
      const notificationStatuses = this.store.get("notificationStatuses")
      const status = (isWatched && notificationStatuses[id] !== readStatus)
        ? unreadStatus : readStatus
      return new NotificationObject({
        id,
        type,
        status
      })
    })
  }

  async allListings() {
    const allListingAddresses = await this.listings.allAddresses()
    return await Promise.all(allListingAddresses.map(address => {
      return this.listings.get(address)
    }))
  }

  async blockchainData() {
    const allListings = await this.allListings()
    const purchasesByListing = await Promise.all(allListings.map(listing => {
      return this.purchaseDataForListing(listing)
    }))
    return [].concat.apply([], purchasesByListing) // flatten to one-dimensional array
  }

  async purchaseDataForListing(listing) {
    const len = await this.listings.purchasesLength(listing.address)
    const purchaseAddresses = await Promise.all([...Array(len).keys()].map(i => {
      return this.listings.purchaseAddressByIndex(listing.address, i)
    }))
    return await Promise.all(purchaseAddresses.map(purchaseAddress => {
      return this.purchaseDataForListingAndPurchase(purchaseAddress, listing)
    }))
  }

  async purchaseDataForListingAndPurchase(purchaseAddress, listing) {
    const purchase = await this.purchases.get(purchaseAddress)
    const purchaseLogs = await this.purchases.getLogs(purchaseAddress)
    return { purchase, purchaseLogs, listing }
  }

  sellerPurchaseLogsFor(blockchainData, account) {
    const logsByPurchase = blockchainData.filter(({ listing }) => {
      return listing.sellerAddress === account
    }).map(({ purchaseLogs }) => purchaseLogs )
    return [].concat.apply([], logsByPurchase)
  }

  buyerPurchaseLogsFor(blockchainData, account) {
    const logsByPurchase = blockchainData.filter(({ purchase }) => {
      return purchase.buyerAddress === account
    }).map(({ purchaseLogs }) => purchaseLogs )
    return [].concat.apply([], logsByPurchase)
  }
}

module.exports = Notifications
