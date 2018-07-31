const { spawn } = require('child_process')
const minifyContracts = require('./minify-contracts')
const precompile = require('../precompile')

const deployContracts = () => {
  return new Promise((resolve, reject) => {
    precompile('./contracts/origin_contracts', './contracts/contracts')
    const truffleMigrate = spawn(
      '../node_modules/.bin/truffle',
      ['migrate', '--reset', '--compile-all'],
      { cwd: './contracts' }
    )
    truffleMigrate.stdout.pipe(process.stdout)
    truffleMigrate.stderr.on('data', data => {
      reject(String(data))
    })
    truffleMigrate.on('exit', code => {
      if (code === 0) {
        console.log('Truffle migrate finished OK.')
      }
      minifyContracts()
      resolve()
    })
  })
}

module.exports = deployContracts
