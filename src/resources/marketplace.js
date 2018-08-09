import { generateListingId, generateOfferId } from '../utils/id'
import { validateListing } from '../utils/schemaValidators'

import Adaptable from './adaptable'

class Marketplace extends Adaptable {
  constructor({ contractService, ipfsService, fetch, indexingServerUrl }) {
    super(...arguments)
    this.contractService = contractService
    this.ipfsService = ipfsService
    this.indexingServerUrl = indexingServerUrl
    this.fetch = fetch
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
    console.log(opts)
    for (const version of this.versions) {
      const listingIndexes = await this.adapters[version].getListings(opts)
      listingIndexes.forEach(listingIndex => {
        listingIds.unshift(generateListingId({ version, network, listingIndex }))
      })
    }

    if (opts.idsOnly) {
      return listingIds
    }

    // TODO: return full listings with data
    return listingIds
  }

  async getListing(listingId) {
    const { adapter, listingIndex } = this.parseListingId(listingId)
    const listing = await adapter.getListing(listingIndex)

    const ipfsHash = this.contractService.getIpfsHashFromBytes32(listing.ipfsHash)
    const ipfsJson = await this.ipfsService.getFile(ipfsHash)

    return Object.assign({}, listing, { id: listingId, ipfsData: ipfsJson || {} })
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
      return await Promise.all(offerIds.map(offerId => {
        return this.getOffer(offerId)
      }))
    }
  }

  async getOffer(offerId) {
    const { adapter, listingIndex, offerIndex, version, network } = this.parseOfferId(offerId)
    const offer = await adapter.getOffer(listingIndex, offerIndex)

    const ipfsHash = this.contractService.getIpfsHashFromBytes32(offer.ipfsHash)
    const ipfsJson = await this.ipfsService.getFile(ipfsHash)
    const listingId = generateListingId({ version, network, listingIndex })

    // Use data from IPFS is offer no longer in active blockchain state
    if (offer.buyer.indexOf('0x00000') === 0 && ipfsJson.data && ipfsJson.data.buyer) {
      offer.buyer = ipfsJson.data.buyer
    }

    return Object.assign({}, offer, { id: offerId, ipfsData: ipfsJson || {}, listingId })
  }

  async createListing(ipfsData) {
    validateListing(ipfsData)

    const ipfsHash = await this.ipfsService.submitFile({ data: ipfsData })
    const ipfsBytes = this.contractService.getBytes32FromIpfsHash(ipfsHash)

    return await this.currentAdapter.createListing(ipfsBytes, ipfsData)
  }

  // updateListing(listingId, data) {}
  // withdrawListing(listingId, data) {}

  async makeOffer(listingId, data) {
    const { adapter, listingIndex } = this.parseListingId(listingId)

    const buyer = await this.contractService.currentAccount()

    data.price = this.contractService.web3.utils.toWei(String(data.price), 'ether')
    data.buyer = buyer

    const ipfsHash = await this.ipfsService.submitFile({ data })
    const ipfsBytes = this.contractService.getBytes32FromIpfsHash(ipfsHash)

    return await adapter.makeOffer(listingIndex, ipfsBytes, data)
  }

  // updateOffer(listingId, offerId, data) {}
  // withdrawOffer(listingId, offerId, data) {}

  async acceptOffer(id, data, confirmationCallback) {
    const { adapter, listingIndex, offerIndex } = this.parseOfferId(id)

    const ipfsHash = await this.ipfsService.submitFile({ data })
    const ipfsBytes = this.contractService.getBytes32FromIpfsHash(ipfsHash)

    return await adapter.acceptOffer(listingIndex, offerIndex, ipfsBytes, confirmationCallback)
  }

  async finalizeOffer(id, data, confirmationCallback) {
    const { adapter, listingIndex, offerIndex } = this.parseOfferId(id)

    const ipfsHash = await this.ipfsService.submitFile({ data })
    const ipfsBytes = this.contractService.getBytes32FromIpfsHash(ipfsHash)

    return await adapter.finalizeOffer(listingIndex, offerIndex, ipfsBytes, confirmationCallback)
  }

  // setOfferRefund(listingId, offerId, data) {}

  // initiateDispute(listingId, offerId) {}
  // disputeRuling(listingId, offerId, data) {}
  // manageListingDeposit(listingId, data) {}

  async addData(listingId, offerId, data, confirmationCallback) {
    const ipfsHash = await this.ipfsService.submitFile({ data })
    const ipfsBytes = this.contractService.getBytes32FromIpfsHash(ipfsHash)

    if (offerId) {
      const { adapter, listingIndex, offerIndex } = this.parseOfferId(offerId)
      return await adapter.addData(ipfsBytes, listingIndex, offerIndex, confirmationCallback)
    } else if (listingId) {
      const { adapter, listingIndex } = this.parseListingId(listingId)
      return await adapter.addData(ipfsBytes, listingIndex, null, confirmationCallback)
    }
  }
}

module.exports = Marketplace
