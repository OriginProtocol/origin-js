const marketplaceContract = 'v02_MarketplaceContract'

class MarkeplaceAdapter {
  constructor({ contractService, ipfsService, fetch, indexingServerUrl }) {
    this.contractService = contractService
    this.ipfsService = ipfsService
    this.fetch = fetch
    this.indexingServerUrl = indexingServerUrl
  }

  async getListingsCount() {
    const total = await this.contractService.call(
      marketplaceContract,
      'totalListings'
    )
    return Number(total)
  }

  async createListing(ipfsHash, json) {
    const account = await this.contractService.currentAccount()
    const ipfsBytes = this.contractService.getBytes32FromIpfsHash(ipfsHash)

    return await this.contractService.call(
      marketplaceContract,
      'createListing',
      [ipfsBytes, json.deposit || '1', json.arbitrator || '0x0'],
      { from: account, gas: 4612388 }
    )
  }
}

module.exports = MarkeplaceAdapter
