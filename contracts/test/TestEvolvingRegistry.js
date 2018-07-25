const EvolvingRegistry = artifacts.require('./EvolvingRegistry.sol')
const Listings = artifacts.require('V01_Listings.sol')

const IPFS_HASH =
  '0x6b14cac30356789cd0c39fec0acc2176c3573abdb799f3b17ccc6972ab4d39ba'

contract('EvolvingRegistry', accounts => {
  const owner = accounts[0]
  const seller = accounts[1]
  const stranger = accounts[2]
  const secondOwner = accounts[3]

  describe('Ownership', async () => {
    let registry
    beforeEach(async () => {
      registry = await EvolvingRegistry.new({ from: owner })
    })

    it('should have an owner', async function() {
      assert.equal(await registry.owner(), owner)
    })
    it('should transfer ownership to a different owner', async function() {
      await registry.transferOwnership(secondOwner, { from: owner })
      assert.equal(await registry.owner(), secondOwner)
    })
    it('should not allow a stranger to transfer ownership', async function() {
      try {
        await registry.transferOwnership(secondOwner, { from: stranger })
      } catch (e) {
        assert.equal(await registry.owner(), owner)
        return
      }
      assert(false, 'should not allow ownership transfer')
    })
  })

  describe('EntryType', async () => {
    let registry
    let listingsA

    beforeEach(async () => {
      registry = await EvolvingRegistry.new({ from: owner })
      listingsA = await Listings.new(registry.address, { from: owner })
      await registry.addEntryType(listingsA.address, 'Listings_V0', {
        from: owner
      })
    })

    it('should add an entry type', async () => {
      const listingType = await registry.getEntryType(0)
      assert.equal(listingType[0], listingsA.address)
      assert.equal(listingType[1], 'Listings_V0')
      assert.equal(listingType[2], true)
    })
    it('should enable an entry type', async () => {
      let listingType
      // Disable the type
      await registry.disableEntryType(0, { from: owner })
      listingType = await registry.getEntryType(0)
      assert.equal(listingType[2], false)
      // Renable it
      await registry.enableEntryType(0, { from: owner })
      listingType = await registry.getEntryType(0)
      assert.equal(listingType[2], true)
    })
    it('should disable an entry type', async () => {
      await registry.disableEntryType(0, { from: owner })
      const listingType = await registry.getEntryType(0)
      assert.equal(listingType[2], false)
    })
    it('should rename an entry type', async () => {
      await registry.renameEntryType(0, 'FooBar', { from: owner })
      const listingType = await registry.getEntryType(0)
      assert.equal(listingType[1], 'FooBar')
    })
  })

  describe('Adding Entries', async () => {
    beforeEach(async () => {
      registry = await EvolvingRegistry.new({ from: owner })
      listingsA = await Listings.new(registry.address, { from: owner })
      await registry.addEntryType(listingsA.address, 'Listings_A', {
        from: owner
      })
    })
    it('should add an entry', async () => {
      listingsA.createListing(IPFS_HASH, { from: seller })
      const listingType = await registry.getEntryTypeOfEntry(0)
      assert(listingType[0], listingsA.address)
      assert(await registry.size(), 1)
    })
  })
})
