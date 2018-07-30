import Listings from '../src/resources/listings.js'
import Purchase from '../src/resources/purchases.js'
import Reviews from '../src/resources/reviews'
import IpfsService from '../src/services/ipfs-service'
import { expect } from 'chai'
import Web3 from 'web3'
import asAccount from './helpers/as-account'
import contractServiceHelper from './helpers/contract-service-helper'

const samplePrice = 1000000000000000
const listingData = {
  priceWei: samplePrice,
  unitsAvailable: 1,
  listingType: 'unit',
  name: 'Foo Bar'
}
const purchaseData = {
  priceWei: samplePrice,
  units: 1,
  purchaseType: 'unit'
}
const reviewData_1 = {
  rating: 2,
  description: 'lol'
}
const reviewData_2 = {
  rating: 5,
  description: 'omg wat'
}

describe('Review Resource', function() {
  this.timeout(5000) // default is 2000

  let reviews,
    accounts,
    buyer,
    contractService,
    listings,
    listingIndex,
    purchases,
    purchaseIndex

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
    accounts = await web3.eth.getAccounts()
    buyer = accounts[2]
    listings = new Listings({ contractService, ipfsService })
    purchases = new Purchase({ contractService, ipfsService })
    reviews = new Reviews({ contractService, ipfsService })

    await listings.create(listingData)
    const listingIds = await listings.allIds()
    listingIndex = listingIds[listingIds.length - 1]

    await asAccount(contractService.web3, buyer, async () => {
      return await listings.requestPurchase(
        listingIndex,
        purchaseData,
        samplePrice
      )
    })

    const listingPurchases = await listings.getPurchases(listingIndex)
    purchaseIndex = listingPurchases.length - 1
    await purchases.acceptRequest(listingIndex, purchaseIndex, {})
  })

  describe('find', () => {
    it('should return review data', async () => {
      await asAccount(contractService.web3, buyer, async () => {
        return await purchases.buyerFinalize(
          listingIndex,
          purchaseIndex,
          reviewData_1
        )
      })
      let results = await reviews.find({
        listingId: listingIndex,
        purchaseId: purchaseIndex
      })
      expect(results.fromBuyer.ipfsData.description).to.equal('lol')

      await purchases.sellerFinalize(listingIndex, purchaseIndex, reviewData_2)
      results = await reviews.find({
        listingId: listingIndex,
        purchaseId: purchaseIndex
      })
      expect(results.fromSeller.ipfsData.description).to.equal('omg wat')
    })
  })
})
