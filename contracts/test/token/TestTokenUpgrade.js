import assertRevert from '../openzeppelin-token/helpers/assertRevert'
const EternalStorage = artifacts.require('EternalStorage')
const V000_OriginToken = artifacts.require('V000_OriginTokenMock')
const Latest_OriginToken = artifacts.require('OriginTokenMock')

const upgradeContract = async (test, tokenOwner, esOwner) => {
  const oldToken = test.token
  test.token = await Latest_OriginToken.new(test.es.address, {from: esOwner})
  await test.es.removeWriter(oldToken.address, {from: esOwner})
  await test.es.addWriter(test.token.address, {from: esOwner})
}

// Tests retention of state when upgrading from the earliest version of the
// OriginToken contract to the latest.
contract('ContractUpgrade', function([tokenOwner, esOwner, otherAccount]) {
  const initialSupply = 100
  const transferAmount = 10
  const approvalAmount = 20

  beforeEach(async function () {
    this.es = await EternalStorage.new({from: esOwner})
    this.token = await V000_OriginToken.new(this.es.address, {from: tokenOwner})
    console.log('* test owner = ' + tokenOwner)
    console.log('* token owner = ' + await this.token.owner())
    await this.es.addWriter(this.token.address, {from: esOwner})
    await this.token.initializeMock(tokenOwner, initialSupply)

    await this.token.transfer(otherAccount, transferAmount)
    await this.token.approve(otherAccount, approvalAmount)
  })

  describe('before contract upgrade', function () {
    it('returns the total amount of tokens', async function () {
      const totalSupply = await this.token.totalSupply();
      assert.equal(totalSupply, initialSupply)
    })

    it('returns balance of token owner', async function() {
      const balance = await this.token.balanceOf(tokenOwner)
      assert.equal(balance, initialSupply - transferAmount)
    })

    it('returns balance of other account', async function() {
      const balance = await this.token.balanceOf(otherAccount)
      assert.equal(balance, transferAmount)
    })
  })

  describe('after contract upgrade', function() {
    it('retains total supply', async function() {
      await upgradeContract(this, tokenOwner, esOwner)
      const totalSupply = await this.token.totalSupply();
      assert.equal(totalSupply, initialSupply)
    })

    it('retains balance of token owner', async function() {
      await upgradeContract(this, tokenOwner, esOwner)
      const balance = await this.token.balanceOf(tokenOwner)
      assert.equal(balance, initialSupply - transferAmount)
    })

    it('retains balance of other account', async function() {
      await upgradeContract(this, tokenOwner, esOwner)
      const balance = await this.token.balanceOf(otherAccount)
      assert.equal(balance, transferAmount)
    })

    it('retains approval', async function () {
      await upgradeContract(this, tokenOwner, esOwner)
      await assertRevert(
        this.token.transferFrom(tokenOwner, otherAccount, approvalAmount + 1, {from: otherAccount})
      )
      await this.token.transferFrom(tokenOwner, otherAccount, approvalAmount, {from: otherAccount})

      const ownerBalance = await this.token.balanceOf(tokenOwner)
      assert.equal(ownerBalance, initialSupply - transferAmount - approvalAmount)
      const otherBalance = await this.token.balanceOf(otherAccount)
      assert.equal(otherBalance, transferAmount + approvalAmount)
    })

    it('retains paused status', async function() {
      /*
      // TODO: fix this, because something is actually broken here
      console.log('test owner = ' + tokenOwner)
      console.log('token owner = ' + await this.token.owner())
      await this.token.pause()
      //upgradeContract(this, tokenOwner, esOwner)
      //assert.isTrue(await this.token.paused())
      //await this.token.unpause()
      */
    })
  })
})
