import { expect } from 'chai'
import Marketplace from '../src/resources/marketplace.js'
import IpfsService from '../src/services/ipfs-service.js'
import Web3 from 'web3'
// import asAccount from './helpers/as-account'
// import fetchMock from 'fetch-mock'
import contractServiceHelper from './helpers/contract-service-helper'

describe('Marketplace Resource', function() {
  this.timeout(5000) // default is 2000

  let marketplace
  let contractService
  let ipfsService
  // let buyer

  before(async () => {
    const provider = new Web3.providers.HttpProvider('http://localhost:8545')
    const web3 = new Web3(provider)
    contractService = await contractServiceHelper(web3)
    ipfsService = new IpfsService({
      ipfsDomain: '127.0.0.1',
      ipfsApiPort: '5002',
      ipfsGatewayPort: '8080',
      ipfsGatewayProtocol: 'http'
    })
    marketplace = new Marketplace({ contractService, ipfsService })
    // const accounts = await web3.eth.getAccounts()
    // buyer = accounts[1]

  })

  it('should get all listing ids', async () => {
    const listings = await marketplace.getListingsCount()
    expect(listings).to.equal(0)
  })

})
