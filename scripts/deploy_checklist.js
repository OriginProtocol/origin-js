let Web3 = require('web3')
let HDWalletProvider = require("truffle-hdwallet-provider")
const got = require('got')

if (!process.env.RINKEBY_MNEMONIC) {
  console.error("RINKEBY_MNEMONIC is not set.")
  process.exit()
}
let mnemonic = process.env.RINKEBY_MNEMONIC
let ethNodeUrl = 'https://rinkeby.infura.io/'
let addressCount = 2 // How many addresses to handle in walet

let provider = new HDWalletProvider(mnemonic, ethNodeUrl, 0, addressCount)
let web3 = new Web3()
web3.setProvider(provider)

const run = async () => {
  var networkType = await web3.eth.net.getNetworkType()
  console.log(`Network: ${networkType}`)
  var accounts = await web3.eth.getAccounts()
  for (var i = 0; i < accounts.length; i++) {
    var account = accounts[i]
    var result = await web3.eth.getBalance(account)
    var balance = web3.utils.fromWei(result)
    console.log(`${i}\t${account}\t${balance}`)
  }
}

run().then(function(){ process.exit() })
