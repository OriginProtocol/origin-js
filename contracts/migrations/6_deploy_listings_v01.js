const EvolvingRegistry = artifacts.require("./EvolvingRegistry.sol")
const V01_Listings = artifacts.require("./V01_Listings.sol")

module.exports = function(deployer, network) {
  return deployer.then(() => {
    return deployContracts(deployer)
  })
}

async function deployContracts(deployer) {
  const evolvingRegistry = await EvolvingRegistry.deployed()
  const v01_Listings = await deployer.deploy(V01_Listings, evolvingRegistry.address)
  await evolvingRegistry.addEntryType(v01_Listings.address, 'V01_Listings')
}
