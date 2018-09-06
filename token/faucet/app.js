const express = require('express')
const { RateLimiterMemory } = require('rate-limiter-flexible')
const Web3 = require('web3')

const Config = require('../lib/config.js')
const Token = require('../lib/token.js')

const DEFAULT_SERVER_PORT = 5000
const DEFAULT_NETWORK_ID = '999' // Local blockchain.

// Credit 100 token units per request.
const NUM_TOKENS = 100


// Starts the Express server.
function runApp(config) {
  const app = express()
  const token = new Token(config)

  // Configure rate limiting. Allow at most 1 request per IP every 5 sec.
  const opts = {
    points: 90,   // Point budget.
    duration: 5, // Reset points consumption every 5 sec.
  }
  const rateLimiter = new RateLimiterMemory(opts)
  const rateLimiterMiddleware = (req, res, next) => {
    rateLimiter.consume(req.connection.remoteAddress)
      .then(() => {
        // Allow request and consume 1 point.
        console.log(`allow request from ${req.connection.remoteAddress}`)
        next()
      })
      .catch((err) => {
        // Not enough points. Block the request.
        console.log('BLOCKING')
        res.status(429).send('<h2>Too Many Requests</h2>')
      })
  }
  // Note: register rate limiting middleware *before* all routes
  // so that it gets executed first.
  app.use(rateLimiterMiddleware)

  // Configure directory for public assets.
  app.use(express.static(__dirname + '/public'))

  // Register the /tokens route for crediting tokens.
  app.get('/tokens', async function (req, res, next) {
    const networkId = req.query.network_id
    const wallet = req.query.wallet
    if (!req.query.wallet) {
      res.send('<h2>Error: A wallet address must be supplied.</h2>')
    } else if (!Web3.utils.isAddress(wallet)) {
      res.send(`<h2>Error: ${wallet} is a malformed wallet address.</h2>`)
      return
    }

    try {
      // Transfer NUM_TOKENS to specified wallet.
      const value = token.toNaturalUnit(NUM_TOKENS)
      const contractAddress = token.contractAddress(networkId)
      const balanceUnit = await token.credit(networkId, wallet, value)
      const balanceToken = token.toTokenUnit(balanceUnit)
      console.log(`${NUM_TOKENS} OGN -> ${wallet} (${balanceUnit})`)

      // Send response back to client.
      const resp = `Credited ${NUM_TOKENS} OGN tokens to wallet<br>` +
                  `New balance (natural unit) = ${balanceUnit}<br>` +
                  `New balance (token unit) = ${balanceToken}<br>` +
                  `OGN token contract address = ${contractAddress}`
      res.send(resp)
    } catch (err) {
      next(err) // Errors will be passed to Express.
    }
  })

  // Start the server.
  app.listen(
    config.port || DEFAULT_SERVER_PORT,
    () => console.log(`Origin faucet app listening on port ${config.port}!`))
}

//
// Main
//
const args = Config.parseArgv()
const config = {
  // Port server listens on.
  port: args['--port'] || DEFAULT_SERVER_PORT,
  // Network ids, comma separated.
  // If no network ids specified, defaults to using local blockchain.
  networkIds: (args['--network_ids'] || DEFAULT_NETWORK_ID).split(','),
}

try {
  config.providers = Config.createProviders(config.networkIds)
} catch (err) {
  console.log('Config error:', err)
  process.exit(-1)
}

runApp(config)
