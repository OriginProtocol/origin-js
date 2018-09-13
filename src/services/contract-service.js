import ClaimHolderRegisteredContract from './../../contracts/build/contracts/ClaimHolderRegistered.json'
import ClaimHolderPresignedContract from './../../contracts/build/contracts/ClaimHolderPresigned.json'
import ClaimHolderLibrary from './../../contracts/build/contracts/ClaimHolderLibrary.json'
import KeyHolderLibrary from './../../contracts/build/contracts/KeyHolderLibrary.json'
import V00_UserRegistryContract from './../../contracts/build/contracts/V00_UserRegistry.json'
import OriginIdentityContract from './../../contracts/build/contracts/OriginIdentity.json'
import OriginTokenContract from './../../contracts/build/contracts/OriginToken.json'

import V00_MarketplaceContract from './../../contracts/build/contracts/V00_Marketplace.json'
import V01_MarketplaceContract from './../../contracts/build/contracts/V01_Marketplace.json'

import bs58 from 'bs58'
import Web3 from 'web3'

class ContractService {
  constructor(options = {}) {
    const externalWeb3 = options.web3 || window.web3
    if (!externalWeb3) {
      throw new Error(
        'web3 is required for Origin.js. Please pass in web3 as a config option.'
      )
    }
    this.web3 = new Web3(externalWeb3.currentProvider)

    this.marketplaceContracts = {
      V00_Marketplace: V00_MarketplaceContract,
      V01_Marketplace: V01_MarketplaceContract
    }

    const contracts = Object.assign(
      {
        V00_UserRegistry: V00_UserRegistryContract,
        ClaimHolderRegistered: ClaimHolderRegisteredContract,
        ClaimHolderPresigned: ClaimHolderPresignedContract,
        OriginIdentity: OriginIdentityContract,
        OriginToken: OriginTokenContract
      },
      this.marketplaceContracts
    )

    this.libraries = {}
    this.libraries.ClaimHolderLibrary = ClaimHolderLibrary
    this.libraries.KeyHolderLibrary = KeyHolderLibrary
    this.contracts = {}
    for (const name in contracts) {
      this.contracts[name] = contracts[name]
      try {
        this.contracts[name].networks = Object.assign(
          {},
          this.contracts[name].networks,
          options.contractAddresses[name]
        )
      } catch (e) {
        /* Ignore */
      }
    }
  }

  // Returns an object that describes how many marketplace
  // contracts are available.
  async marketplaceContractsFound() {
    const networkId = await web3.eth.net.getId()

    const contractCount = Object.keys(this.marketplaceContracts).length
    const contractsFound = Object.keys(this.marketplaceContracts).filter(
      contractName =>
        this.marketplaceContracts[contractName].networks[networkId]
    ).length

    return {
      allContractsPresent: contractCount === contractsFound,
      someContractsPresent: contractsFound > 0
    }
  }

  // Return bytes32 hex string from base58 encoded ipfs hash,
  // stripping leading 2 bytes from 34 byte IPFS hash
  // Assume IPFS defaults: function:0x12=sha2, size:0x20=256 bits
  // E.g. "QmNSUYVKDSvPUnRLKmuxk9diJ6yS96r1TrAXzjTiBcCLAL" -->
  // "0x017dfd85d4f6cb4dcd715a88101f7b1f06cd1e009b2327a0809d01eb9c91f231"
  getBytes32FromIpfsHash(ipfsListing) {
    return (
      '0x' +
      bs58
        .decode(ipfsListing)
        .slice(2)
        .toString('hex')
    )
  }

