// const contractService = require('./contract-service')
// const ipfsService = require('./ipfs-service')
// const originService = require('./origin-service')

import ContractService from './contract-service'
import IpfsService from './ipfs-service'
import OriginService from './origin-service'
import UserRegistryService from './user-registry-service'
import TwitterIdentityService from './twitter-identity-service'

const contractService = new ContractService()
const ipfsService = new IpfsService()
const originService = new OriginService({ contractService, ipfsService })
const userRegistryService = new UserRegistryService()
const twitterIdentityService = new TwitterIdentityService()

var origin = {
    contractService: contractService,
    ipfsService: ipfsService,
    originService: originService,
    userRegistryService: userRegistryService,
    twitterIdentityService: twitterIdentityService
}

var resources = {
    listings: require('./resources/listings')
}

// Give each resource access to the origin services.
// By having a single origin, its configuration can be changed
// and all contracts will follow it
for(var resourceName in resources){
    resources[resourceName].origin = origin
    origin[resourceName] = resources[resourceName]
}

module.exports = origin
