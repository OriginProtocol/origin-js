var EternalStorage = artifacts.require("./EternalStorage.sol")
var OriginToken = artifacts.require("./OriginToken.sol")

// TODO: sequence this before the marketplace deployment, which seems to depend
// on this

module.exports = function(deployer, network) {
  return deployer.then(() => {
    return deployOriginTokenContracts(deployer)
  })
}

async function deployOriginTokenContracts(deployer) {
  // Deploy token
  // TODO: Avoid doing this with every deploy
  const eternalStorage = await deployer.deploy(EternalStorage)
  const originToken = await deployer.deploy(OriginToken, eternalStorage.address)
  await eternalStorage.addWriter(originToken.address)
  await originToken.initialize()
}
