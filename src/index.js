import ContractService from './services/contract-service'
import IpfsService from './services/ipfs-service'
import { Attestations } from './resources/attestations'
import Marketplace from './resources/marketplace'
import Discovery from './resources/discovery'
import Users from './resources/users'
import Messaging from './resources/messaging'
import Token from './resources/token'
import fetch from 'cross-fetch'
import store from 'store'

const VERSION = require('.././package.json').version

class Origin {
  constructor({
    ipfsDomain = process.env.IPFS_DOMAIN,
    ipfsApiPort = process.env.IPFS_API_PORT,
    ipfsGatewayPort = process.env.IPFS_GATEWAY_PORT,
    ipfsGatewayProtocol = process.env.IPFS_GATEWAY_PROTOCOL,
    attestationServerUrl = `${process.env.BRIDGE_SERVER}/api/attestations`,
    discoveryServerUrl = process.env.DISCOVERY_SERVER_URL,
    contractAddresses,
    web3,
    ipfsCreator,
    OrbitDB,
    ecies,
    messagingNamespace
  } = {}) {
    this.version = VERSION

    this.contractService = new ContractService({ contractAddresses, web3 })
    this.ipfsService = new IpfsService({
      ipfsDomain,
      ipfsApiPort,
      ipfsGatewayPort,
      ipfsGatewayProtocol
    })

    this.attestations = new Attestations({
      serverUrl: attestationServerUrl,
      contractService: this.contractService,
      fetch
    })

    this.marketplace = new Marketplace({
      contractService: this.contractService,
      ipfsService: this.ipfsService,
      store
    })

    this.discovery = new Discovery({
      discoveryServerUrl,
      fetch
    })

    this.users = new Users({
      contractService: this.contractService,
      ipfsService: this.ipfsService
    })

    this.messaging = new Messaging({
      contractService: this.contractService,
      ipfsCreator,
      OrbitDB,
      ecies,
      messagingNamespace
    })

    this.token = new Token({
      contractService: this.contractService,
      ipfsService: this.ipfsService,
      marketplace: this.marketplace
    })
  }
}

module.exports = Origin
