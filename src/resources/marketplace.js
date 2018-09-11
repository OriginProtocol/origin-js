import { generateListingId, generateOfferId, generateNotificationId } from '../utils/id'

import Adaptable from './adaptable'
import { Listing } from '../models/listing'
import { Offer } from '../models/offer'
import { Review } from '../models/review'
import { ListingIpfsStore, OfferIpfsStore, ReviewIpfsStore } from '../services/data-store-service'

const unreadStatus = 'unread'
const readStatus = 'read'
const notificationStatuses = [unreadStatus, readStatus]

const storeKeys = {
  notificationSubscriptionStart: 'notification_subscription_start',
  notificationStatuses: 'notification_statuses'
}

class Marketplace extends Adaptable {

  constructor({
    contractService,
    ipfsService,
    store
  }) {
    super(...arguments)
    this.contractService = contractService
    this.ipfsService = ipfsService
    this.listingIpfsStore = new ListingIpfsStore(this.ipfsService)
    this.offerIpfsStore = new OfferIpfsStore(this.ipfsService)
    this.reviewIpfsStore = new ReviewIpfsStore(this.ipfsService)

    // initialize notifications
    if (!store.get(storeKeys.notificationSubscriptionStart)) {
      store.set(storeKeys.notificationSubscriptionStart, Date.now())
    }
    if (!store.get(storeKeys.notificationStatuses)) {
      store.set(storeKeys.notificationStatuses, {})
    }
    this.store = store
  }

  async getListingsCount() {
    let total = 0
    for (const version of this.versions) {
      total += await this.adapters[version].getListingsCount()
    }
    return total
  }

  async getListings(opts = {}) {
    const network = await this.contractService.web3.eth.net.getId()
    const listingIds = []

    for (const version of this.versions) {
      const listingIndexes = await this.adapters[version].getListings(opts)
      listingIndexes.forEach(listingIndex => {
        listingIds.unshift(
          generateListingId({ version, network, listingIndex })
        )
      })
    }

    if (opts.idsOnly) {
      return listingIds
    }

    // TODO: return full listings with data
    return listingIds
  }

  /**
   * Returns a Listing object based in its id.
   * @param listingId
   * @returns {Promise<Listing>}
   * @throws {Error}
   */
  async getListing(listingId) {
    // Get the on-chain listing data.
    const { adapter, listingIndex } = this.parseListingId(listingId)
    const chainListing = await adapter.getListing(listingIndex)

    // Get the off-chain listing data from IPFS.
    const ipfsHash = this.contractService.getIpfsHashFromBytes32(chainListing.ipfsHash)
    const ipfsListing = await this.listingIpfsStore.load(ipfsHash)

    // Create and return a Listing from on-chain and off-chain data .
    return new Listing(listingId, chainListing, ipfsListing)
  }

  // async getOffersCount(listingId) {}

  async getOffers(listingId, opts = {}) {
    const network = await this.contractService.web3.eth.net.getId()
    const { adapter, listingIndex, version } = this.parseListingId(listingId)
    const offers = await adapter.getOffers(listingIndex, opts)
    const offerIds = offers.map(offerIndex => {
      return generateOfferId({ network, version, listingIndex, offerIndex })
    })
    if (opts.idsOnly) {
      return offerIds
    } else {
      return await Promise.all(
        offerIds.map(offerId => {
          return this.getOffer(offerId)
        })
      )
    }
  }

  /**
   * Returns an offer based on its id.
   * @param {string}offerId - Unique offer Id.
   * @return {Promise<Offer>} - models/Offer object
   */
  async getOffer(offerId) {
    const {
      adapter,
      listingIndex,
      offerIndex,
      version,
      network
    } = this.parseOfferId(offerId)
    const listingId = generateListingId({ version, network, listingIndex })

    // Load chain data.
    const chainOffer = await adapter.getOffer(listingIndex, offerIndex)

    // Load ipfs data.
    const ipfsHash = this.contractService.getIpfsHashFromBytes32(chainOffer.ipfsHash)
    const ipfsOffer = await this.offerIpfsStore.load(ipfsHash)

    // Create an Offer from on-chain and off-chain data.
    return new Offer(offerId, listingId, chainOffer, ipfsOffer)
  }

