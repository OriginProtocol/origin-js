var Web3 = require('web3')
const got = require('got');

let limit = 3 // need at least 3 etht to get through deploy errors
let rinkby = 'https://rinkeby.infura.io/'
let ropsten = 'https://ropsten.infura.io/'


let rinkbyAccounts = process.env.RINKBY_ACCOUNTS.split(',')
let ropstenAccounts = process.env.ROPSTEN_ACCOUNTS.split(',')

let allAccounts = []

rinkbyAccounts.forEach(function(address){
  allAccounts.push({provider: rinkby, address: address})
})

ropstenAccounts.forEach(function(address){
  allAccounts.push({provider: ropsten, address: address})
})

async function getBalances(accounts){
  var balances = []

  for (let index = 0; index < accounts.length; index++) {
    var account = accounts[index]

    var web3 = new Web3(account.provider)

    var result = await web3.eth.getBalance(account.address)
    var balance = web3.utils.fromWei(result)
    balances.push({provider: account.provider, address: account.address, eth: balance})
  }
  return balances
}

const run = async () => {
  var accounts = await getBalances(allAccounts);
  for(var i = 0 ; i < accounts.length; i++){
    var account = accounts[i]
    if( account.eth < limit){
      if( account.provider == ropsten){
        console.log(`Low Ropsten wallet loading via api: ${account.address}`)
        try{
          var response = await got(`http://faucet.ropsten.be:3001/donate/${account.address}`,{json: true})
          console.log(response.body.message || "Success");
        } catch(error) {
          console.log(error)
        }
      } else {
          console.log(`Low Rinkby wallet: ${account.address}`)
          console.log(`Go to https://faucet.rinkeby.io/`)
      }
    } else {
      console.log(`Good ${account.provider} wallet: ${account.address}\n`)
    }
  }
}

run()
