const chalk = require('chalk')
const startGanache = require('./helpers/start-ganache')
const buildContracts = require('./helpers/build-contracts')
const deployContracts = require('./helpers/deploy-contracts')
const startIpfs = require('./helpers/start-ipfs')
const startTestServer = require('./helpers/start-test-server')
const watch = require('node-watch')
const webpack = require('webpack')
const webpackConfig = require('../webpack.config.js')
const pjson = require('../package.json')

const args = process.argv.slice(2)
const shouldWatch = args[0] === 'serve'
const verbose = args.includes('-p')

start(shouldWatch, verbose).catch(console.error) // async must have catch

async function start(shouldWatch, verbose) {
  printInfo(verbose)
  const compiler = webpack(webpackConfig)

  if (shouldWatch) {
    console.log(chalk`\n{bold.hex('#1a82ff') ⬢  Starting Local Blockchain }\n`)
    await startGanache()
    console.log(chalk`\n{bold.hex('#26d198') ⬢  Deploying Smart Contracts }\n`)
    await deployContracts()
    console.log(chalk`\n{bold.hex('#6e3bea') ⬢  Starting Local IPFS }\n`)
    await startIpfs()

    // there are two parallell execution paths here: TODO 180625 Promise.all

    // watch contracts
    watch('./contracts/contracts', {recursive: true}, (evt, name) => {
      console.log(`${name} changed.`)
      deployContracts().catch(console.error)
    })

    // watch js
    compiler.watch({}, (err, stats) => {
      if (!err && !stats.hasErrors()) {
        console.log(stats.toString({
          hash: false,
          modules: false,
          version: false
        }))
      } else console.error(err)
    })

    console.log(chalk`\n{bold.hex('#1a82ff') ⬢  Starting Test Server }\n`)
    startTestServer()
  } else {
    console.log(chalk`\n{bold.hex('#1a82ff') ⬢  Compiling Smart Contracts }\n`)
    await buildContracts()
    console.log(chalk`\n{bold.hex('#26d198') ⬢  Compiling Webpack }\n`)
    await new Promise((resolve, reject) => compiler.run((e, s) => !e ? resolve(s) : reject(e)))
    console.log('webpack compiled successfully')
  }
}

function printInfo(verbose) {
  const {name, version} = Object(pjson)
  console.log(`package: ${name} version: ${version}`)
  verbose && console.log(process.env)
}