  /**
   * Creates a new listing in the system. Data is recorded both on-chain and off-chain in IPFS.
   * @param {object} ipfsData - Listing data to store in IPFS
   * @param {func(confirmationCount, transactionReceipt)} confirmationCallback
   * @returns {Promise<object>} - Object with listingId and transactionReceipt fields.
   */
  async createListing(ipfsData, confirmationCallback) {
    // Validate and save the data to IPFS.
    const ipfsHash = await this.listingIpfsStore.save(ipfsData)
    const ipfsBytes = this.contractService.getBytes32FromIpfsHash(ipfsHash)

    const transactionReceipt = await this.currentAdapter.createListing(
      ipfsBytes,
      ipfsData,
      confirmationCallback
    )
    const version = this.currentVersion
    const network = await this.contractService.web3.eth.net.getId()
    const { listingIndex } = transactionReceipt
    const listingId = generateListingId({ network, version, listingIndex })

    return Object.assign({ listingId }, transactionReceipt)
  }

  // updateListing(listingId, data) {}

  async withdrawListing(listingId, ipfsData, confirmationCallback) {
    const { adapter, listingIndex } = this.parseListingId(listingId)
    const ipfsHash = await this.ipfsService.saveObjAsFile({ data: ipfsData })
    const ipfsBytes = this.contractService.getBytes32FromIpfsHash(ipfsHash)

    return await adapter.withdrawListing(
      listingIndex,
      ipfsBytes,
      confirmationCallback
    )
  }

  /**
   * Adds an offer for a listing.
   * @param {string} listingId
   * @param {object} offerData - Offer data, expected in V1 schema format.
   * @param {function(confirmationCount, transactionReceipt)} confirmationCallback
   * @return {Promise<{listingId, offerId, ...transactionReceipt}>}
   */
  async makeOffer(listingId, offerData, confirmationCallback) {
    const { adapter, listingIndex, version, network } = this.parseListingId(
      listingId
    )

    // For V1, we only support quantity of 1.
    if (offerData.unitsPurchased != 1)
      throw new Error(`Attempted to purchase ${offerData.unitsPurchased} - only 1 allowed.`)

    // Save the offer data in IPFS.
    const ipfsHash = await this.offerIpfsStore.save(offerData)
    const ipfsBytes = this.contractService.getBytes32FromIpfsHash(ipfsHash)

    // Record the offer on chain.
    const priceWei = this.contractService.web3.utils.toWei(
      offerData.totalPrice.amount,
      'ether'
    )
    const transactionData = { priceWei } // TODO: add commission, affliliate.
    const transactionReceipt = await adapter.makeOffer(
      listingIndex,
      ipfsBytes,
      transactionData,
      confirmationCallback
    )

    // Success. Return listingId, newly created offerId and chain transaction receipt.
    const { offerIndex } = transactionReceipt
    const offerId = generateOfferId({
      network,
      version,
      listingIndex,
      offerIndex
    })
    return Object.assign({ listingId, offerId }, transactionReceipt)
  }

  // updateOffer(listingId, offerId, data) {}
  // withdrawOffer(listingId, offerId, data) {}

  /**
   * Accepts an offer.
   * @param {string} id - Offer unique ID.
   * @param data - Empty object. Currently not used.
   * @param {function(confirmationCount, transactionReceipt)} confirmationCallback
   * @return {Promise<{timestamp, transactionReceipt}>}
   */
  async acceptOffer(id, data, confirmationCallback) {
    const { adapter, listingIndex, offerIndex } = this.parseOfferId(id)

    // FIXME(franck): implement support for empty data.
    //const ipfsHash = await this.offerIpfsStore.save(data)
    //const ipfsBytes = this.contractService.getBytes32FromIpfsHash(ipfsHash)
    const ipfsBytes = '0x0000000000000000000000000000000000000000'

    return await adapter.acceptOffer(
      listingIndex,
      offerIndex,
      ipfsBytes,
      confirmationCallback
    )
  }

  /**
   * Finalizes an offer. Store review data in IPFS.
   * @param {string} id - Offer unique ID.
   * @param {object} reviewData - Buyer's review. Data expected in schema version 1.0 format.
   * @param {function(confirmationCount, transactionReceipt)} confirmationCallback
   * @return {Promise<{timestamp, transactionReceipt}>}
   */
  async finalizeOffer(id, reviewData, confirmationCallback) {
    const { adapter, listingIndex, offerIndex } = this.parseOfferId(id)

    const ipfsHash = await this.reviewIpfsStore.save(reviewData)
    const ipfsBytes = this.contractService.getBytes32FromIpfsHash(ipfsHash)

    return await adapter.finalizeOffer(
      listingIndex,
      offerIndex,
      ipfsBytes,
      confirmationCallback
    )
  }

  // setOfferRefund(listingId, offerId, data) {}

