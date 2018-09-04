import assert from 'assert'
import helper, { assertRevert, contractPath } from './_helper'

// These tests are specifically for the TOken contract and not for any
// contracts from which it inherits. Any OpenZeppelin contracts are covered
// by the OpenZeppelin Truffle tests.
describe('TokenMigration.sol', async function() {
  let accounts, deploy, web3
  let owner

  let OldToken, NewToken, TokenMigration

  beforeEach(async function() {
    ({
      deploy,
      accounts,
      web3,
    } = await helper(`${__dirname}/..`))
    owner = accounts[1]

    // Unlike some other tests, the following tests begin with no initial token
    // supply
    OldToken = await deploy('OriginToken', {
      from: owner,
      path: `${contractPath}/token/`,
      args: [0]
    })
    NewToken = await deploy('OriginToken', {
      from: owner,
      path: `${contractPath}/token/`,
      args: [0]
    })
    TokenMigration = await deploy('TokenMigration', {
      from: owner,
      path: `${contractPath}/token/`,
      args: [OldToken._address, NewToken._address]
    })
    await NewToken.methods.transferOwnership(TokenMigration._address).send({from: owner})
    assert.equal(await TokenMigration.methods.finished().call(), false)
  })

  it('migrates a single account', async function() {
    const initialSupply = 100
    const account = accounts[2]

    // Create old token
    const mintRes = await OldToken.methods.mint(account, initialSupply).send({from: owner})
    assert(mintRes.events.Mint)
    assert.equal(
      await OldToken.methods.balanceOf(account).call(),
      initialSupply
    )
    assert.equal(
      await OldToken.methods.totalSupply().call(),
      initialSupply
    )
    await OldToken.methods.pause().send({from: owner})

    // Migrate tokens
    const res = await TokenMigration.methods.migrateAccount(account).send({from: owner})
    assert(res.events.Migrated)
    assert.equal(await TokenMigration.methods.migrated(account).call(), true)

    // Verify
    assert.equal(
      await OldToken.methods.balanceOf(account).call(),
      await NewToken.methods.balanceOf(account).call()
    )
    assert.equal(
      await OldToken.methods.totalSupply().call(),
      await NewToken.methods.totalSupply().call()
    )

    await TokenMigration.methods.finish(owner).send({from: owner})
    assert.equal(await NewToken.methods.owner().call(), owner)
    assert.equal(await TokenMigration.methods.finished().call(), true)
  })

  it('does not allow migrations after finishing migration', async function() {
    await TokenMigration.methods.finish(owner).send({from: owner})
    assert.equal(await TokenMigration.methods.finished().call(), true)

    await assertRevert(
      TokenMigration.methods.migrateAccount(owner).send({from: owner})
    )
  })

  it('disallows finishing of a partial migration', async function() {
    const account1 = accounts[2]
    const account2 = accounts[3]
    await OldToken.methods.mint(account1, 1).send({from: owner})
    await OldToken.methods.mint(account2, 2).send({from: owner})

    const res = await TokenMigration.methods.migrateAccount(account1).send({from: owner})
    assert(res.events.Migrated)
    assert.equal(await TokenMigration.methods.migrated(account1).call(), true)
    assert.equal(await TokenMigration.methods.migrated(account2).call(), false)

    await assertRevert(
      TokenMigration.methods.finish(owner).send({from: owner})
    )
  })

  it('disallows migration of already migrated account', async function() {
    let res

    res = await OldToken.methods.mint(owner, 100).send({from: owner})
    assert(res.events.Mint)
    await OldToken.methods.pause().send({from: owner})

    res = await TokenMigration.methods.migrateAccount(owner).send({from: owner})
    assert(res.events.Migrated)

    await assertRevert(
      TokenMigration.methods.migrateAccount(owner).send({from: owner})
    )
  })

  it('migrates multiple accounts', async function() {
    const batchSize = 3
    const balances = [0, 1, 1, 2, 3, 5, 8, 13, 21, 34]
    const supply = balances.reduce((total, num) => total + num)
    assert(accounts.length >= balances.length)

    // Mint balances for old token
    for (let i = 0; i < balances.length; i++) {
      const res =
        await OldToken.methods.mint(accounts[i], balances[i]).send({from: owner})
      assert(res.events.Mint)
      assert.equal(
        await OldToken.methods.balanceOf(accounts[i]).call(),
        balances[i]
      )
    }
    assert.equal(await OldToken.methods.totalSupply().call(), supply)
    await OldToken.methods.pause().send({from: owner})

    // Migrate balances in batches
    for (let i = 0; i < balances.length; i += batchSize) {
      const batch = accounts.slice(i, i + batchSize)
      const res =
        await TokenMigration.methods.migrateAccounts(batch).send({from: owner})

      // Ensure we have the correct number of Migrated events, noting that
      // balances of 0 are not migrated
      const numMigrated =
        res.events.Migrated.length ? res.events.Migrated.length : 1
      const expMigrated =
        balances.slice(i, i + batchSize).filter(b => b > 0).length
      assert.equal(numMigrated, expMigrated)
    }

    // Verify
    for (let i = 0; i < balances.length; i++) {
      const account = accounts[i]
      assert.equal(
        await OldToken.methods.balanceOf(account).call(),
        await NewToken.methods.balanceOf(account).call()
      )
      assert.equal(
        await TokenMigration.methods.migrated(account).call(),
        balances[i] > 0
      )
    }

    // Finish
    await TokenMigration.methods.finish(owner).send({from: owner})
    assert.equal(await NewToken.methods.owner().call(), owner)
    assert.equal(await TokenMigration.methods.finished().call(), true)
  })

  it('disallows operations by non-owners', async function() {
    const other = accounts[5]
    assert.notEqual(owner, other)
    await assertRevert(
      TokenMigration.methods.migrateAccounts([owner]).send({from: other})
    )
    await assertRevert(
      TokenMigration.methods.migrateAccount(owner).send({from: other})
    )
    await assertRevert(
      TokenMigration.methods.finish(owner).send({from: other})
    )
  })

  it('does not allow new token to be owned by migration contract', async function() {
    await assertRevert(
      TokenMigration.methods.finish(TokenMigration._address).send({from: owner})
    )
  })
})
