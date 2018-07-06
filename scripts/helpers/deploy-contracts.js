const { spawn } = require('child_process')
const minifyContracts = require('./minify-contracts')
const path = require('path')

const truffle = path.join('..', 'node_modules', '.bin', 'truffle')
const truffleArgs = ['migrate', '--reset', '--compile-all']
const truffleOpts = {cwd: path.resolve('contracts')}

module.exports = async function deployContracts() {
  const truffleMigrate = spawn(truffle, truffleArgs, truffleOpts)
  truffleMigrate.stdout.pipe(process.stdout)
  await new Promise((resolve, reject) => {
    truffleMigrate.stderr.on('data', data => reject(new Error(`stderr output: ${data}`)))
    truffleMigrate.once('exit', (code, signal) => !code ? resolve() : reject(new Error(`truffle status code: ${code}`)))
  })
  console.log('Truffle migrate finished OK.')
  minifyContracts()
}
