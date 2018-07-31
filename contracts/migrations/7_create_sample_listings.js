const V01_Listings = artifacts.require('./V01_Listings.sol')

module.exports = function(deployer, network) {
  return deployer.then(() => {
    return deploy_sample_contracts(network)
  })
}

async function deploy_sample_contracts(network) {
  let accounts = await new Promise((resolve, reject) => {
    web3.eth.getAccounts((error, result) => {
      if (error) {
        reject(err)
      }
      resolve(result)
    })
  })

  const default_account = accounts[0]
  const a_seller_account = accounts[1]
  const a_buyer_account = accounts[2]

  const v01_Listings = await V01_Listings.deployed()

  console.log(`default_account:       ${default_account}`)
  console.log(`a_seller_account:      ${a_seller_account}`)
  console.log(`a_buyer_account:       ${a_buyer_account}`)

  await v01_Listings.createListing(
    '0x92ee6d1fe5a782851038042222ef104d40739e451ea917b22eb4fab6e0b183cc'
  )
  await v01_Listings.createListing(
    '0x7f987cfb28fce6df57b0a53ed16e29f8f1c70267422e5c077c484a2ca8e0c177'
  )
  await v01_Listings.createListing(
    '0xf5170866802148e9cbd271e0dd119154411383cc9a1c806d4daaa3fd3686bb13'
  )
  await v01_Listings.createListing(
    '0xcf9177fa56e6f671f273d1722c72398a1abd219ecd954fae7079951b5561b30d'
  )
  await v01_Listings.createListing(
    '0xe647136f1b1174cd94cd642cc2f5481b1a17b5f4b95ec132d5b2913e769abc2d'
  )
}
