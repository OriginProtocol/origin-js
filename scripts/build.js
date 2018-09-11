const chalk = require('chalk')
const startGanache = require('./helpers/start-ganache')
const buildContracts = require('./helpers/build-contracts')
const deployContracts = require('./helpers/deploy-contracts')
const preBuild = require('./helpers/pre-build')
const startIpfs = require('./helpers/start-ipfs')
const startTestServer = require('./helpers/start-test-server')
const watch = require('node-watch')
const webpack = require('webpack')

const args = process.argv.slice(2)
const shouldWatch = args.length && args[0] === 'serve'
const noGanache = args.length && args[1] === 'no-ganache'

const start = async () => {
  console.log(chalk`\n{bold.hex('#26d198') ⬢  STARTING BUILD }\n`)
  preBuild()

  /* We need to load webpack config after preBuild step, because if .evn file does not exist pre-build
   * copies contents from dev.env to .env. Without .env file webpack config load command fails
   */
  const webpackConfig = require('../webpack.config.js')
  const compiler = webpack(webpackConfig)

  if (shouldWatch) {
    if (!noGanache) {
      console.log(
        chalk`\n{bold.hex('#1a82ff') ⬢  Starting Local Blockchain }\n`
      )
      await startGanache()
    }
    console.log(chalk`\n{bold.hex('#26d198') ⬢  Deploying Smart Contracts }\n`)
    await deployContracts()
    console.log(chalk`\n{bold.hex('#6e3bea') ⬢  Starting Local IPFS }\n`)
    await startIpfs()

    // watch contracts
    watch('./contracts/contracts', { recursive: true }, (evt, name) => {
      console.log('%s changed.', name)
      deployContracts()
    })

    // watch js
    compiler.watch({}, (err, stats) => {
      if (err || stats.hasErrors()) {
        console.error(err)
      } else {
        console.log(
          stats.toString({
            hash: false,
            modules: false,
            version: false
          })
        )
      }
    })

    console.log(chalk`\n{bold.hex('#1a82ff') ⬢  Starting Test Server }\n`)
    startTestServer()
  } else {
    console.log(chalk`\n{bold.hex('#1a82ff') ⬢  Compiling Smart Contracts }\n`)
    await buildContracts()
    console.log(chalk`\n{bold.hex('#26d198') ⬢  Compiling Webpack }\n`)
    compiler.run(err => {
      if (err) {
        console.log(err)
      } else {
        console.log('webpack compiled successfully')
      }
    })
  }
}

start()
