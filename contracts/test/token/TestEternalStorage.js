import assertRevert from '../openzeppelin-token/helpers/assertRevert'
const EternalStorage = artifacts.require('EternalStorage')

contract('EternalStorage', function(accounts) {
  const admin = accounts[0]
  const initialAdmins = 1
  const initialWriters = 0
  let es

  beforeEach(async function() {
    es = await EternalStorage.new()
  })

  describe('security', async function() {
    it('starts with one admin and no writers', async function() {
      assert.isTrue(await es.isAdmin(admin))
      assert.equal(await es.adminCount(), initialAdmins)
      assert.equal(await es.writerCount(), initialWriters)
    })

    it('allows admins to add new admins', async function() {
      const newAdmin = accounts[1]
      await es.addAdmin(newAdmin)
      assert.isTrue(await es.isAdmin(admin))
      assert.isTrue(await es.isAdmin(newAdmin))
      assert.equal(await es.adminCount(), initialAdmins + 1)
      assert.equal(await es.writerCount(), initialWriters)
    })

    it('allows a new admin to remove an existing admin', async function() {
      const newAdmin = accounts[1]
      await es.addAdmin(newAdmin)
      assert.isTrue(await es.isAdmin(newAdmin))
      await es.removeAdmin(admin, {from: newAdmin})
      assert.isFalse(await es.isAdmin(admin))
      assert.equal(await es.adminCount(), initialAdmins)
      assert.equal(await es.writerCount(), initialWriters)
    })

    it('allows admins to add and remove writers', async function() {
      const newWriter = accounts[1]
      await es.addWriter(newWriter)
      assert.equal(await es.adminCount(), initialAdmins)
      assert.equal(await es.writerCount(), initialWriters + 1)
      assert.isTrue(await es.isWriter(newWriter))
      await es.removeWriter(newWriter)
      assert.equal(await es.adminCount(), initialAdmins)
      assert.equal(await es.writerCount(), initialWriters)
      assert.isFalse(await es.isWriter(newWriter))
    })

    it('does not allow writers to add admins or writers', async function() {
      const writer = accounts[1]
      const other = accounts[2]
      await es.addWriter(writer)
      assert.equal(await es.adminCount(), initialAdmins)
      assert.equal(await es.writerCount(), initialWriters + 1)
      await assertRevert(es.addWriter(other, {from: writer}))
      await assertRevert(es.addAdmin(other, {from: writer}))
      assert.equal(await es.adminCount(), initialAdmins)
      assert.equal(await es.writerCount(), initialWriters + 1)
    })

    it('does not decrement adminCount when removing non-admin address', async function() {
      const other = accounts[1]
      await es.removeAdmin(other)
      assert.equal(await es.adminCount(), initialAdmins)
      assert.equal(await es.writerCount(), initialWriters)
    })

    it('does not decrement writerCount when removing non-writer address', async function() {
      const other = accounts[1]
      await es.removeWriter(other)
      assert.equal(await es.adminCount(), initialAdmins)
      assert.equal(await es.writerCount(), initialWriters)
    })

    it('does not allow removal of final owner', async function() {
      assertRevert(es.removeAdmin(admin))
    })

    // TODO: ensure admins and writers can perform every operation
    // TODO: ensure non-writers can't write
  })

  // TODO: test incrementers
  // TODO: test getters
  // TODO: test setters
  // TODO: test deleters
})
