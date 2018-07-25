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
        assert.equal(await registry.owner(), owner)
      } catch (e) {
        return
      }
      assert(false)
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
    it('should not allow a stranger to add an entry type', async () => {
      try {
        await registry.addEntryType(listingsA.address, 'Listings_VEVIL', {
          from: stranger
        })
      } catch (e) {
        return
      }
      assert(false)
    })
    it('should not allow a contract address to be added twice', async () => {
      try{
        await registry.addEntryType(listingsA.address, 'Listings_V37', {
          from: owner
        })
      } catch(e){ return }
      assert(false)
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
    it('should not allow a stranger to enable an entry type', async () => {
      let listingType
      // Disable the type
      await registry.disableEntryType(0, { from: owner })
      listingType = await registry.getEntryType(0)
      assert.equal(listingType[2], false)
      // Renable it
      try {
        await registry.enableEntryType(0, { from: stranger })
      } catch (e) {
        listingType = await registry.getEntryType(0)
        assert.equal(listingType[2], false)
        return
      }
      assert(false)
    })
    it('should disable an entry type', async () => {
      await registry.disableEntryType(0, { from: owner })
      const listingType = await registry.getEntryType(0)
      assert.equal(listingType[2], false)
    })
    it('should not allow a stranger to disable an entry type', async () => {
      try {
        await registry.disableEntryType(0, { from: stranger })
      } catch (e) {
        const listingType = await registry.getEntryType(0)
        assert.equal(listingType[2], true)
        return
      }
      assert(false)
    })
    it('should rename an entry type', async () => {
      await registry.renameEntryType(0, 'FooBar', { from: owner })
      const listingType = await registry.getEntryType(0)
      assert.equal(listingType[1], 'FooBar')
    })
    it('should not allow a stranger to rename an entry type', async () => {
      try {
        await registry.renameEntryType(0, 'FooBar', { from: stranger })
      } catch (e) {
        const listingType = await registry.getEntryType(0)
        assert.equal(listingType[1], 'Listings_V0')
        return
      }
      assert(false)
    })
  })

  describe('Adding Entries', async () => {
    let registry
    let listingsA

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
    it('should not allow an entry from a disabled contract', async () => {
      await registry.disableEntryType(0, { from: owner })
      try {
        await listingsA.createListing(IPFS_HASH, { from: seller })
        console.log(await registry.size())
      } catch (e) {
        assert(await registry.size(), 0)
        return
      }
      assert(false)
    })
    it("should not allow a stranger's listing contract to add an entry", async () => {
      const evilListings = await Listings.new(registry.address, {
        from: stranger
      })
      try {
        await evilListings.createListing(IPFS_HASH, { from: seller })
      } catch (e) {
        assert(await registry.size(), 0)
        return
      }
      assert(false)
    })
  })
})
