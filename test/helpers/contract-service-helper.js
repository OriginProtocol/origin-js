import EvolvingRegistryContract from '../../contracts/build/contracts/EvolvingRegistry.json'
import V01_ListingsContract from '../../contracts/build/contracts/V01_Listings.json'
import ContractService from '../../src/services/contract-service'
import Web3 from 'web3'

/*
  Returns a contract service instance with a clean listings registry

  This creates a clean environment for testing without side effects.
*/

export default async function contractServiceHelper(web3) {
  const accounts = await web3.eth.getAccounts()
  const dummyContractService = new ContractService({ web3 })

  // Deploy clean listings registry for testing without side effects
  const evolvingRegistry = await dummyContractService.deploy(
    EvolvingRegistryContract,
    [],
    { from: accounts[0], gas: 4000000 }
  )
  const v01_Listings = await dummyContractService.deploy(
    V01_ListingsContract,
    [ evolvingRegistry.contractAddress ],
    { from: accounts[0], gas: 4000000 }
  )
  await dummyContractService.call(
    'evolvingRegistryContract',
    'addEntryType',
    [ v01_Listings.contractAddress, 'V01_Listings' ],
    { from: accounts[0], gas: 4000000 },
    { contractAddress: evolvingRegistry.contractAddress }
  )

  return new ContractService({
    web3,
    contractAddresses: {
      evolvingRegistryContract: {
        999: { address: evolvingRegistry.contractAddress }
      },
      v01_ListingsContract: {
        999: { address: v01_Listings.contractAddress }
      }
    }
  })
}
