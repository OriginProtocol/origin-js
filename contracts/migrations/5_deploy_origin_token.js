var EternalStorage = artifacts.require("EternalStorage")
var V000_OriginToken = artifacts.require("V000_OriginToken")
var V001_OriginToken = artifacts.require("V001_OriginToken")

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
  const V000_originToken = await deployer.deploy(V000_OriginToken, eternalStorage.address)
  await eternalStorage.addWriter(V000_originToken.address)
  await V000_originToken.initialize()
  // at this point, V000 is deployed with an initial supply of tokens
  const V001_originToken = await deployer.deploy(V001_OriginToken, eternalStorage.address)
  await eternalStorage.addWriter(V001_originToken.address)
  await eternalStorage.removeWriter(V000_originToken.address)
  // V001 is now deployed, maintaining the token supply created by V000

  const initialSupplyWei = await V001_originToken.totalSupply()
  const initialSupplyTokens = initialSupplyWei / 1e18
  const expectedInitialSupplyWei = 1e9 * 1e18
  const owner = await V001_originToken.owner()
  console.log('token deployed with initial supply of ' + initialSupplyTokens + ' tokens')
  if (initialSupplyWei != expectedInitialSupplyWei) {
    throw new Error('initial supply ' + initialSupplyWei + ' != expected ' + expectedInitialSupplyWei)
  }
  console.log('token owner: ' + owner)
  console.log('EternalStorage used by token contract: ' + eternalStorage.address)
  // TODO: add more deploy-time sanity checks
}
