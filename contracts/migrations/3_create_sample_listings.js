const V00_Marketplace = artifacts.require('./V00_Marketplace.sol')

module.exports = function(deployer, network) {
  return deployer.then(() => {
    if (network === 'mainnet') {
      console.log('Skipping sample listings on mainnet')
    } else {
      return deployContracts(deployer)
    }
  })
}

async function createListing(marketplace, hash, from) {
  await marketplace.createListing(hash, '0', from, { gas: 4612388, from })
}

async function deployContracts(deployer) {

  const accounts = await new Promise((resolve, reject) => {
    web3.eth.getAccounts((error, result) => {
      if (error) {
        reject(error)
      }
      resolve(result)
    })
  })

  const Seller = accounts[1]

  const marketplace00 = await V00_Marketplace.deployed()

  await createListing(
    marketplace00,
    '0x7b27f2daab85a42b504c5136b931ff27aec42ef1c46d4c8b29d51cae7020207f',
    Seller
  )
  await createListing(
    marketplace00,
    '0xad85d70501546cb0bf59d714708b237ba038344641834bfaa0ab68b3f8357fc6',
    Seller
  )
  await createListing(
    marketplace00,
    '0xf1ce5565b9bac277b3d64a7a5b2e2cb31de245e4be2d4707062860cfb7c2cb20',
    Seller
  )
  await createListing(
    marketplace00,
    '0x082d972256b693df54a20b7734a7f97bfc560a05d73efcf18bc4c6af4a45ab25',
    Seller
  )
  await createListing(
    marketplace00,
    '0x8b81a7fd0c0f9f045fa0b973738a0c7a484d7b89fd78b33348ca70dadc15c0b1',
    Seller
  )
}
