const V00_Marketplace = artifacts.require('./V00_Marketplace.sol')

module.exports = function(deployer) {
  return deployer.then(() => {
    return whitelistAffiliate(deployer)
  })
}

async function whitelistAffiliate() {
  const accounts = await new Promise((resolve, reject) => {
    web3.eth.getAccounts((error, result) => {
      if (error) {
        reject(error)
      }
      resolve(result)
    })
  })
  const Affiliate = accounts[3]
  console.log('Affilaite', Affiliate)

  const marketplace = await V00_Marketplace.deployed()
  const from = await marketplace.owner()

  await marketplace.addAffiliate(
    Affiliate,
    '0x0000000000000000000000000000000000000000000000000000000000000000',
    { from }
  )
}
