const OriginToken = artifacts.require("./Token.sol")
const V02_Marketplace = artifacts.require("./V02_Marketplace.sol")

module.exports = function(deployer, network) {
  return deployer.then(() => {
    return deployContracts(deployer)
  })
}

async function deployContracts(deployer) {
  await deployer.deploy(OriginToken, 'Origin', 'OGN', '18', '100000')
  await deployer.deploy(V02_Marketplace, OriginToken.address)
}
