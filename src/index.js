import ContractService from "./contract-service"
import IpfsService from "./ipfs-service"
import UserRegistryService from "./user-registry-service"

var resources = {
  listings: require("./resources/listings"),
  purchases: require("./resources/purchases")
}

class Origin {
  constructor({
    ipfsDomain,
    ipfsApiPort,
    ipfsGatewayPort,
    ipfsGatewayProtocol,
    web3
  } = {}) {
    if (!web3) {
      throw new Error(
        "web3 is required for origin. Please pass in web3 as a config option."
      )
    }

    this.contractService = new ContractService({ web3 })
    this.ipfsService = new IpfsService({
      ipfsDomain,
      ipfsApiPort,
      ipfsGatewayPort,
      ipfsGatewayProtocol
    })

    // TODO: This service is deprecated. Remove once the demo dapp no longer
    // depends on it.
    this.userRegistryService = new UserRegistryService()

    // Instantiate each resource and give it access to contracts and IPFS
    for (let resourceName in resources) {
      let Resource = resources[resourceName]
      // A `Resource` constructor always takes a contractService and ipfsService
      this[resourceName] = new Resource({
        contractService: this.contractService,
        ipfsService: this.ipfsService
      })
    }
  }
}

module.exports = Origin
