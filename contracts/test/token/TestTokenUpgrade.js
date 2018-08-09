import assertRevert from '../openzeppelin-token/helpers/assertRevert'
const EternalStorage = artifacts.require('EternalStorage')
const V000_OriginToken = artifacts.require('V000_OriginTokenMock')
const Latest_OriginToken = artifacts.require('OriginTokenMock')

// Returns new contract
async function upgradeTokenContract(oldToken, tokenOwner, es, esOwner) {
  const newToken = await Latest_OriginToken.new(es.address, {from: tokenOwner})
  await es.addWriter(newToken.address, {from: esOwner})
  await es.removeWriter(oldToken.address, {from: esOwner})
  return newToken
}

// Tests retention of state when upgrading from the earliest version of the
// OriginToken contract to the latest.
contract('ContractUpgrade', function([tokenOwner, esOwner, otherAccount]) {
  const initialSupply = 100
  const transferAmount = 10
  const approvalAmount = 20
  let es
  let token

  beforeEach(async function() {
    es = await EternalStorage.new({from: esOwner})
    token = await V000_OriginToken.new(es.address, {from: tokenOwner})
    await es.addWriter(token.address, {from: esOwner})
    await token.initializeMock(tokenOwner, initialSupply)

    await token.transfer(otherAccount, transferAmount)
    await token.approve(otherAccount, approvalAmount)
  })

  describe('before contract upgrade', async function () {
    it('returns the total amount of tokens', async function () {
      const totalSupply = await token.totalSupply()
      assert.equal(totalSupply, initialSupply)
    })

    it('returns balance of token owner', async function() {
      const balance = await token.balanceOf(tokenOwner)
      assert.equal(balance, initialSupply - transferAmount)
    })

    it('returns balance of other account', async function() {
      const balance = await token.balanceOf(otherAccount)
      assert.equal(balance, transferAmount)
    })
  })

  describe('after contract upgrade', async function() {
    it('retains total supply', async function() {
      token = await upgradeTokenContract(token, tokenOwner, es, esOwner)
      const totalSupply = await token.totalSupply()
      assert.equal(totalSupply, initialSupply)
    })

    it('retains balance of token owner', async function() {
      token = await upgradeTokenContract(token, tokenOwner, es, esOwner)
      const balance = await token.balanceOf(tokenOwner)
      assert.equal(balance, initialSupply - transferAmount)
    })

    it('retains balance of other account', async function() {
      token = await upgradeTokenContract(token, tokenOwner, es, esOwner)
      const balance = await token.balanceOf(otherAccount)
      assert.equal(balance, transferAmount)
    })

    it('retains approval', async function() {
      token = await upgradeTokenContract(token, tokenOwner, es, esOwner)
      await assertRevert(
        token.transferFrom(tokenOwner, otherAccount, approvalAmount + 1, {from: otherAccount})
      )
      await token.transferFrom(tokenOwner, otherAccount, approvalAmount, {from: otherAccount})

      const ownerBalance = await token.balanceOf(tokenOwner)
      assert.equal(ownerBalance, initialSupply - transferAmount - approvalAmount)
      const otherBalance = await token.balanceOf(otherAccount)
      assert.equal(otherBalance, transferAmount + approvalAmount)
    })

    it('retains paused status', async function() {
      await token.pause()
      token = await upgradeTokenContract(token, tokenOwner, es, esOwner)
      assert.isTrue(await token.paused())
      await token.unpause()
      assert.isFalse(await token.paused())
    })
  })
})
