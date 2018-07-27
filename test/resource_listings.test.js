import { expect } from 'chai'
import Listings from '../src/resources/listings.js'
import ContractService from '../src/services/contract-service'
import IpfsService from '../src/services/ipfs-service.js'
import Web3 from 'web3'
import asAccount from './helpers/as-account'
import fetchMock from 'fetch-mock'
import contractServiceHelper from './helpers/contract-service-helper'

const samplePrice = 1000000000000000

describe('Listing Resource', function() {
  this.timeout(5000) // default is 2000

  let listings
  let contractService
  let ipfsService
  let buyer

  before(async () => {
    const provider = new Web3.providers.HttpProvider('http://localhost:8545')
    const web3 = new Web3(provider)
    contractService = await contractServiceHelper(web3)
    ipfsService = new IpfsService({
      ipfsDomain: '127.0.0.1',
      ipfsApiPort: '5002',
      ipfsGatewayPort: '8080',
      ipfsGatewayProtocol: 'http'
    })
    listings = new Listings({ contractService, ipfsService })
    const accounts = await web3.eth.getAccounts()
    buyer = accounts[1]

    // Ensure that there are at least 2 sample listings
    await listings.create({
      listingType: 'unit',
      name: 'Sample 1',
      priceWei: samplePrice,
      unitsAvailable: 1
    })
    await listings.create({
      listingType: 'unit',
      name: 'Sample 2',
      priceWei: samplePrice,
      unitsAvailable: 1
    })
  })

  it('should get all listing ids', async () => {
    const ids = await listings.allIds()
    expect(ids.length).to.be.greaterThan(1)
  })

  it('should get a listing by index', async () => {
    await listings.create({
      listingType: 'unit',
      name: 'Foo Bar',
      priceWei: samplePrice,
      unitsAvailable: 1
    })
    const listingIds = await listings.allIds()
    const listing = await listings.get(listingIds[listingIds.length - 1])
    expect(listing.ipfsData.name).to.equal('Foo Bar')
  })

  it('should buy a listing', async () => {
    await listings.create({
      listingType: 'unit',
      name: 'Sample 1',
      priceWei: samplePrice,
      unitsAvailable: 1
    })
    const listingIds = await listings.allIds()
    const listingIndex = listingIds.length - 1
    await asAccount(contractService.web3, buyer, async () => {
      await listings.requestPurchase(listingIndex, { foo: 'bar' }, 1)
    })
  })

  describe('all', () => {
    it('should get all listings', async () => {
      const fetch = fetchMock.sandbox().mock(
        (requestUrl, opts) => {
          expect(opts.method).to.equal('GET')
          expect(requestUrl).to.equal('http://hello.world/api/listing')
          return true
        },
        {
          body: JSON.stringify({
            objects: [
              {
                contract_address: '0x4E205e04A1A8f230702fe51f3AfdCC38aafB0f3C',
                created_at: null,
                expires_at: null,
                ipfs_hash: 'QmfXRgtSbrGggApvaFCa88ofeNQP79G18DpWaSW1Wya1u8',
                price: '0.30',
                owner_address: '0x627306090abaB3A6e1400e9345bC60c78a8BEf57',
                units: 23,
                ipfs_data: {
                  name: "Taylor Swift's Reputation Tour",
                  category: 'Music',
                  description:
                    "Taylor Swift's Reputation Stadium Tour is the fifth world concert tour by American singer-songwriter Taylor Swift, in support of her sixth studio album, Reputation.",
                  location:
                    'Sports Authority Field at Mile High, Denver, CO, USA'
                }
              }
            ]
          })
        }
      )
      const listings = new Listings({
        contractService,
        ipfsService,
        fetch,
        indexingServerUrl: 'http://hello.world/api'
      })
      const all = await listings.all()
      expect(all.length).to.equal(1)
      const first = all[0]
      expect(first.address).to.equal(
        '0x4E205e04A1A8f230702fe51f3AfdCC38aafB0f3C'
      )
      expect(first.name).to.equal("Taylor Swift's Reputation Tour")
      expect(first.price).to.equal(0.3)
    })
  })

  describe('create', () => {
    it('should create a listing', async () => {
      const listingData = {
        listingType: 'unit',
        name: '1972 Geo Metro 255K',
        category: 'Cars & Trucks',
        location: 'New York City',
        description:
          'The American auto-show highlight reel will be disproportionately concentrated on the happenings in New York.',
        pictures: undefined,
        priceWei: samplePrice,
        unitsAvailable: 1
      }
      await listings.create(listingData)
      // Todo: Check that this worked after we have web3 approvals working
    })

    it('should create a fractional listing', async () => {
      const listingData = {
        listingType: 'fractional',
        name: '1972 Geo Metro 255K',
        category: 'Cars & Trucks',
        location: 'New York City',
        description:
          'The American auto-show highlight reel will be disproportionately concentrated on the happenings in New York.',
        pictures: undefined,
        priceWei: samplePrice
      }
      await listings.create(listingData)
    })
  })

  describe('Getting purchases', async () => {
    let listing, listingIndex
    before(async () => {
      await listings.create({
        listingType: 'unit',
        name: 'Sample 1',
        priceWei: samplePrice,
        unitsAvailable: 1
      })
      const listingIds = await listings.allIds()
      listing = await listings.getByIndex(listingIds[listingIds.length - 1])
      const ids = await listings.allIds()
      listingIndex = ids[ids.length - 1]
      await asAccount(contractService.web3, buyer, async () => {
        await listings.requestPurchase(listingIndex, { foo: 'bar' }, 1)
      })
    })

    it('should get purchases', async () => {
      const listingPurchases = await listings.getPurchases(listingIndex)
      expect(listingPurchases.length).to.equal(1)
      expect(listingPurchases[0].stage).to.equal('BUYER_REQUESTED')
      expect(JSON.stringify(listingPurchases[0].ipfsData)).to.equal(
        JSON.stringify({ foo: 'bar' })
      )
    })
  })

  describe('update', () => {
    it('should be able to update a listing', async () => {
      await listings.create({
        listingType: 'unit',
        name: 'Sample 1',
        priceWei: samplePrice,
        unitsAvailable: 1
      })
      const ids = await listings.allIds()
      const listingIndex = ids[ids.length - 1]
      const initialListing = await listings.get(listingIndex)
      expect(initialListing.ipfsData.name).to.equal('Sample 1')

      await listings.update(listingIndex, { name: 'foo bar' })
      const updatedListing = await listings.get(listingIndex)
      expect(updatedListing.ipfsData.name).to.equal('foo bar')
    })
  })
})
