const chalk = require('chalk')
const fs = require('fs-extra')
const startGanache = require('./helpers/start-ganache')
const deployContracts = require('./helpers/deploy-contracts')
const startIpfs = require('./helpers/start-ipfs')
const startTestServer = require('./helpers/start-test-server')
const copyReleaseCompiledContracts = require('./helpers/copy-release-compiled-contracts')
const watch = require('node-watch')
const webpack = require('webpack')
const webpackConfig = require('../webpack.config.js')

const args = process.argv.slice(2)
const noGanache = args.length && args[0] === 'no-ganache'

const start = async () => {
  const compiler = webpack(webpackConfig)

  // If the contract build directory does not exist or is empty,
  // copy the compiled contract files from the latest release into it.
  const dstDir = 'contracts/build/contracts'
  if (fs.pathExistsSync(dstDir) && fs.readdirSync(dstDir).length > 0) {
    console.log(chalk.blue('Contracts build directory already exists and not empty, skipping copy.'))
  } else {
    copyReleaseCompiledContracts(dstDir)
  }
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
}

start()
