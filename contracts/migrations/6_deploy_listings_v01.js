const V01_Listings = artifacts.require("./V01_Listings.sol")

module.exports = function(deployer, network) {
  return deployer.then(() => {
    return deployContracts(deployer)
  })
}

async function deployContracts(deployer) {
  const v01_Listings = await deployer.deploy(V01_Listings)
}
