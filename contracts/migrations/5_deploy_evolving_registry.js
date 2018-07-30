const EvolvingRegistry = artifacts.require("./EvolvingRegistry.sol")

module.exports = function(deployer, network) {
  return deployer.then(() => {
    return deployContracts(deployer)
  })
}

async function deployContracts(deployer) {
  return await deployer.deploy(EvolvingRegistry)
}
