import { generateListingId, generateOfferId, generateNotificationId } from '../utils/id'

import Adaptable from './adaptable'
import { Listing } from '../models/listing'
import { ListingIpfsStore } from '../services/listing-service'

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
    fetch,
    indexingServerUrl,
    store
  }) {
    super(...arguments)
    this.contractService = contractService
    this.ipfsService = ipfsService
    this.indexingServerUrl = indexingServerUrl
    this.fetch = fetch
    this.listingIpfsStore = new ListingIpfsStore(this.ipfsService)

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

  async getOffer(offerId) {
    const {
      adapter,
      listingIndex,
      offerIndex,
      version,
      network
    } = this.parseOfferId(offerId)
    const offer = await adapter.getOffer(listingIndex, offerIndex)

    const ipfsHash = this.contractService.getIpfsHashFromBytes32(offer.ipfsHash)
    const ipfsJson = await this.ipfsService.loadObjFromFile(ipfsHash)
    const listingId = generateListingId({ version, network, listingIndex })

    // Use data from IPFS is offer no longer in active blockchain state
    if (
      offer.buyer.indexOf('0x00000') === 0 &&
      ipfsJson.data &&
      ipfsJson.data.buyer
    ) {
      offer.buyer = ipfsJson.data.buyer
    }

    return Object.assign({}, offer, {
      id: offerId,
      ipfsData: ipfsJson || {},
      listingId
    })
  }

  /**
   * Creates a new listing in the system. Data is recorded both on-chain and off-chain in IPFS.
   * @param {object} ipfsData - Listing data to store in IPFS
   * @param {func(confirmationCount, transactionReceipt)} confirmationCallback - Called upon blocks confirmation.
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
    const listingId = generateOfferId({ network, version, listingIndex })

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

  async makeOffer(listingId, data, confirmationCallback) {
    const { adapter, listingIndex, version, network } = this.parseListingId(
      listingId
    )
    const buyer = await this.contractService.currentAccount()

    data.price = this.contractService.web3.utils.toWei(
      String(data.price),
      'ether'
    )
    data.buyer = buyer

    const ipfsHash = await this.ipfsService.saveObjAsFile({ data })
    const ipfsBytes = this.contractService.getBytes32FromIpfsHash(ipfsHash)

    const transactionReceipt = await adapter.makeOffer(
      listingIndex,
      ipfsBytes,
      data,
      confirmationCallback
    )
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

  async acceptOffer(id, data, confirmationCallback) {
    const { adapter, listingIndex, offerIndex } = this.parseOfferId(id)

    const ipfsHash = await this.ipfsService.saveObjAsFile({ data })
    const ipfsBytes = this.contractService.getBytes32FromIpfsHash(ipfsHash)

    return await adapter.acceptOffer(
      listingIndex,
      offerIndex,
      ipfsBytes,
      confirmationCallback
    )
  }

  async finalizeOffer(id, data, confirmationCallback) {
    const { adapter, listingIndex, offerIndex } = this.parseOfferId(id)

    const ipfsHash = await this.ipfsService.saveObjAsFile({ data })
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

  async addData(listingId, offerId, data, confirmationCallback) {
    const ipfsHash = await this.ipfsService.saveObjAsFile({ data })
    const ipfsBytes = this.contractService.getBytes32FromIpfsHash(ipfsHash)

    if (offerId) {
      const { adapter, listingIndex, offerIndex } = this.parseOfferId(offerId)
      return await adapter.addData(
        ipfsBytes,
        listingIndex,
        offerIndex,
        confirmationCallback
      )
    } else if (listingId) {
      const { adapter, listingIndex } = this.parseListingId(listingId)
      return await adapter.addData(
        ipfsBytes,
        listingIndex,
        null,
        confirmationCallback
      )
    }
  }

  // Convenience methods

  async getListingReviews(listingId) {
    const { adapter, listingIndex } = this.parseListingId(listingId)
    const listing = await adapter.getListing(listingIndex)
    const reviewEvents = listing.events.filter(
      e => e.event === 'OfferFinalized'
    )
    const reviews = []
    for (const event of reviewEvents) {
      const ipfsHash = this.contractService.getIpfsHashFromBytes32(
        event.returnValues.ipfsHash
      )
      const ipfsJson = await this.ipfsService.loadObjFromFile(ipfsHash)
      const timestamp = await this.contractService.getTimestamp(event)
      reviews.push({
        transactionHash: event.transactionHash,
        rating: ipfsJson.data.rating,
        reviewText: ipfsJson.data.reviewText,
        timestamp,
        reviewerAddress: event.returnValues.party
      })
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
