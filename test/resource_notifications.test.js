import Notifications from '../src/resources/notifications.js'
import Listings from '../src/resources/listings.js'
import Purchases from '../src/resources/purchases.js'
import IpfsService from '../src/services/ipfs-service.js'
import { expect } from 'chai'
import Web3 from 'web3'
import asAccount from './helpers/as-account'
import contractServiceHelper from './helpers/contract-service-helper'

const samplePrice = 1000000000000000

class StoreMock {
  constructor() {
    this.storage = {}
  }

  get(key) {
    return this.storage[key]
  }

  set(key, value) {
    this.storage[key] = value
  }
}

describe('Notification Resource', function() {
  this.timeout(5000) // default is 2000

  let notifications,
    accounts,
    storeMock,
    seller,
    buyer,
    listings,
    contractService,
    createListing,
    buyListing,
    sellerAccept,
    buyerFinalize,
    sellerFinalize,
    purchases

  beforeEach(async () => {
    const ipfsService = new IpfsService({
      ipfsDomain: '127.0.0.1',
      ipfsApiPort: '5002',
      ipfsGatewayPort: '8080',
      ipfsGatewayProtocol: 'http'
    })
    const provider = new Web3.providers.HttpProvider('http://localhost:8545')
    const web3 = new Web3(provider)
    contractService = await contractServiceHelper(web3)
    listings = new Listings({ ipfsService, contractService })
    purchases = new Purchases({ ipfsService, contractService })
    accounts = await web3.eth.getAccounts()
    seller = accounts[0]
    buyer = accounts[2]
    storeMock = new StoreMock()
    storeMock.set(
      'notification_subscription_start',
      new Date('2017-01-01').getTime()
    )
    notifications = new Notifications({
      contractService,
      listings,
      purchases,
      store: storeMock
    })

    createListing = async () => {
      await listings.create({
        listingType: 'unit',
        name: 'Sample Listing 1',
        priceWei: samplePrice,
        unitsAvailable: 1
      })
      const listingIds = await listings.allIds()
      return listingIds[listingIds.length - 1]
    }

    buyListing = async listingIndex => {
      return await asAccount(contractService.web3, buyer, async () => {
        await listings.requestPurchase(listingIndex, {}, samplePrice)
        const purchases = await listings.getPurchases(listingIndex)
        return purchases.length - 1
      })
    }

    sellerAccept = async (listingIndex, purchaseIndex) => {
      await purchases.acceptRequest(listingIndex, purchaseIndex, {})
    }

    buyerFinalize = async (listingIndex, purchaseIndex) => {
      await asAccount(contractService.web3, buyer, async () => {
        await purchases.buyerFinalize(listingIndex, purchaseIndex, {})
      })
    }

    sellerFinalize = async (listingIndex, purchaseIndex) => {
      await purchases.sellerFinalize(listingIndex, purchaseIndex, {})
    }
  })

  describe('all', () => {
    it('should return listing purchased notifications for seller', async () => {
      const listingIndex = await createListing()
      await buyListing(listingIndex)

      const for_seller = await notifications.all(seller)
      const listingPurchased = for_seller.filter(
        ({ type }) => type === 'seller_listing_purchased'
      )
      expect(listingPurchased.length).to.equal(1)
      expect(listingPurchased[0].id).to.exist
      expect(listingPurchased[0].status).to.equal('unread')
    })

    it('should return review received notifications for seller', async () => {
      const listingIndex = await createListing()
      const purchaseIndex = await buyListing(listingIndex)
      await sellerAccept(listingIndex, purchaseIndex)
      await buyerFinalize(listingIndex, purchaseIndex)

      const for_seller = await notifications.all(seller)
      const reviewReceived = for_seller.filter(
        ({ type }) => type === 'seller_review_received'
      )
      expect(reviewReceived.length).to.equal(1)
      expect(reviewReceived[0].id).to.exist
      expect(reviewReceived[0].status).to.equal('unread')
    })

    it('should return seller accepted notifications for buyer', async () => {
      const listingIndex = await createListing()
      const purchaseIndex = await buyListing(listingIndex)
      await sellerAccept(listingIndex, purchaseIndex)

      const for_buyer = await notifications.all(buyer)
      const reviewReceived = for_buyer.filter(
        ({ type }) => type === 'buyer_listing_shipped'
      )
      expect(reviewReceived.length).to.equal(1)
      expect(reviewReceived[0].id).to.exist
      expect(reviewReceived[0].status).to.equal('unread')
    })

    it('should return review received notifications for buyer', async () => {
      const listingIndex = await createListing()
      const purchaseIndex = await buyListing(listingIndex)
      await sellerAccept(listingIndex, purchaseIndex)
      await buyerFinalize(listingIndex, purchaseIndex)
      await sellerFinalize(listingIndex, purchaseIndex)

      const for_buyer = await notifications.all(buyer)
      const reviewReceived = for_buyer.filter(
        ({ type }) => type === 'buyer_review_received'
      )
      expect(reviewReceived.length).to.equal(1)
      expect(reviewReceived[0].id).to.exist
      expect(reviewReceived[0].status).to.equal('unread')
    })
  })

  describe('set', () => {
    it('should allow notifications to be marked as read', async () => {
      const listingIndex = await createListing()
      await buyListing(listingIndex)

      const all = await notifications.all(seller)
      expect(all[0].status).to.equal('unread')
      all[0].status = 'read'
      notifications.set(all[0])
      const updated = await notifications.all(seller)
      expect(updated[0].status).to.equal('read')
    })
  })
})
