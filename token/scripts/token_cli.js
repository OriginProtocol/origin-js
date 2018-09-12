const path = require('path')

const Config = require('../lib/config.js')
const Token = require('../lib/token.js')

const DEFAULT_NETWORK_ID = '999' // Local blockchain.

const command = `node ${path.basename(__filename)}`
const usage = `
syntax: ${command} --action=ACTION ...

* Transfer 100 OGN to ADDRESS:
  ${command} --action=credit [--network_id=NETWORK_ID] --wallet=ADDRESS
* Print OGN balance for ADDRESS:
 ${command} --action=balance [--network_id=NETWORK_ID] --wallet=ADDRESS
* Print address of token contract:
${command} --action=address [--network_id=NETWORK_ID]
* Pause all token transfers and approvals:
  ${command} --action=pause [--network_id=NETWORK_ID]
* Unpause all token transfers and approvals:
  ${command} --action=unpause [--network_id=NETWORK_ID]

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
    if (!config.wallet) {
      errorAndExit('--wallet=ADDRESS must be specified')
    }
    const balance = await token.balance(config.networkId, config.wallet)
    const displayBalance = Number(balance)
      .toLocaleString(undefined, {
        maximumFractionDigits: 5,
        useGrouping: true
      })
    console.log(`Balance (natural unit) = ${displayBalance}`)
    const displayOgnBalance = Number(token.toTokenUnit(balance))
      .toLocaleString(undefined, {
        maximumFractionDigits: 5,
        useGrouping: true
      })
    console.log(`Balance (in OGN) = ${displayOgnBalance}`)
    break
  }
  case 'credit': {
    // Credit 100 OGN.
    if (!config.wallet) {
      errorAndExit('--wallet=ADDRESS must be specified')
    }
    const newBalance = await token.credit(config.networkId, config.wallet, token.toNaturalUnit(100))
    console.log(`Credited 100 OGN tokens to wallet. New balance (natural unit) = ${newBalance}`)
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
    console.log('Token transfers have been paused.')
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

  // Target wallet for the action.
  wallet: args['--wallet'],

  // Verbose logs.
  verbose: false,
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
