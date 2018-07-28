import { expect } from 'chai'
import Listings from '../src/resources/listings.js'
import Purchase from '../src/resources/purchases.js'
import Review from '../src/resources/reviews.js'
import ContractService from '../src/services/contract-service'
import IpfsService from '../src/services/ipfs-service.js'
import Web3 from 'web3'
import asAccount from './helpers/as-account'
import fetchMock from 'fetch-mock'
import contractServiceHelper from './helpers/contract-service-helper'

const samplePrice = 1000000000000000
const unitPurchaseData = {
  priceWei: samplePrice,
  units: 1,
  purchaseType: 'unit'
}
const fractionalPurchaseData = {
  priceWei: samplePrice,
  purchaseType: 'fractional'
}

describe('Purchase Resource', function() {
  this.timeout(5000) // default is 2000

  let listings
  let listingIndex
  let listing
  let purchases
  let purchase
  let reviews
  let contractService
  let ipfsService
  let web3
  let buyer

  before(async () => {
    const provider = new Web3.providers.HttpProvider('http://localhost:8545')
    web3 = new Web3(provider)
    contractService = await contractServiceHelper(web3)
    ipfsService = new IpfsService({
      ipfsDomain: '127.0.0.1',
      ipfsApiPort: '5002',
      ipfsGatewayPort: '8080',
      ipfsGatewayProtocol: 'http'
    })
    listings = new Listings({ contractService, ipfsService })
    purchases = new Purchase({ contractService, ipfsService })
    reviews = new Review({ contractService, ipfsService })
    const accounts = await web3.eth.getAccounts()
    buyer = accounts[1]
  })

  const reloadPurchase = async function() {
    purchase = await purchases.get(listingIndex, 0)
  }

  const resetUnitListingAndPurchase = async () => {
    // Create a new listing and a new purchase for the tests to use.
    const listingData = {
      listingType: 'unit',
      name: 'Australorp Rooser',
      category: 'For Sale',
      location: 'Atlanta, GA',
      description:
        'Peaceful and dignified, Australorps are an absolutely delightful bird which we highly recommend to anyone who wants a pet chicken that lays dependably.',
      priceWei: samplePrice,
      unitsAvailable: 1
    }
    await listings.create(listingData)
    const listingIds = await listings.allIds()
    listingIndex = listingIds[listingIds.length - 1]

    // Buy listing to create a purchase
    await asAccount(contractService.web3, buyer, async () => {
      return await listings.requestPurchase(
        listingIndex,
        unitPurchaseData,
        samplePrice
      )
    })
    await reloadPurchase()
  }

  const resetFractionalListingAndPurchase = async () => {
    // Create a new listing and a new purchase for the tests to use.
    const listingData = {
      listingType: 'fractional',
      name: 'Australorp Rooser',
      category: 'For Sale',
      location: 'Atlanta, GA',
      description:
        'Peaceful and dignified, Australorps are an absolutely delightful bird which we highly recommend to anyone who wants a pet chicken that lays dependably.',
      priceWei: samplePrice
    }
    await listings.create(listingData)
    const listingIds = await listings.allIds()
    listingIndex = listingIds[listingIds.length - 1]

    // Buy listing to create a purchase
    await asAccount(contractService.web3, buyer, async () => {
      return await listings.requestPurchase(
        listingIndex,
        fractionalPurchaseData,
        samplePrice
      )
    })
    await reloadPurchase()
  }

  const expectStage = function(expectedStage) {
    expect(purchase.stage).to.equal(expectedStage)
  }

  describe('simple purchase flow: unit listing', async () => {
    const purchaseIndex = 0

    before(async () => {
      await resetUnitListingAndPurchase()
    })

    it('should get a purchase', async () => {
      expectStage('BUYER_REQUESTED')
      expect(purchase.buyer).to.equal(buyer)
    })

    it('should allow the seller to accept', async () => {
      expectStage('BUYER_REQUESTED')
      await purchases.acceptRequest(listingIndex, purchaseIndex, { foo: 'bar' })
      await reloadPurchase()
      expectStage('SELLER_ACCEPTED')
    })

    it('should allow the buyer to mark a purchase received', async () => {
      expectStage('SELLER_ACCEPTED')
      await asAccount(contractService.web3, buyer, async () => {
        await purchases.buyerFinalize(listingIndex, purchaseIndex, {
          rating: 3
        })
      })
      await reloadPurchase()
      expectStage('BUYER_FINALIZED')
    })

    it('should allow the seller to collect money', async () => {
      expectStage('BUYER_FINALIZED')
      await purchases.sellerFinalize(listingIndex, purchaseIndex, { rating: 4 })
      await reloadPurchase()
    })

    it('should list logs', async () => {
      const logs = await purchases.getLogs(listingIndex, purchaseIndex)
      expect(logs[0].stage).to.equal('BUYER_REQUESTED')
      expect(logs[1].stage).to.equal('SELLER_ACCEPTED')
      expect(logs[2].stage).to.equal('BUYER_FINALIZED')
      expect(logs[3].stage).to.equal('SELLER_FINALIZED')
    })
  })

  describe('simple purchase flow: fractional listing', async () => {
    const purchaseIndex = 0

    before(async () => {
      await resetFractionalListingAndPurchase()
    })

    it('should get a purchase', async () => {
      expectStage('BUYER_REQUESTED')
      expect(purchase.buyer).to.equal(buyer)
    })

    it('should allow the seller to accept', async () => {
      expectStage('BUYER_REQUESTED')
      await purchases.acceptRequest(listingIndex, purchaseIndex, { foo: 'bar' })
      await reloadPurchase()
      expectStage('SELLER_ACCEPTED')
    })

    it('should allow the buyer to mark a purchase received', async () => {
      expectStage('SELLER_ACCEPTED')
      await asAccount(contractService.web3, buyer, async () => {
        await purchases.buyerFinalize(listingIndex, purchaseIndex, {
          rating: 3
        })
      })
      await reloadPurchase()
      expectStage('BUYER_FINALIZED')
    })

    it('should allow the seller to collect money', async () => {
      expectStage('BUYER_FINALIZED')
      await purchases.sellerFinalize(listingIndex, purchaseIndex, { rating: 4 })
      await reloadPurchase()
    })

    it('should list logs', async () => {
      const logs = await purchases.getLogs(listingIndex, purchaseIndex)
      expect(logs[0].stage).to.equal('BUYER_REQUESTED')
      expect(logs[1].stage).to.equal('SELLER_ACCEPTED')
      expect(logs[2].stage).to.equal('BUYER_FINALIZED')
      expect(logs[3].stage).to.equal('SELLER_FINALIZED')
    })
  })

  describe('all', () => {
    it('should get all purchases', async () => {
      const fetch = fetchMock.sandbox().mock(
        (requestUrl, opts) => {
          expect(opts.method).to.equal('GET')
          expect(requestUrl).to.equal('http://hello.world/api/purchase')
          return true
        },
        {
          body: JSON.stringify({
            objects: [
              {
                contract_address: '0xefb3fd7f9260874d8afd7cb4b42183babea0ca1b',
                stage: 'in_escrow',
                listing_address: '0x05a52d9a9e9e91c6932ec2af7bf0c127660fa181',
                buyer_address: '0x627306090abab3a6e1400e9345bc60c78a8bef57',
                created_at: 1524492517,
                buyer_timeout: 0
              }
            ]
          })
        }
      )
      const purchases = new Purchase({
        contractService,
        ipfsService,
        fetch,
        indexingServerUrl: 'http://hello.world/api'
      })
      const all = await purchases.all()
      expect(all.length).to.equal(1)
      const first = all[0]
      expect(first.address).to.equal(
        '0xefb3fd7f9260874d8afd7cb4b42183babea0ca1b'
      )
      expectStage('SELLER_FINALIZED')
    })
  })
})