  // initiateDispute(listingId, offerId) {}
  // disputeRuling(listingId, offerId, data) {}
  // manageListingDeposit(listingId, data) {}

  /**
   * Adds data to either a listing or an offer.
   * Use cases:
   *  - offer: allows seller to add review data.
   *  - listing: for future use.
   * @param listingId
   * @param offerId
   * @param {object} data - In case of an offer, Seller review data in schema 1.0 format.
   * @param {function(confirmationCount, transactionReceipt)} confirmationCallback
   * @return {Promise<{timestamp, transactionReceipt}>}
   */
  async addData(listingId, offerId, data, confirmationCallback) {

    if (offerId) {
      const { adapter, listingIndex, offerIndex } = this.parseOfferId(offerId)

      // We expect this to be review data from the seller.
      const ipfsHash = await this.reviewIpfsStore.save(data)
      const ipfsBytes = this.contractService.getBytes32FromIpfsHash(ipfsHash)

      return await adapter.addData(
        ipfsBytes,
        listingIndex,
        offerIndex,
        confirmationCallback
      )
    } else if (listingId) {
      const { adapter, listingIndex } = this.parseListingId(listingId)

      const ipfsHash = await this.listingIpfsStore.save(data)
      const ipfsBytes = this.contractService.getBytes32FromIpfsHash(ipfsHash)

      return await adapter.addData(
        ipfsBytes,
        listingIndex,
        null,
        confirmationCallback
      )
    } else {
      throw new Error('addData must be called with either a listing or offer id.')
    }
  }

  // Convenience methods

  /**
   * Pulls all the Buyer side reviews for a listing.
   * @param {string} listingId
   * @return {Promise<Array[Review]>}
   */
  async getListingReviews(listingId) {
    const { adapter, listingIndex, version, network } = this.parseListingId(listingId)

    // Get all the OfferFinalized events for the listing.
    const listing = await adapter.getListing(listingIndex)
    const reviewEvents = listing.events.filter(
      e => e.event === 'OfferFinalized'
    )

    const reviews = []
    for (const event of reviewEvents) {
      // Load review data from IPFS.
      const ipfsHash = this.contractService.getIpfsHashFromBytes32(event.returnValues.ipfsHash)
      const ipfsReview = await this.reviewIpfsStore.load(ipfsHash)

      const offerIndex = event.returnValues.offerID
      const offerId = generateOfferId({ network, version, listingIndex, offerIndex })

      // TODO(franck): Store the review timestamp in IPFS to avoid
      //               a call to the blockchain to get the event's timestamp.
      const timestamp = await this.contractService.getTimestamp(event)
      event.timestamp = timestamp

      // Create a Review object based on IPFS and event data.
      const review = new Review(listingId, offerId, event, ipfsReview)
      reviews.push(review)
    }
    return reviews
  }

  async getNotifications() {
    const network = await this.contractService.web3.eth.net.getId()
    const party = await this.contractService.currentAccount()
    let notifications = []
    for (const version of this.versions) {
      const rawNotifications = await this.adapters[version].getNotifications(
        party
      )

      for (const notification of rawNotifications) {
        notification.id = generateNotificationId({
          network,
          version,
          transactionHash: notification.event.transactionHash
        })
        const timestamp = await this.contractService.getTimestamp(notification.event)
        const timestampInMilli = timestamp * 1000
        const isWatched =
          timestampInMilli >
          this.store.get(storeKeys.notificationSubscriptionStart)
        const notificationStatuses = this.store.get(
          storeKeys.notificationStatuses
        )
        notification.status =
          isWatched && notificationStatuses[notification.id] !== readStatus
            ? unreadStatus
            : readStatus
        if (notification.resources.listingId) {
          notification.resources.listing = await this.getListing(
            `${network}-${version}-${notification.resources.listingId}`
          )
        }
        if (notification.resources.offerId) {
          notification.resources.purchase = await this.getOffer(
            `${network}-${version}-${notification.resources.listingId}-${
              notification.resources.offerId
            }`
          )
        }
      }

      notifications = notifications.concat(rawNotifications)
    }
    return notifications
  }

  async setNotification({ id, status }) {
    if (!notificationStatuses.includes(status)) {
      throw new Error(`invalid notification status: ${status}`)
    }
    const notifications = this.store.get(storeKeys.notificationStatuses)
    notifications[id] = status
    this.store.set(storeKeys.notificationStatuses, notifications)
  }

  async getTokenAddress() {
    return await this.currentAdapter.getTokenAddress()
  }
}

module.exports = Marketplace
