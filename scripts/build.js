const chalk = require('chalk')
const fs = require('fs-extra')
const buildContracts = require('./helpers/build-contracts')
const copyReleaseCompiledContracts = require('./helpers/copy-release-compiled-contracts')
const webpack = require('webpack')
const webpackConfig = require('../webpack.config.js')

const build = async () => {
  const compiler = webpack(webpackConfig)

  // If the contract build directory does not exist or is empty,
  // copy the compiled contract files from the latest release into it.
  const dstDir = 'contracts/build/contracts'
  if (fs.pathExistsSync(dstDir) && fs.readdirSync(dstDir).length > 0) {
    console.log(chalk.blue('Contracts build directory already exists and not empty, skipping copy.'))
  } else {
    copyReleaseCompiledContracts(dstDir)
  }
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

build()
