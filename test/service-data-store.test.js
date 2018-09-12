import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import sinon from 'sinon'

import {
  IpfsDataStore,
  BASE_SCHEMA_URL,
  LISTING_CREATED_DATA_TYPE,
  OFFER_CREATED_DATA_TYPE,
  REVIEW_DATA_TYPE
} from '../src/services/data-store-service'
import listingValid from './fixtures/listing-valid.json'
import offerValid from './fixtures/offer-valid.json'
import reviewValid from './fixtures/review-valid.json'

// oddly changing an imported object here can affect other or subsequent tests that import the same file
const goodListing = Object.assign({}, listingValid)
const goodOffer = Object.assign({}, offerValid)
const goodReview = Object.assign({}, reviewValid)

chai.use(chaiAsPromised)
const expect = chai.expect

describe('IpfsDataStore', () => {
  it(`Should parse a valid schemaId`, () => {
    const { dataType, schemaVersion } = IpfsDataStore.parseSchemaId(
      BASE_SCHEMA_URL+'my-data-type_v1.0.0')
    expect(dataType).to.equal('my-data-type')
    expect(schemaVersion).to.equal('1.0.0')
  })

  it(`Should generate a valid schemaId`, () => {
    const { schemaId, schemaVersion } = IpfsDataStore.generateSchemaId('my-data-type')
    expect(schemaId).to.equal(BASE_SCHEMA_URL+'my-data-type_v1.0.0')
    expect(schemaVersion).to.equal('1.0.0')
  })
})

describe('ListingCreated IpfsDataStore load', () => {
  let mockIpfsService, store

  before(() => {
    mockIpfsService = new Object()
    store = new IpfsDataStore(mockIpfsService)
  })

  it(`Should load a valid object`, async () => {
    mockIpfsService.loadObjFromFile = sinon
      .stub()
      .resolves(Object.assign({}, goodListing))
    mockIpfsService.rewriteUrl = sinon.stub().returns('http://test-gateway')

    const listing = await store.load(LISTING_CREATED_DATA_TYPE, 'TestHash')

    expect(listing.type).to.equal('unit')
    expect(listing.category).to.equal('ForSale')
    expect(listing.subCategory).to.equal('Mushrooms')
    expect(listing.language).to.equal('en-US')
    expect(listing.title).to.equal('my listing')
    expect(listing.description).to.equal('my description')
    expect(listing.expiry).to.equal('1996-12-19T16:39:57-08:00')
    expect(listing.media.length).to.equal(2)
    expect(listing.media[0].url).to.equal('http://test-gateway')
    expect(listing.unitsTotal).to.equal(1)
    expect(listing.price).to.deep.equal({ amount: '200', currency: 'ETH' })
    expect(listing.commission).to.deep.equal({ amount: '10', currency: 'OGN' })
    expect(listing.securityDeposit).to.deep.equal({
      amount: '100',
      currency: 'ETH'
    })
    expect(listing.ipfs.hash).to.equal('TestHash')
    expect(listing.ipfs.data).to.deep.equal(goodListing)
  })

  it(`Should throw an exception on listing using invalid schema Id`, () => {
    const listingInvalidSchemaId = Object.assign({}, goodListing, {
      schemaId: 'badSchemaId'
    })
    mockIpfsService.loadObjFromFile = sinon
      .stub()
      .resolves(listingInvalidSchemaId)

    expect(store.load(LISTING_CREATED_DATA_TYPE, 'TestHash')).to.eventually.be.rejectedWith(Error)
  })

  it(`Should throw an exception on listing data with missing fields`, () => {
    const badListing = { title: 'bad listing' }
    mockIpfsService.loadObjFromFile = sinon.stub().resolves(badListing)

    expect(store.load(LISTING_CREATED_DATA_TYPE, 'TestHash')).to.eventually.be.rejectedWith(Error)
  })
})

