const testJavascriptHelper = require('./helpers/test-javascript')
const chalk = require('chalk')
const watch = require('node-watch')
const startGanache = require('./helpers/start-ganache')
const startIpfs = require('./helpers/start-ipfs')

const start = async () => {
  console.log(chalk`\n{bold.hex('#26d198') ⬢  Starting Local Blockchain }\n`)
  await startGanache()
  console.log(chalk`\n{bold.hex('#1a82ff') ⬢  Starting Local IPFS }\n`)
  await startIpfs()
  console.log(chalk`\n{bold.hex('#1a82ff') ⬢  Testing Javascript }\n`)
  testJavascriptHelper()

  // watch contracts
  watch(
    ['./contracts/contracts', './test', './src'],
    { recursive: true },
    async (evt, name) => {
      console.log('%s changed.', name)
      testJavascriptHelper()
    }
  )
}

start()
