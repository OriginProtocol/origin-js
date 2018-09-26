import UsersResolver from '../contractInterface/users/resolver'

class Users {
  constructor({ contractService, ipfsService }) {
    this.resolver = new UsersResolver({ contractService, ipfsService })
  }

  async set({ profile, attestations = [], options = {}}) {
    return this.resolver.set({ profile, attestations, options })
  }

  async get(address) {
    return this.resolver.get(address)
  }
}

module.exports = Users
