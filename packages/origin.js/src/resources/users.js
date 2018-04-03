import userSchema from '../schemas/user.json'

var Ajv = require('ajv')
var ajv = new Ajv()

module.exports = {
  create: async function(data) {
    let validate = ajv.compile(userSchema)
    if (!validate(data)) {
      throw new Error('invalid user data')
    } else {
      // Submit to IPFS
      let ipfsHash = await this.origin.ipfsService.submitFile(data)

      // Submit to ETH contract
      let txReceipt = await this.origin.contractService.setUser(ipfsHash)
      return txReceipt
    }
  },

  get: async function(address) {
    let userIpfsHash = await this.origin.contractService.getUser(address)
    let userJson = await this.origin.ipfsService.getFile(userIpfsHash)
    return userJson
  }
}
