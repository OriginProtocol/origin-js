import ResourceBase from './_resource-base'

import OriginTokenContract from './../../contracts/build/contracts/OriginToken.json'

// Token is a light wrapper around the OriginToken contract.
class Token extends ResourceBase {
  /**
   * @constructor
   * @param {ContractService} contractService - Contract service
   * @param {Marketplace} marketplace - Marketplace (to get token address)
   */
  constructor({ contractService, marketplace }) {
    super({ contractService, undefined })
    // In getContract(), we will retrieve the address of the Origin token
    // contract from the marketplace contract.
    this.getTokenAddress = async function() {
      return await marketplace.getTokenAddress()
    }

    this.contractService = contractService
    this.marketplace = marketplace
    this.contractName = 'OriginToken'
  }

  /**
   * Returns Origin token contract, loading it from the address stored in the
   * Marketplace contract. This *may* return an OriginToken contract whose
   * implementation is newer than the Marketplace contract. This ensures that
   * Origin.js has forward compatibility with token contracts, as long as we
   * don't change or remove existing token features.
   * @returns OriginToken contract
   */
  async getContract() {
    if (!this.contract) {
      this.contractAddress = await this.getTokenAddress()
      const web3 = this.contractService.web3
      this.contract = new web3.eth.Contract(
        OriginTokenContract.abi,
        this.contractAddress
      )
      this.decimals = await this.contract.methods.decimals().call()
    }
  }

  /**
   * Returns a balance for an address.
   */
  async balanceOf(address) {
    await this.getContract()
    return await this.contract.methods.balanceOf(address).call()
  }

  /**
   * Returns true if transfers and approvals of tokens are paused at the
   * contract level, false if not.
   */
  async isPaused() {
    await this.getContract()
    return await this.contract.methods.paused().call()
  }

  /**
   * Relays calls to the contract service
   */
  async call(methodName, args, opts) {
    return await this.contractService.call(
      this.contractName,
      methodName,
      args,
      opts
    )
  }

  async setMarketplaceContractAddress() {
    if (!this.marketplaceContractAddress) {
      const { marketplace, contractService } = this
      const { currentVersion, adapters } = marketplace
      const { web3 } = contractService
      const contractName = adapters[currentVersion].contractName
      const networkId = await web3.eth.net.getId()
      this.marketplaceContractAddress = contractService.contracts[contractName].networks[networkId].address
    }
  }

  /**
   * Approve the marketplace contract to transfer OGN on behalf of the seller.
   */
  async approveContract(numTokens, confirmationCallback) {
    await this.getContract()
    await this.setMarketplaceContractAddress()

    const { transactionReceipt, timestamp } = await this.call(
      'approve',
      [this.marketplaceContractAddress, numTokens],
      { confirmationCallback }
    )

    return Object.assign({ timestamp }, transactionReceipt)
  }

  /**
   * Get the total allowance of OGN that the marketplace contract has been approved to transfer
   */
  async getAllowance(tokenOwnerAddress) {
    await this.getContract()
    await this.setMarketplaceContractAddress()

    const allowanceRemaining = await this.call(
      'allowance',
      [tokenOwnerAddress, this.marketplaceContractAddress],
    )
    
    const allowanceNum = parseFloat(allowanceRemaining)

    return allowanceNum / 10 ** this.decimals
  }
}

export default Token
