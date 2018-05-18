const ListingsRegistry = artifacts.require("./ListingsRegistry.sol")

const ipfsHash =
  "0x6b14cac30356789cd0c39fec0acc2176c3573abdb799f3b17ccc6972ab4d39ba"

const zeroAddress = "0x0000000000000000000000000000000000000000"

// Used to assert error cases
const isEVMError = function(err) {
  let str = err.toString()
  return str.includes("revert")
}

contract("ListingsRegistry", accounts => {
  var owner = accounts[0]
  var notOwner = accounts[1]
  var listingsRegistry

  beforeEach(async function() {
    listingsRegistry = await ListingsRegistry.deployed()
  })

  it("should have owner as owner of contract", async function() {
    let contractOwner = await listingsRegistry.owner()
    assert.equal(contractOwner, owner)
  })

  it("should be able to create a listing", async function() {
    const initPrice = 2
    const initUnitsAvailable = 5
    let initialListingsLength = await listingsRegistry.listingsLength()

    await listingsRegistry.create(
      ipfsHash,
      initPrice,
      initUnitsAvailable,
      zeroAddress,
      {
        from: accounts[1]
      }
    )
    let listingCount = await listingsRegistry.listingsLength()
    console.log("length", listingCount.toNumber(), Number(listingCount))
    assert.equal(
      listingCount.toNumber(),
      initialListingsLength.toNumber() + 1,
      "listings count has incremented"
    )
    let [
      listingAddress,
      lister,
      hash,
      price,
      unitsAvailable
    ] = await listingsRegistry.getListing(initialListingsLength)
    assert.equal(lister, accounts[1], "lister is correct")
    assert.equal(hash, ipfsHash, "ipfsHash is correct")
    assert.equal(price, initPrice, "price is correct")
    assert.equal(
      unitsAvailable,
      initUnitsAvailable,
      "unitsAvailable is correct"
    )
  })

  it("should be able to create a listing on behalf of other", async function() {
    const initPrice = 2
    const initUnitsAvailable = 5
    const initialListingsLength = await listingsRegistry.listingsLength()
    await listingsRegistry.createOnBehalf(
      ipfsHash,
      initPrice,
      initUnitsAvailable,
      accounts[1],
      { from: accounts[0] }
    )
    let listingCount = await listingsRegistry.listingsLength()
    console.log("length", listingCount.toNumber(), Number(listingCount))
    assert.equal(
      listingCount.toNumber(),
      initialListingsLength + 1,
      "listings count has incremented"
    )
    let [
      listingAddress,
      lister,
      hash,
      price,
      unitsAvailable
    ] = await listingsRegistry.getListing(initialListingsLength)
    assert.equal(lister, accounts[1], "lister is correct as other account")
    assert.equal(hash, ipfsHash, "ipfsHash is correct")
    assert.equal(price, initPrice, "price is correct")
    assert.equal(
      unitsAvailable,
      initUnitsAvailable,
      "unitsAvailable is correct"
    )
  })
})
