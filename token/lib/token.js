const BigNumber = require('bignumber.js')
const TokenContract = require('../../contracts/build/contracts/OriginToken.json')
const Web3 = require('web3')

// Token helper class.
class Token {
  /*
   * @params {object} config - Configuration dict.
   */
  constructor(config) {
    this.config = config
    // TODO(franck): Get this from the token contract ABI.
    this.decimals = 18
    this.scaling = BigNumber(10).exponentiatedBy(this.decimals)
  }

  /*
  * Converts from token unit to "natural unit" aka fixed-point representation.
  * The token contract only manipulates natural units.
  * @param {int|BigNumber} - Value in token unit.
  * @return {BigNumber} - Value in natural unit.
  */
  toNaturalUnit(value) {
    return BigNumber(value).multipliedBy(this.scaling)
  }

  /*
   * Converts from natural unit to token unit aka decimal representation.
   * @param {BigNumber} - Value in natural unit.
   * @return {BigNumber} - Value in token unit.
   */
  toTokenUnit(value) {
    return BigNumber(value).dividedBy(this.scaling)
  }

  /*
   * Returns the token contract's address.
   * @params {string} networkId - Test network Id.
   * @return {string} - Address contract was deployed to.
   */
  contractAddress(networkId) {
    return TokenContract.networks[networkId].address
  }

  /*
   * Returns token contract object for the specified network.
   * @params {string} networkId - Test network Id.
   * @throws Throws an error if the operation failed.
   * @returns {object} - Promise that resolves to contract object.
   */
  contract(networkId) {
    const provider = this.config.providers[networkId]
    let web3 = new Web3(provider)

    // Create a token contract objects based on its ABI and address on the network.
    const contractAddress = this.contractAddress(networkId)
    return new web3.eth.Contract(TokenContract.abi, contractAddress)
  }

  /*
   * Credits tokens to a wallet.
   * @params {string} networkId - Test network Id.
   * @params {string} wallet - Address of the recipient wallet.
   * @params {int} value - Value to credit, in natural unit.
   * @throws Throws an error if the operation failed.
   * @returns {BigNumber} - Token balance of the wallet, in natural unit.
   */
  async credit(networkId, wallet, value) {
    const contract = this.contract(networkId)

    // At token contract deployment, the entire initial supply of tokens is assigned to
    // the first wallet generated using the mnemonic.
    const provider = this.config.providers[networkId]
    const tokenSupplier = provider.addresses[0]

    // Transfer numTokens from the supplier to the target wallet.
    const supplierBalance = await contract.methods.balanceOf(tokenSupplier).call()
    if (value > supplierBalance) {
      throw new Error('insufficient funds for token transfer')
    }
    const paused = await contract.methods.paused().call()
    if (paused) {
      throw new Error('token transfers are paused')
    }
    await contract.methods.transfer(wallet, value).send({ from: tokenSupplier, gas: 100000 })

    // Return wallet's balance after credit.
    return this.balance(networkId, wallet)
  }

  /*
   * Returns the token balance for a wallet on the specified network.
   * @params {string} networkId - Test network Id.
   * @params {string} wallet - Address of the recipient wallet.
   * @throws Throws an error if the operation failed.
   * @returns {BigNumber} - Token balance of the wallet, in natural unit.
   */
  async balance(networkId, wallet) {
    const contract = this.contract(networkId)
    const balance = await contract.methods.balanceOf(wallet).call()
    return BigNumber(balance)
  }
}

module.exports = Token