describe('ListingCreated IpfsDataStore save', () => {
  let mockIpfsService, store

  before(() => {
    mockIpfsService = new Object()
    store = new IpfsDataStore(mockIpfsService)
  })

  it(`Should save a valid object with IPFS URLs`, () => {
    mockIpfsService.saveObjAsFile = sinon.stub().returns('ListingHash')
    mockIpfsService.saveDataURIAsFile = sinon.stub().returns('DataHash')
    mockIpfsService.gatewayUrlForHash = sinon
      .stub()
      .returns('http://test-gateway')

    expect(store.save(LISTING_CREATED_DATA_TYPE, goodListing)).to.eventually.equal('ListingHash')

    expect(mockIpfsService.saveDataURIAsFile.callCount).to.equal(0)
    expect(mockIpfsService.gatewayUrlForHash.callCount).to.equal(0)
  })

  it(`Should save a valid listing with data`, async () => {
    mockIpfsService.saveObjAsFile = sinon.stub().returns('ListingHash')
    mockIpfsService.saveDataURIAsFile = sinon.stub().returns('DataHash')
    mockIpfsService.gatewayUrlForHash = sinon
      .stub()
      .returns('http://test-gateway')

    const media = {
      media: [
        { url: 'data:image/jpeg;name=test1.jpg;base64,/AA/BB' },
        { url: 'data:image/jpeg;name=test2.jpg;base64,/CC/DD' }
      ]
    }
    const listing = Object.assign({}, goodListing, media)
    const ipfsHash = await store.save(LISTING_CREATED_DATA_TYPE, listing)

    expect(ipfsHash).to.equal('ListingHash')

    // Check the media content was saved as separate IPFS files.
    expect(mockIpfsService.saveDataURIAsFile.callCount).to.equal(2)

    // Check the URL for media content is an IPFS URL.
    const ipfsData = mockIpfsService.saveObjAsFile.firstCall.args[0]
    expect(ipfsData.media[0].url.substring(0, 7)).to.equal('ipfs://')
    expect(ipfsData.media[1].url.substring(0, 7)).to.equal('ipfs://')
  })

  it(`Should filter out invalid media`, async () => {
    mockIpfsService.saveObjAsFile = sinon.stub().returns('ListingHash')
    const media = {
      media: [
        { url: 'bogus://' }, // Invalid data field.
        { url: 'http://notallowed' } // Only ipfs and dwed URL are allowed.
      ]
    }
    const listing = Object.assign({}, goodListing, media)
    await store.save(LISTING_CREATED_DATA_TYPE, listing)

    // Check all the entries were filtered out in the listing data saved to IPFS.
    const ipfsData = mockIpfsService.saveObjAsFile.firstCall.args[0]
    expect(ipfsData.media.length).to.equal(0)
  })

  it(`Should throw an exception on invalid listing`, async () => {
    const badListing = { title: 'bad listing' }
    expect(store.save(
      LISTING_CREATED_DATA_TYPE,
      badListing)).to.eventually.be.rejectedWith(Error)
  })
})

describe('OfferCreated IpfsStore load', () => {
  let mockIpfsService, store

  before(() => {
    mockIpfsService = new Object()
    store = new IpfsDataStore(mockIpfsService)
  })

  it(`Should load a valid object`, async () => {
    mockIpfsService.loadObjFromFile = sinon.stub().resolves(goodOffer)
    mockIpfsService.rewriteUrl = sinon.stub().returns('http://test-gateway')

    const offer = await store.load(OFFER_CREATED_DATA_TYPE, 'TestHash')

    expect(offer.listingType).to.equal('unit')
    expect(offer.unitsPurchased).to.equal(1)
    expect(offer.totalPrice).to.deep.equal({ amount: '0.033', currency: 'ETH' })
    expect(offer.ipfs.hash).to.equal('TestHash')
    expect(offer.ipfs.data).to.deep.equal(goodOffer)
  })

  it(`Should throw an exception on offer using invalid schema Id`, () => {
    const offerInvalidSchemaId = Object.assign({}, goodReview, {
      schemaId: 'badSchemaId'
    })
    mockIpfsService.loadObjFromFile = sinon
      .stub()
      .resolves(offerInvalidSchemaId)

    expect(store.load(OFFER_CREATED_DATA_TYPE, 'TestHash')).to.eventually.be.rejectedWith(Error)
  })

  it(`Should throw an exception on offer data with missing fields`, () => {
    const badOffer = { title: 'bad offer' }
    mockIpfsService.loadObjFromFile = sinon.stub().resolves(badOffer)

    expect(store.load(OFFER_CREATED_DATA_TYPE, 'TestHash')).to.eventually.be.rejectedWith(Error)
  })
})