  // Return base58 encoded ipfs hash from bytes32 hex string,
  // E.g. "0x017dfd85d4f6cb4dcd715a88101f7b1f06cd1e009b2327a0809d01eb9c91f231"
  // --> "QmNSUYVKDSvPUnRLKmuxk9diJ6yS96r1TrAXzjTiBcCLAL"
  getIpfsHashFromBytes32(bytes32Hex) {
    // Add our default ipfs values for first 2 bytes:
    // function:0x12=sha2, size:0x20=256 bits
    // and cut off leading "0x"
    const hashHex = '1220' + bytes32Hex.slice(2)
    const hashBytes = Buffer.from(hashHex, 'hex')
    const hashStr = bs58.encode(hashBytes)
    return hashStr
  }

  // Returns the first account listed, unless a default account has been set
  // explicitly
  async currentAccount() {
    const defaultAccount = this.web3.eth.defaultAccount
    if (defaultAccount) {
      return defaultAccount
    } else {
      const accounts = await this.web3.eth.getAccounts()
      return accounts[0]
    }
  }

  // async convenience method for getting block details
  getBlock(blockHash) {
    return new Promise((resolve, reject) => {
      this.web3.eth.getBlock(blockHash, (error, data) => {
        if (error) {
          reject(error)
        } else {
          resolve(data)
        }
      })
    })
  }

  async getTimestamp(event) {
    const { timestamp } = await this.getBlock(event.blockHash)
    return timestamp
  }

  // async convenience method for getting transaction details
  getTransaction(transactionHash) {
    return new Promise((resolve, reject) => {
      this.web3.eth.getTransaction(transactionHash, (error, data) => {
        if (error) {
          reject(error)
        } else {
          resolve(data)
        }
      })
    })
  }

  async deployed(contract, addrs) {
    const net = await this.web3.eth.net.getId()
    const storedAddress =
      contract.networks[net] && contract.networks[net].address
    addrs = addrs || storedAddress || null
    return new this.web3.eth.Contract(contract.abi, addrs)
  }

  async getBytecode(contract) {
    const net = await this.web3.eth.net.getId()
    const bytecode = contract.bytecode
    const withLibraryAddresses = bytecode.replace(/__[^_]+_+/g, matchedStr => {
      const libraryName = matchedStr.replace(/_/g, '')
      const library = this.libraries[libraryName]
      const libraryAddress =
        library.networks[net] && library.networks[net].address
      const withoutPrefix = libraryAddress.slice(2)
      return withoutPrefix
    })
    return withLibraryAddresses
  }

  async deploy(contract, args, options) {
    const bytecode = await this.getBytecode(contract)
    const deployed = await this.deployed(contract)
    const txReceipt = await new Promise((resolve, reject) => {
      deployed
        .deploy({
          data: bytecode,
          arguments: args
        })
        .send(options)
        .on('receipt', receipt => {
          resolve(receipt)
        })
        .on('error', err => reject(err))
    })
    return txReceipt
  }

  async call(
    contractName,
    functionName,
    args = [],
    { contractAddress, from, gas, value, confirmationCallback } = {}
  ) {
    const contractDefinition = this.contracts[contractName]
    if (typeof contractDefinition === 'undefined') {
      throw new Error(
        `Contract not defined on contract service: ${contractName}`
      )
    }
    // Setup options
    const opts = { from, gas, value }
    opts.from = opts.from || (await this.currentAccount())
    // Get contract and run trasaction
    const contract = await this.deployed(contractDefinition)
    contract.options.address = contractAddress || contract.options.address
    const method = contract.methods[functionName].apply(contract, args)
    if (method._method.constant) {
      return await method.call(opts)
    }
    // set gas
    opts.gas = opts.gas || (await method.estimateGas(opts))
    const transactionReceipt = await new Promise((resolve, reject) => {
      method
        .send(opts)
        .on('receipt', resolve)
        .on('confirmation', confirmationCallback)
        .on('error', reject)
    })
    const block = await this.web3.eth.getBlock(transactionReceipt.blockNumber)
    return {
      // return current time in seconds if block is not found
      timestamp: block ? block.timestamp : Math.floor(Date.now() / 1000),
      transactionReceipt
    }
  }
}

export default ContractService
