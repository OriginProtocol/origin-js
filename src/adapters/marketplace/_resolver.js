import V00_MarkeplaceAdapter from './v00'
import V01_MarkeplaceAdapter from './v01'
import {
  parseListingId,
  parseOfferId,
  generateListingId,
  generateOfferId,
  generateNotificationId
} from '../../utils/id'
import {
  Notification,
  readStatus,
  unreadStatus,
  storeKeys
} from '../../models/notification'

class MarketplaceResolver {
  constructor({ contractService, store }) {
    this.adapters = {
      '000': new V00_MarkeplaceAdapter({ contractService, store }),
      '001': new V01_MarkeplaceAdapter({ contractService, store })
    }
    this.versions = ['000', '001']
    this.currentVersion = this.versions[this.versions.length - 1]
    this.currentAdapter = this.adapters[this.currentVersion]
    this.contractService = contractService
    this.store = store
  }

  async getListingsCount() {
    let total = 0
    for (const version of this.versions) {
      total += await this.adapters[version].getListingsCount()
    }
    return total
  }

  async getListingIds(opts = {}) {
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

    return listingIds
  }

  async getListing(listingId) {
    const { adapter, listingIndex } = this.parseListingId(listingId)
    return await adapter.getListing(listingIndex)
  }

  async getOfferIds(listingId, opts = {}) {
    const network = await this.contractService.web3.eth.net.getId()
    const { adapter, listingIndex, version } = this.parseListingId(listingId)
    const offers = await adapter.getOffers(listingIndex, opts)
    return offers.map(offerIndex => {
      return generateOfferId({ network, version, listingIndex, offerIndex })
    })
  }

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

    return { chainOffer, listingId }
  }

  async createListing(ipfsBytes, ipfsData, confirmationCallback) {
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

  async withdrawListing(listingId, ipfsBytes, confirmationCallback) {
    const { adapter, listingIndex } = this.parseListingId(listingId)

    return await adapter.withdrawListing(
      listingIndex,
      ipfsBytes,
      confirmationCallback
    )
  }

  async makeOffer(listingId, ipfsBytes, offerData, confirmationCallback) {
    const { adapter, listingIndex, version, network } = this.parseListingId(
      listingId
    )

    const transactionReceipt = await adapter.makeOffer(
      listingIndex,
      ipfsBytes,
      offerData,
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

  async withdrawOffer(id, ipfsBytes, confirmationCallback) {
    const { adapter, listingIndex, offerIndex } = this.parseOfferId(id)

    return await adapter.withdrawOffer(
      listingIndex,
      offerIndex,
      ipfsBytes,
      confirmationCallback
    )
  }

  async acceptOffer(id, ipfsBytes, confirmationCallback) {
    const { adapter, listingIndex, offerIndex } = this.parseOfferId(id)

    return await adapter.acceptOffer(
      listingIndex,
      offerIndex,
      ipfsBytes,
      confirmationCallback
    )
  }

  async finalizeOffer(id, ipfsBytes, confirmationCallback) {
    const { adapter, listingIndex, offerIndex } = this.parseOfferId(id)

    return await adapter.finalizeOffer(
      listingIndex,
      offerIndex,
      ipfsBytes,
      confirmationCallback
    )
  }

  async initiateDispute(offerId, ipfsBytes, confirmationCallback) {
    const { adapter, listingIndex, offerIndex } = this.parseOfferId(offerId)

    return await adapter.initiateDispute(
      listingIndex,
      offerIndex,
      ipfsBytes,
      confirmationCallback
    )
  }

  async resolveDispute(
    offerId,
    ipfsBytes,
    ruling,
    refund,
    confirmationCallback
  ) {
    const { adapter, listingIndex, offerIndex } = this.parseOfferId(offerId)

    return await adapter.resolveDispute(
      listingIndex,
      offerIndex,
      ipfsBytes,
      ruling,
      refund,
      confirmationCallback
    )
  }

  async addData(listingId, offerId, ipfsBytes, confirmationCallback) {
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
    } else {
      throw new Error(
        'addData must be called with either a listing or offer id.'
      )
    }
  }

  async getListingReviews(listingId) {
    const { adapter, listingIndex, version, network } = this.parseListingId(
      listingId
    )

    // Get all the OfferFinalized events for the listing.
    const listing = await adapter.getListing(listingIndex)
    const reviewEvents = listing.events.filter(
      e => e.event === 'OfferFinalized'
    )
    return Promise.all(
      reviewEvents.map(async event => {
        const offerIndex = event.returnValues.offerID
        const offerId = generateOfferId({
          network,
          version,
          listingIndex,
          offerIndex
        })
        // TODO(franck): Store the review timestamp in IPFS to avoid
        //               a call to the blockchain to get the event's timestamp.
        const timestamp = await this.contractService.getTimestamp(event)
        return Object.assign({ offerId, timestamp }, event)
      })
    )
  }

  async getNotifications(party) {
    const network = await this.contractService.web3.eth.net.getId()
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
        const timestamp = await this.contractService.getTimestamp(
          notification.event
        )
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

      notifications = notifications.concat(
        rawNotifications.map(rawNotification => {
          return new Notification(rawNotification)
        })
      )
    }
    return notifications
  }

  async getTokenAddress() {
    return await this.currentAdapter.getTokenAddress()
  }

  parseListingId(listingId) {
    const { version, network, listingIndex } = parseListingId(listingId)
    // use appropriate adapter for version
    const adapter = this.adapters[version]
    if (!adapter) {
      throw new Error(`Adapter not found for version ${version}`)
    }
    return { adapter, listingIndex, version, network }
  }

  parseOfferId(offerId) {
    const { version, network, listingIndex, offerIndex } = parseOfferId(offerId)
    // use appropriate adapter for version
    const adapter = this.adapters[version]
    if (!adapter) {
      throw new Error(`Adapter not found for version ${version}`)
    }
    return { adapter, listingIndex, offerIndex, version, network }
  }
}

module.exports = MarketplaceResolver
