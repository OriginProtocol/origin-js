const listingsRegistryContractDefinition = artifacts.require("./ListingsRegistry.sol")
const originTokenlistingsRegistryContractDefinition = artifacts.require("./OriginToken.sol")

const initialListingsLength = 0
const ipfsHash =
  "0x6b14cac30356789cd0c39fec0acc2176c3573abdb799f3b17ccc6972ab4d39ba"

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
    listingsRegistry = await listingsRegistryContractDefinition.new(0x00, { from: owner })
  })

  it("should have owner as owner of contract", async function() {
    let contractOwner = await listingsRegistry.owner()
    assert.equal(contractOwner, owner)
  })

  it("should be able to create a listing", async function() {
    const initPrice = 2
    const initUnitsAvailable = 5
    await listingsRegistry.create(ipfsHash, initPrice, initUnitsAvailable, {
      from: accounts[0]
    })
    let listingCount = await listingsRegistry.listingsLength()
    assert.equal(
      listingCount,
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
    assert.equal(lister, accounts[0], "lister is correct")
    assert.equal(hash, ipfsHash, "ipfsHash is correct")
    assert.equal(price, initPrice, "price is correct")
    assert.equal(
      unitsAvailable,
      initUnitsAvailable,
      "unitsAvailable is correct"
    )
  })
})