describe('OfferCreated IpfsStore save', () => {
  let mockIpfsService, store

  before(() => {
    mockIpfsService = new Object()
    store = new IpfsDataStore(mockIpfsService)
  })

  it(`Should save a valid offer`, () => {
    mockIpfsService.saveObjAsFile = sinon.stub().returns('OfferHash')
    mockIpfsService.saveDataURIAsFile = sinon.stub().returns('DataHash')
    mockIpfsService.gatewayUrlForHash = sinon
      .stub()
      .returns('http://test-gateway')

    expect(store.save(
      OFFER_CREATED_DATA_TYPE,
      goodOffer)).to.eventually.equal('OfferHash')
  })

  it(`Should throw an exception on invalid offer`, async () => {
    const badOffer = { title: 'bad offer' }
    expect(store.save(
      OFFER_CREATED_DATA_TYPE,
      badOffer)).to.eventually.be.rejectedWith(Error)
  })
})

describe('Review IpfsDateStore load', () => {
  let mockIpfsService, store

  before(() => {
    mockIpfsService = new Object()
    store = new IpfsDataStore(mockIpfsService)
  })

  it(`Should load a valid object`, async () => {
    mockIpfsService.loadObjFromFile = sinon.stub().resolves(goodReview)
    mockIpfsService.rewriteUrl = sinon.stub().returns('http://test-gateway')

    const review = await store.load(REVIEW_DATA_TYPE, 'TestHash')

    expect(review.rating).to.equal(3)
    expect(review.text).to.equal('Good stuff')
    expect(review.ipfs.hash).to.equal('TestHash')
    expect(review.ipfs.data).to.deep.equal(goodReview)
  })

  it(`Should throw an exception on review using invalid schema Id`, () => {
    const reviewInvalidSchemaId = Object.assign({}, goodReview, {
      schemaId: 'badSchemaId'
    })
    mockIpfsService.loadObjFromFile = sinon
      .stub()
      .resolves(reviewInvalidSchemaId)

    expect(store.load(REVIEW_DATA_TYPE, 'TestHash')).to.eventually.be.rejectedWith(Error)
  })

  it(`Should throw an exception on review data with missing fields`, () => {
    const badReview = { title: 'bad review' }
    mockIpfsService.loadObjFromFile = sinon.stub().resolves(badReview)

    expect(store.load(REVIEW_DATA_TYPE, 'TestHash')).to.eventually.be.rejectedWith(Error)
  })
})

describe('Review IpfsDataStore save', () => {
  let mockIpfsService, store

  before(() => {
    mockIpfsService = new Object()
    store = new IpfsDataStore(mockIpfsService)
  })

  it(`Should save a valid review`, () => {
    mockIpfsService.saveObjAsFile = sinon.stub().returns('ReviewHash')
    mockIpfsService.saveDataURIAsFile = sinon.stub().returns('DataHash')
    mockIpfsService.gatewayUrlForHash = sinon
      .stub()
      .returns('http://test-gateway')

    expect(store.save(
      REVIEW_DATA_TYPE,
      goodReview)).to.eventually.equal('ReviewHash')
  })

  it(`Should throw an exception on invalid review`, async () => {
    const badReview = { title: 'bad review' }
    expect(store.save(
      REVIEW_DATA_TYPE,
      badReview)).to.eventually.be.rejectedWith(Error)
  })
})
