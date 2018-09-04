import assert from 'assert'
import helper, { contractPath } from './_helper'
import marketplaceHelpers, { IpfsHash } from './_marketplaceHelpers'
import Table from 'cli-table'
import GasPriceInDollars from './_gasPriceInDollars'

// Account 0: Token owner. Marketplace owner
// Account 1: Seller
// Account 2: Buyer
// Account 3: Dispute resolver
const gasPriceInDollars = GasPriceInDollars({
  gasPriceGwei: 8,
  pricePerEth: 500
})
const gasUsed = []
const trackGas = id => receipt => gasUsed.push([id, receipt.cumulativeGasUsed])
const gasOrder = `
Create Listing
Make Offer
Make Offer ERC20
Accept Offer
Finalize Offer
Update Listing
Dispute Offer
Give Ruling Buyer
Withdraw Offer
Withdraw Listing
`.split('\n')

describe('Marketplace.sol', async function() {
  const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

  let accounts, deploy, web3
  let Marketplace,
    OriginToken,
    DaiStableCoin,
    Buyer,
    // BuyerIdentity,
    Owner,
    Seller,
    SellerIdentity,
    Arbitrator,
    MarketArbitrator,
    ArbitratorAddr,
    helpers,
    gasEstimate

  before(async function() {
    ({ deploy, accounts, web3 } = await helper(`${__dirname}/..`))

    Owner = accounts[0]
    Seller = accounts[1]
    Buyer = accounts[2]
    ArbitratorAddr = accounts[3]

    const gasPrice = await web3.eth.getGasPrice()
    gasEstimate = web3.utils.toBN(gasPrice).mul(web3.utils.toBN('4000000'))

    OriginToken = await deploy('OriginToken', {
      from: Owner,
      path: `${contractPath}/token/`,
      args: [12000]
    })

    DaiStableCoin = await deploy('Token', {
      from: Owner,
      path: `${__dirname}/contracts/`,
      args: ['Dai', 'DAI', 2, 12000]
      // args: [12000]
    })

    Arbitrator = await deploy('CentralizedArbitrator', {
      from: ArbitratorAddr,
      path: `${__dirname}/contracts/arbitration/`,
      args: [0]
    })

    MarketArbitrator = await deploy('OriginArbitrator', {
      from: ArbitratorAddr,
      path: `${__dirname}/contracts/`,
      args: [Arbitrator._address]
    })

    Marketplace = await deploy('V00_Marketplace', {
      from: Owner,
      // path: `${__dirname}/contracts/`,
      path: `${contractPath}/marketplace/v00`,
      file: 'Marketplace.sol',
      args: [OriginToken._address]
    })

    SellerIdentity = await deploy('ClaimHolder', {
      from: Seller,
      path: `${contractPath}/identity/`
    })

    // BuyerIdentity = await deploy('ClaimHolder', {
    //   from: Buyer,
    //   path: `${contractPath}/identity`
    // })

    await OriginToken.methods.transfer(Seller, 400).send()
    await OriginToken.methods.transfer(SellerIdentity._address, 400).send()
    await DaiStableCoin.methods.transfer(Buyer, 400).send()

    helpers = marketplaceHelpers({
      Marketplace,
      web3,
      Buyer,
      Seller,
      OriginToken,
      MarketArbitrator,
      ArbitratorAddr,
      Arbitrator,
      trackGas
    })
  })

  after(function() {
    console.log()

    const gasTable = new Table({
      chars: { mid: '', 'left-mid': '', 'mid-mid': '', 'right-mid': '' },
      colAligns: ['left', 'right', 'right'],
      head: ['Transaction', 'Min', 'Max', 'Min $', 'Max $']
    })
    let used = []
    gasUsed.forEach(g => {
      const existing = used.findIndex(u => u[0] === g[0])
      if (existing < 0) {
        used.push([g[0], g[1], g[1]])
      } else {
        if (g[1] < used[existing][1]) used[existing][1] = g[1]
        if (g[2] > used[existing][2]) used[existing][2] = g[2]
      }
    })
    used = used.sort((a, b) => {
      if (gasOrder.indexOf(a[0]) > gasOrder.indexOf(b[0])) return 1
      if (gasOrder.indexOf(a[0]) < gasOrder.indexOf(b[0])) return -1
      return 0
    })

    const createListing = used.find(u => u[0] === 'Create Listing'),
      makeOffer = used.find(u => u[0] === 'Make Offer'),
      makeOfferERC = used.find(u => u[0] === 'Make Offer ERC20'),
      acceptOffer = used.find(u => u[0] === 'Accept Offer'),
      finalizeOffer = used.find(u => u[0] === 'Finalize Offer')

    used.push([
      'Basic Buyer Flow',
      makeOffer[1] + finalizeOffer[1],
      makeOfferERC[2] + finalizeOffer[2]
    ])
    used.push([
      'Basic Seller Flow',
      createListing[1] + acceptOffer[1],
      createListing[2] + acceptOffer[2]
    ])
    used.push([
      'Buyer+Seller Flow',
      createListing[1] + makeOffer[1] + acceptOffer[1] + finalizeOffer[1],
      createListing[2] + makeOfferERC[2] + acceptOffer[2] + finalizeOffer[2]
    ])
    used.forEach(u => {
      gasTable.push([...u, gasPriceInDollars(u[1]), gasPriceInDollars(u[2])])
    })
    console.log(gasTable.toString())
  })

  describe('A listing in ETH', function() {
    it('should allow a new listing to be added', async function() {
      const result = await helpers.createListing({ Token: OriginToken })
      assert(result)

      const balance = await OriginToken.methods
        .balanceOf(Marketplace._address)
        .call()
      assert.equal(balance, 5)

      const total = await Marketplace.methods.totalListings().call()
      assert.equal(total, 1)

      const listing = await Marketplace.methods.listings(0).call()
      assert.equal(listing.seller, Seller)
    })

    it('should allow an offer to be made', async function() {
      const result = await helpers.makeOffer({ trackGas })

      assert(result.events.OfferCreated)

      const offer = await Marketplace.methods.offers(0, 0).call()
      assert.equal(offer.buyer, Buyer)
    })

    it('should allow an offer to be accepted', async function() {
      const result = await Marketplace.methods
        .acceptOffer(0, 0, IpfsHash)
        .send({ from: Seller })
        .once('receipt', trackGas('Accept Offer'))
      assert(result.events.OfferAccepted)
    })

    it('should allow an offer to be finalized by buyer', async function() {
      const balanceBefore = await web3.eth.getBalance(Seller)

      const result = await Marketplace.methods
        .finalize(0, 0, IpfsHash)
        .send({
          from: Buyer
        })
        .once('receipt', trackGas('Finalize Offer'))
      assert(result.events.OfferFinalized)

      const balanceAfter = await web3.eth.getBalance(Seller)
      assert.equal(
        Number(balanceAfter),
        Number(balanceBefore) + Number(web3.utils.toWei('0.1', 'ether'))
      )
    })

    describe('withdrawing an offer', function() {
      it('should allow another offer to be made', async function() {
        const result = await helpers.makeOffer({})
        assert(result.events.OfferCreated)

        const offer = await Marketplace.methods.offers(0, 1).call()
        assert.equal(offer.buyer, Buyer)
      })
      it('should allow an offer to be withdrawn', async function() {
        const balanceBefore = await web3.eth.getBalance(Buyer)
        const result = await Marketplace.methods
          .withdrawOffer(0, 1, IpfsHash)
          .send({ from: Buyer })
          .once('receipt', trackGas('Withdraw Offer'))

        assert(result.events.OfferWithdrawn)

        const balanceAfter = await web3.eth.getBalance(Buyer)

        assert(Number(balanceAfter) > Number(balanceBefore))
      })
    })

    describe('updating an offer', function() {
      it('should allow an offer to be updated', async function() {
        const result = await helpers.makeOffer({})
        assert(result.events.OfferCreated)

        const result2 = await helpers.makeOffer({ withdraw: 2 })
        assert(result2.events.OfferWithdrawn)
        assert(result2.events.OfferCreated)
      })
    })

    describe('withdrawing a listing', function() {
      it('should allow a listing to be withdrawn', async function() {
        const listing = await helpers.createListing({ Token: OriginToken })
        const listingID = listing.events.ListingCreated.returnValues.listingID
        const result = await Marketplace.methods
          .withdrawListing(listingID, Seller, IpfsHash)
          .send({ from: Seller })
          .once('receipt', trackGas('Withdraw Listing'))
        assert(result.events.ListingWithdrawn)
      })
    })
  })

  describe('A listing in DAI', function() {
    let listingID

    describe('default flow', function() {
      it('should allow a new listing to be added', async function() {
        await OriginToken.methods
          .approve(Marketplace._address, 50)
          .send({ from: Seller })

        const result = await Marketplace.methods
          .createListing(IpfsHash, 50, Seller)
          .send({ from: Seller })
          .once('receipt', trackGas('Create Listing'))

        listingID = result.events.ListingCreated.returnValues.listingID

        assert(result)
      })

      it('should allow an offer to be made', async function() {
        const result = await helpers.makeERC20Offer({
          Buyer,
          Token: DaiStableCoin,
          listingID
        })
        assert(result)

        const offer = await Marketplace.methods.offers(listingID, 0).call()
        assert.equal(offer.buyer, Buyer)
      })

      it('should allow an offer to be accepted', async function() {
        const result = await Marketplace.methods
          .acceptOffer(listingID, 0, IpfsHash)
          .send({ from: Seller })
          .once('receipt', trackGas('Accept Offer'))
        assert(result.events.OfferAccepted)
      })

      it('should allow an offer to be finalized', async function() {
        const balanceBefore = await DaiStableCoin.methods.balanceOf(Seller).call()

        const result = await Marketplace.methods
          .finalize(listingID, 0, IpfsHash)
          .send({ from: Buyer })
          .once('receipt', trackGas('Finalize Offer'))
        assert(result.events.OfferFinalized)

        const balanceAfter = await DaiStableCoin.methods.balanceOf(Seller).call()
        assert.equal(Number(balanceAfter), Number(balanceBefore) + 10)
      })
    })

    describe('withdrawing an offer', function() {
      it('should allow another offer to be made', async function() {
        const result = await helpers.makeERC20Offer({
          listingID,
          Buyer,
          Token: DaiStableCoin
        })
        assert(result)

        const offer = await Marketplace.methods.offers(listingID, 1).call()
        assert.equal(offer.buyer, Buyer)
      })

      it('should allow an offer to be withdrawn', async function() {
        const balanceBefore = await DaiStableCoin.methods.balanceOf(Buyer).call()

        const result = await Marketplace.methods
          .withdrawOffer(listingID, 1, IpfsHash)
          .send({ from: Buyer })
          .once('receipt', trackGas('Withdraw Offer'))
        assert(result.events.OfferWithdrawn)

        const balanceAfter = await DaiStableCoin.methods.balanceOf(Buyer).call()
        assert.equal(Number(balanceAfter), Number(balanceBefore) + 10)
      })
    })

    describe('updating an offer', function() {
      it('should allow another offer to be made', async function() {
        const result = await helpers.makeERC20Offer({
          listingID,
          Buyer,
          Token: DaiStableCoin
        })
        assert(result)

        const result2 = await helpers.makeERC20Offer({
          listingID,
          Buyer,
          Token: DaiStableCoin,
          withdraw: 2
        })
        assert(result2)
      })
    })
  })

  describe('Arbitration', function() {
    let listingID, offerID, balanceBefore, balanceAfter

    // When comparing Eth, take into account gas price
    function assertBN(before, expr, after) {
      const [operator, value, currency] = expr.split(' ')
      if (operator !== 'add') throw(new Error('Unknown operator'))
      const wei = web3.utils.toBN(web3.utils.toWei(value, currency))
      const low = before.add(wei).sub(gasEstimate)
      const high = before.add(wei).add(gasEstimate)
      assert(after.gt(low) && after.lt(high))
    }

    describe('dispute without refund (Eth)', function() {
      it('should resolve in favor of buyer (no commission)', async function() {
        ({ listingID, offerID, balance: balanceBefore } = await helpers.disputedOffer({}));
        ({ balance: balanceAfter } = await helpers.giveRuling({ listingID, offerID, ruling: 1 }))
        assertBN(balanceBefore.eth, 'add 0.1 ether', balanceAfter.eth)
        assert(balanceAfter.ogn.eq(balanceBefore.ogn))
      })
      it('should resolve in favor of buyer (pay commission)', async function() {
        ({ listingID, offerID, balance: balanceBefore } = await helpers.disputedOffer({}));
        ({ balance: balanceAfter } = await helpers.giveRuling({ listingID, offerID, ruling: 3 }))
        assertBN(balanceBefore.eth, 'add 0.1 ether', balanceAfter.eth)
        assert(balanceAfter.ogn.eq(balanceBefore.ogn.add(new web3.utils.BN('2'))))
      })
      it('should resolve in favor of seller (no commission)', async function() {
        ({ listingID, offerID, balance: balanceBefore } = await helpers.disputedOffer({ party: Seller }));
        ({ balance: balanceAfter } = await helpers.giveRuling({ listingID, offerID, ruling: 0, party: Seller }))
        assertBN(balanceBefore.eth, 'add 0.1 ether', balanceAfter.eth)
        assert(balanceAfter.ogn.eq(balanceBefore.ogn))
      })
      it('should resolve in favor of seller (pay commission)', async function() {
        ({ listingID, offerID, balance: balanceBefore } = await helpers.disputedOffer({ party: Seller }));
        ({ balance: balanceAfter } = await helpers.giveRuling({ listingID, offerID, ruling: 2, party: Seller }))
        assertBN(balanceBefore.eth, 'add 0.1 ether', balanceAfter.eth)
        assert(balanceAfter.ogn.eq(balanceBefore.ogn.add(new web3.utils.BN('2'))))
      })
    })
  })

  describe('Updating', function() {
    let listingID

    it('should allow a new listing to be added', async function() {
      await OriginToken.methods
        .approve(Marketplace._address, 10)
        .send({ from: Seller })

      const result = await Marketplace.methods
        .createListing(IpfsHash, 10, Seller)
        .send({ from: Seller })
        .once('receipt', trackGas('Create Listing'))

      listingID = result.events.ListingCreated.returnValues.listingID

      assert(result)
    })

    it('should allow the listing to be updated', async function() {
      await OriginToken.methods
        .approve(Marketplace._address, 10)
        .send({ from: Seller })

      const result = await Marketplace.methods
        .updateListing(listingID, '0x98765432109876543210987654321098', 10)
        .send({ from: Seller })
        .once('receipt', trackGas('Update Listing'))

      assert(result)
    })
  })

  describe('A listing in ETH from an identity', function() {
    let listingID
    it('should allow a new listing to be added', async function() {
      const result = await helpers.createListing({ Identity: SellerIdentity })
      assert(result)
      listingID = web3.utils.hexToNumber(result.events['1'].raw.topics[2])

      const listing = await Marketplace.methods.listings(listingID).call()
      assert.equal(listing.seller, SellerIdentity._address)
    })

    // it('should allow the listing to be updated', async function() {
    //   await OriginToken.methods
    //     .transfer(SellerIdentity._address, 10)
    //     .send({ from: Seller })
    //
    //   var approveAbi = await OriginToken.methods
    //     .approve(Marketplace._address, 10)
    //     .encodeABI()
    //
    //   await SellerIdentity.methods
    //     .execute(OriginToken._address, 0, approveAbi)
    //     .send({ from: Seller })
    //
    //   var updateAbi = await Marketplace.methods
    //     .updateListing(
    //       listingID,
    //       '0x98765432109876543210987654321098',
    //       10,
    //       false
    //     )
    //     .encodeABI()
    //
    //   var result = await SellerIdentity.methods
    //     .execute(Marketplace._address, 0, updateAbi)
    //     .send({ from: Seller })
    //
    //   console.log(result)
    //
    //   assert(result)
    // })

    // it('should allow an offer to be made', async function() {
    //   var result = await helpers.makeOffer({})
    //
    //   assert(result.events.OfferCreated)
    //
    //   var offer = await Marketplace.methods.offers(0, 0).call()
    //   assert.equal(offer.buyer, Buyer)
    // })
    //
    // it('should allow an offer to be accepted', async function() {
    //   var result = await Marketplace.methods
    //     .acceptOffer(0, 0, IpfsHash)
    //     .send({ from: Seller })
    //   assert(result.events.OfferAccepted)
    // })
    //
    // it('should allow an offer to be finalized by buyer', async function() {
    //   var balanceBefore = await web3.eth.getBalance(Seller)
    //
    //   var result = await Marketplace.methods.finalize(0, 0, IpfsHash).send({
    //     from: Buyer
    //   })
    //   assert(result.events.OfferFinalized)
    //
    //   var balanceAfter = await web3.eth.getBalance(Seller)
    //   assert.equal(
    //     Number(balanceAfter),
    //     Number(balanceBefore) + Number(web3.utils.toWei('0.1', 'ether'))
    //   )
    // })
  })

  describe('Ownership', function() {
    it('should allow the contract owner to set the token address', async function() {
      try {
        await Marketplace.methods.setTokenAddr(ZERO_ADDRESS).send()
        assert.equal(
          await Marketplace.methods.tokenAddr().call(),
          ZERO_ADDRESS)
      } finally {
        await Marketplace.methods.setTokenAddr(OriginToken._address).send()
        assert.equal(
          await Marketplace.methods.tokenAddr().call(),
          OriginToken._address)
      }
    })

    it('should not allow non-owners to set the token address', async function() {
      try {
        await Marketplace.methods.setTokenAddr(ZERO_ADDRESS).send({
          from: Buyer
        })
        assert(false)
      } catch (e) {
        assert(e.message.match(/revert/))
      }
    })
  })
})
