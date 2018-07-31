import notificationSchema from '../schemas/notification.json'
import Ajv from 'ajv'

const ajv = new Ajv()

const unreadStatus = 'unread'
const readStatus = 'read'

const notificationTypes = {
  sellerListingPurchased: {
    name: 'seller_listing_purchased',
    purchaseStage: 'BUYER_REQUESTED'
  },
  sellerReviewReceived: {
    name: 'seller_review_received',
    purchaseStage: 'BUYER_FINALIZED'
  },
  buyerListingShipped: {
    name: 'buyer_listing_shipped',
    purchaseStage: 'SELLER_ACCEPTED'
  },
  buyerReviewReceived: {
    name: 'buyer_review_received',
    purchaseStage: 'SELLER_FINALIZED'
  }
}

const storeKeys = {
  notificationSubscriptionStart: 'notification_subscription_start',
  notificationStatuses: 'notification_statuses'
}

class NotificationObject {
  constructor({ id, type, status = unreadStatus, resources = {} } = {}) {
    const validate = ajv.compile(notificationSchema)
    if (validate({ id, type, status })) {
      this.id = id // id can be anything as long as it is unique and reproducible
      this.type = type
      this.status = status
      this.resources = resources
    }
  }
}

class Notifications {
  constructor({ listings, purchases, contractService, store }) {
    if (!store.get(storeKeys.notificationSubscriptionStart)) {
      store.set(storeKeys.notificationSubscriptionStart, Date.now())
    }
    if (!store.get(storeKeys.notificationStatuses)) {
      store.set(storeKeys.notificationStatuses, {})
    }
    this.listings = listings
    this.purchases = purchases
    this.contractService = contractService
    this.store = store
  }

  // public methods

  // we allow the entire notification to be passed in (for consistency with other resources + convenience)
  // however all we are updating is the status
  set({ id, status }) {
    const notificationStatuses = this.store.get(storeKeys.notificationStatuses)
    notificationStatuses[id] = status
    this.store.set(storeKeys.notificationStatuses, notificationStatuses)
  }

  async all(account) {
    const currentAccount =
      account || (await this.contractService.currentAccount())
    // get this all at once and use as a cache
    const blockchainData = await this.blockchainData()
    const params = [blockchainData, currentAccount]

    const sellerListingPurchased = this.sellerListingPurchasedNotifications.apply(
      this,
      params
    )
    const sellerReviewReceived = this.sellerReviewReceivedNotifications.apply(
      this,
      params
    )
    const buyerListingShipped = this.buyerListingShippedNotifications.apply(
      this,
      params
    )
    const buyerReviewReceived = this.buyerReviewReceivedNotifications.apply(
      this,
      params
    )

    return sellerListingPurchased
      .concat(sellerReviewReceived)
      .concat(buyerListingShipped)
      .concat(buyerReviewReceived)
  }

  // private methods

  sellerListingPurchasedNotifications(blockchainData, account) {
    const purchaseStage = notificationTypes.sellerListingPurchased.purchaseStage
    const logs = this.sellerPurchaseLogsFor(blockchainData, account)
    const logsForStage = logs.filter(
      ({ log: { stage } }) => stage === purchaseStage
    )
    return this.purchaseNotifications(
      logsForStage,
      notificationTypes.sellerListingPurchased.name
    )
  }

  sellerReviewReceivedNotifications(blockchainData, account) {
    const purchaseStage = notificationTypes.sellerReviewReceived.purchaseStage
    const logs = this.sellerPurchaseLogsFor(blockchainData, account)
    const logsForStage = logs.filter(
      ({ log: { stage } }) => stage === purchaseStage
    )
    return this.purchaseNotifications(
      logsForStage,
      notificationTypes.sellerReviewReceived.name
    )
  }

  buyerListingShippedNotifications(blockchainData, account) {
    const purchaseStage = notificationTypes.buyerListingShipped.purchaseStage
    const logs = this.buyerPurchaseLogsFor(blockchainData, account)
    const logsForStage = logs.filter(
      ({ log: { stage } }) => stage === purchaseStage
    )
    return this.purchaseNotifications(
      logsForStage,
      notificationTypes.buyerListingShipped.name
    )
  }

  buyerReviewReceivedNotifications(blockchainData, account) {
    const purchaseStage = notificationTypes.buyerReviewReceived.purchaseStage
    const logs = this.buyerPurchaseLogsFor(blockchainData, account)
    const logsForStage = logs.filter(
      ({ log: { stage } }) => stage === purchaseStage
    )
    return this.purchaseNotifications(
      logsForStage,
      notificationTypes.buyerReviewReceived.name
    )
  }

  purchaseNotifications(logs, type) {
    return logs.map(({ log, listing, purchase }) => {
      const id = `${type}_${log.transactionHash}_${purchase.address}`
      const timestampInMilli = log.timestamp * 1000
      const isWatched =
        timestampInMilli >
        this.store.get(storeKeys.notificationSubscriptionStart)
      const notificationStatuses = this.store.get(
        storeKeys.notificationStatuses
      )
      const status =
        isWatched && notificationStatuses[id] !== readStatus
          ? unreadStatus
          : readStatus
      return new NotificationObject({
        id,
        type,
        status,
        resources: { listing, purchase }
      })
    })
  }

  async allListingsIds() {
    return await this.listings.allIds()
  }

  async blockchainData() {
    const allListingIds = await this.allListingsIds()
    const purchasesByListing = await Promise.all(
      allListingIds.map(listingId => {
        return this.purchaseDataForListing(listingId)
      })
    )
    return [].concat.apply([], purchasesByListing) // flatten to one-dimensional array
  }

  async purchaseDataForListing(listingIndex) {
    const purchases = await this.listings.getPurchases(listingIndex)
    const listing = await this.listings.get(listingIndex)
    return await Promise.all(
      purchases.map((purchase, purchaseIndex) => {
        return this.purchaseDataForListingAndPurchase(
          listing,
          purchase,
          listingIndex,
          purchaseIndex
        )
      })
    )
  }

  async purchaseDataForListingAndPurchase(
    listing,
    purchase,
    listingIndex,
    purchaseIndex
  ) {
    const purchaseLogs = await this.purchases.getLogs(
      listingIndex,
      purchaseIndex
    )
    return { purchase, purchaseLogs, listing }
  }

  sellerPurchaseLogsFor(blockchainData, account) {
    return this.purchaseLogsFor(blockchainData, account, ({ listing }) => {
      return listing.sellerAddress === account
    })
  }

  buyerPurchaseLogsFor(blockchainData, account) {
    return this.purchaseLogsFor(blockchainData, account, ({ purchase }) => {
      return purchase.buyerAddress === account
    })
  }

  purchaseLogsFor(blockchainData, account, filterFn) {
    const logsByPurchase = blockchainData
      .filter(filterFn)
      .map(({ purchaseLogs, listing, purchase }) => {
        return purchaseLogs.map(log => {
          return { log, listing, purchase }
        })
      })
    return [].concat.apply([], logsByPurchase)
  }
}

module.exports = Notifications
