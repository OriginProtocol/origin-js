const path = require('path')

const Config = require('../lib/config.js')
const Token = require('../lib/token.js')

const DEFAULT_NETWORK_ID = '999' // Local blockchain.

const command = `node ${path.basename(__filename)}`
const usage = `
syntax: ${command} --action=ACTION ...

Transfer 100 OGN to ADDRESS:
${command} --action=credit [--network_id=NETWORK_ID] --address=ADDRESS

Print OGN balance for ADDRESS:
${command} --action=balance [--network_id=NETWORK_ID] --address=ADDRESS

Print address of token contract:
${command} --action=address [--network_id=NETWORK_ID]

Pause all token transfers and approvals:
${command} --action=pause [--network_id=NETWORK_ID]

Unpause all token transfers and approvals:
${command} --action=unpause [--network_id=NETWORK_ID]

Display owner of token contract:
${command} --action=owner [--network_id=NETWORK_ID]

Set owner of token contract to ADDRESS:
${command} --action=setOwner --address=ADDRESS [--network_id=NETWORK_ID]

--network_id defaults to 999 (local blockchain)
`

function errorAndExit(/* all args are logged */) {
  console.error('ERROR:', ...arguments)
  console.error(usage)
  process.exit(-1)
}

async function run(config) {
  const token = new Token(config)

  if (!config.networkId) {
    errorAndExit('--network_id=NETWORK_ID must be specified')
  }

  switch (config.action) {
  case 'balance': {
    // Check wallet balance.
    if (!config.address) {
      errorAndExit('--address=ADDRESS must be specified')
    }
    const balance = await token.balance(config.networkId, config.address)
    const displayBalance = balance.toFixed(0)
    console.log(`Balance (natural unit) = ${displayBalance}`)
    const displayOgnBalance = token.toTokenUnit(balance).toFixed(5)
    console.log(`Balance (in OGN) = ${displayOgnBalance}`)
    break
  }
  case 'credit': {
    // Credit 100 OGN.
    if (!config.address) {
      errorAndExit('--address=ADDRESS must be specified')
    }
    const newBalance = await token.credit(config.networkId, config.address, token.toNaturalUnit(100))
    const newBalanceDisplay = newBalance.toFixed()
    console.log(`Credited 100 OGN tokens to wallet. New balance (natural unit) = ${newBalanceDisplay}`)
    break
  }
  case 'address': {
    // Get the address the token contract was deployed to.
    const address = token.contractAddress(config.networkId)
    console.log(`Token contract address = ${address}`)
    break
  }
  case 'pause': {
    config.verbose = true
    await token.pause(config.networkId)
    console.log('Token transfers have been paused.')
    break
  }
  case 'unpause': {
    config.verbose = true
    await token.unpause(config.networkId)
    console.log('Token transfers have been unpaused.')
    break
  }
  case 'setOwner': {
    config.verbose = true
    if (!config.address) {
      errorAndExit('--address=ADDRESS needs to be specified')
    }
    await token.setOwner(config.networkId, config.address)
    break
  }
  case `owner`: {
    console.log('token owner:', await token.owner(config.networkId))
    break
  }
  case undefined:
    errorAndExit('--action=ACTION must be specified')
  default:
    errorAndExit(`Unsupported action ${config.action}`)
  }
}

//
// Main
//
const args = Config.parseArgv()

const config = {
  // Action: balance, credit, etc...
  action: args['--action'],

  // Network ids, comma separated.
  // If no network ids specified, defaults to using local blockchain.
  networkId: args['--network_id'] || DEFAULT_NETWORK_ID,

  // Target address for the action.
  address: args['--address'],

  // Verbose logs.
  verbose: args['--verbose'],
}

try {
  config.providers = Config.createProviders([config.networkId])
} catch (err) {
  console.log('Config error:', err)
  process.exit(-1)
}

run(config)
  .then(() => {process.exit(0)})
  .catch((err) => { console.trace(err); process.exit(-1) })
