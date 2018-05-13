class ResourceBase {
  constructor({ contractService, ipfsService }) {
    this.contractService = contractService
    this.ipfsService = ipfsService
  }
  /**
   * Runs a call or transaction on a this resource's smart contract.
   *
   * This handles getting the contract, using the correct account,
   * and building our own response for origin transactions.
   *
   * If doing a blockchain call, this returns the data returned by
   * the contract function.
   *
   * If running a transaction, this returns an object with a
   *   - tx - transaction hash
   *   - whenFinished - a promise that resolves when the transaction is mined
   *
   * @param {string} address - address of the contract
   * @param {string} functionName - contract function to be run
   * @param {*[]} args - args for the transaction or call.
   * @param {{gas: number, value:(number | BigNumber)}} options - transaction options for w3
   */
  async contractFn(address, functionName, args = [], options = {}) {
    return await this.contractService.contractFn(
      this.contractDefinition,
      address,
      functionName,
      args,
      options
    )
  }
}

export default ResourceBase
