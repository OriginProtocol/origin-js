const EvolvingRegistry = artifacts.require('./EvolvingRegistry.sol')
const Listings = artifacts.require('./V01_Listings.sol')

const ipfsHash_1 =
  '0x6b14cac30356789cd0c39fec0acc2176c3573abdb799f3b17ccc6972ab4d39ba'
const ipfsHash_2 =
  '0xab92c0500ba26fa6f5244f8ba54746e15dd455a7c99a67f0e8f8868c8fab4a1a'

const zeroAddress = '0x0000000000000000000000000000000000000000'

contract('Listings', accounts => {
  const deployer = accounts[0]
  const seller = accounts[1]
  const buyer = accounts[2]
  let listings

  beforeEach(async function() {
    const evolvingRegistry = await EvolvingRegistry.new({ from: deployer })
    listings = await Listings.new(evolvingRegistry.address, { from: deployer })
    await evolvingRegistry.addEntryType(listings.address, 'listings', {
      from: deployer
    })
    await listings.createListing(ipfsHash_1, { from: seller })
  })

  describe('update', () => {
    it('should update the ipfs hash', async function() {
      const [, originalIpfsHash] = await listings.getListing(0)
      await listings.updateListing(0, 0, ipfsHash_2, { from: seller })
      const [, newIpfsHash] = await listings.getListing(0)
      assert.equal(originalIpfsHash, ipfsHash_1)
      assert.equal(newIpfsHash, ipfsHash_2)
    })
  })

  describe('getListingVersion', () => {
    it('should reflect the current version of the contract (0-indexed)', async function() {
      const originalVersion = await listings.getListingVersion(0)
      await listings.updateListing(0, 0, ipfsHash_2, { from: seller })
      const newVersion = await listings.getListingVersion(0)
      assert.equal(originalVersion, 0)
      assert.equal(newVersion, 1)
    })
  })

  describe('getListing', () => {
    it('should return the listing data for the specified version', async function() {
      const [
        listingSeller,
        ipfsHash,
        purchasesLength
      ] = await listings.getListing(0)
      assert.equal(listingSeller, seller)
      assert.equal(ipfsHash, ipfsHash_1)
      assert.equal(purchasesLength, 0)
    })
  })

  describe('requestPurchase', () => {
    it('should create a purchase', async function() {
      await listings.requestPurchase(0, ipfsHash_1, {
        from: buyer,
        value: 6
      })
      const [stage, listingBuyer, escrowContract] = await listings.getPurchase(
        0,
        0
      )
      assert.equal(stage, 0)
      assert.equal(listingBuyer, buyer)
      assert.ok(escrowContract)
      assert.notEqual(escrowContract, zeroAddress)
    })
  })
})
