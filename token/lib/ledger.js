const Web3 = require('web3')
const createLedgerSubprovider = require('@ledgerhq/web3-subprovider').default
const FiltersSubprovider = require('web3-provider-engine/subproviders/filters.js')
const ProviderEngine = require('web3-provider-engine')
const ProviderSubprovider = require('web3-provider-engine/subproviders/provider.js')
const TransportU2F = require('@ledgerhq/hw-transport-node-hid').default

// Based on:
// https://github.com/hussy-io/truffle-ledger-provider
class LedgerProvider {
  constructor(options, url) {
    const getTransport = () => TransportU2F.create()
    const ledger = createLedgerSubprovider(getTransport, options)

    this.engine = new ProviderEngine()
    this.engine.addProvider(ledger)
    this.engine.addProvider(new FiltersSubprovider())
    Web3.providers.HttpProvider.prototype.sendAsync = Web3.providers.HttpProvider.prototype.send
    this.engine.addProvider(new ProviderSubprovider(new Web3.providers.HttpProvider(url)))
    this.engine.start()
  }

  sendAsync() {
    this.engine.sendAsync.apply(this.engine, arguments)
  }

  send() {
    return this.engine.send.apply(this.engine, arguments)
  }

  getAddress() {
    return this.address
  }
}

module.exports = LedgerProvider
