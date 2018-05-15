var Web3 = require('web3')
var HDWalletProvider = require("truffle-hdwallet-provider");

const got = require('got')

let mnemonic = process.env.MNEMONIC

let ethLimit = 3 // need at least 3 etht to get through deploy errors
let addressCount = 4
let rinkby = 'https://rinkeby.infura.io/'
let ropsten = 'https://ropsten.infura.io/'

let allAccounts = []

var provider = new HDWalletProvider(mnemonic, rinkby,0,addressCount);
var web3 = new Web3()
web3.setProvider(provider)
allAccounts.push({provider: rinkby, web3: web3 })

var provider = new HDWalletProvider(mnemonic, ropsten,0,addressCount);
var web3 = new Web3()
web3.setProvider(provider)
allAccounts.push({provider: ropsten, web3: web3 })

async function getBalances(providers){
  var balances = []

  for (var index = 0; index < providers.length; index++) {
    var provider = providers[index]

    var web3 = provider.web3
    var accounts = await web3.eth.getAccounts()
    
    for( var i = 0 ; i < accounts.length; i ++){
      var account = accounts[i]
      var result = await web3.eth.getBalance(account)
      var balance = web3.utils.fromWei(result)
      balances.push({provider: provider.provider, address: account, eth: balance})
    }
  }
  return balances
}

const run = async () => {
  var accounts = await getBalances(allAccounts);
  for(var i = 0 ; i < accounts.length; i++){
    var account = accounts[i]
    if( account.eth < ethLimit){
      if( account.provider == ropsten){
        console.log(`\nLow Ropsten wallet loading via api: ${account.address}`)
        try{
          var response = await got(`http://faucet.ropsten.be:3001/donate/${account.address}`,{json: true})
          console.log(response.body.message || "Success");
        } catch(error) {
          console.log(error)
        }
      } else {
          console.log(`\nLow Rinkby wallet: ${account.address}`)
          console.log(`Go to https://faucet.rinkeby.io/ for ${account.address}`)
      }
    } else {
      console.log(`\nGood ${account.provider} wallet: ${account.address}`)
    }
  }
  return
}

run().then(function(){ process.exit() } )
