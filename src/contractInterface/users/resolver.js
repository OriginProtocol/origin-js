import V00_UsersAdapter from './v00_adapter'
import UserObject from '../../models/user'

class UsersResolver {
  constructor({ contractService, ipfsService }) {
    this.adapters = {
      '000': new V00_UsersAdapter({ contractService, ipfsService })
    }
    this.versions = ['000']
    this.currentVersion = this.versions[this.versions.length - 1]
    this.currentAdapter = this.adapters[this.currentVersion]
  }

  async set({ profile, attestations = [] }) {
    return this.currentAdapter.set({ profile, attestations })
  }

  async get(address) {
    let result = false
    for (let i = this.versions.length - 1; i >= 0; i--) {
      if (!result) {
        const version = this.versions[i]
        result = await this.adapters[version].get(address)
      }
    }
    if (result) {
      return new UserObject(result)
    } else {
      return new UserObject({ address })
    }
  }

  async identityAddress(wallet) {
    let result = false
    for (let i = this.versions.length - 1; i >= 0; i--) {
      if (!result) {
        const version = this.versions[i]
        result = await this.adapters[version].identityAddress(wallet)
      }
    }
    return result
  }
}

module.exports = UsersResolver
