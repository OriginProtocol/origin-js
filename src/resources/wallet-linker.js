import ZeroClientProvider from 'web3-provider-engine/zero'
import uuidv1 from 'uuid/v1';

const appendSlash = (url) => {
  return (url.substr(-1) === "/") ? url : url + "/"
}


class WalletLinker {
  constructor({linkerServerUrl, fetch, networkChangeCb, web3}) {
    this.serverUrl = linkerServerUrl
    this.fetch = fetch
    this.accounts = []
    this.networkChangeCb = networkChangeCb
    this.callbacks = {}
    this.session_token = ""
    this.web3 = web3
    this.loadLocalStorage()
  }

  logout() {
      localStorage.setItem("walletLinkerData", JSON.stringify({
        accounts:[],
        session_token:""
      }))
      this.loadLocalStorage()
  }

  loadLocalStorage() {
    let wallet_data_str = localStorage.getItem("walletLinkerData");
    let wallet_data = undefined
    try{
       wallet_data = JSON.parse(wallet_data_str)
    }catch(err){
    }

    if (wallet_data)
    {
      this.accounts = wallet_data.accounts
      this.networkRpcUrl = wallet_data.networkRpcUrl,
      this.session_token = wallet_data.session_token,
      this.last_message_id = wallet_data.last_message_id
      this.linked = wallet_data.linked
    }
  }


  syncLocalStorage() {
      let wallet_data = {
        accounts:this.accounts,
        networkRpcUrl:this.networkRpcUrl,
        linked:this.linked,
        last_message_id:this.last_message_id,
        session_token:this.session_token,
        linked:this.linked
      }
      localStorage.setItem("walletLinkerData", JSON.stringify(wallet_data))
  }


  getProvider() {
    if (this.networkRpcUrl)
    {
      return ZeroClientProvider({
        rpcUrl:this.networkRpcUrl,
        getAccounts: this.getAccounts.bind(this),
        //signTransaction: this.signTransaction.bind(this)
        processTransaction: this.processTransaction.bind(this)
      })
    }
  }

  getAccounts(callback) {
    if (callback){
      callback(undefined, this.accounts)
    }
    else
    {
      return new Promise((resolve, reject) => {
        resolve(this.accounts)
      })
    }
  }

  signTransaction(txn_object, callback) {
    let call_id = uuidv1()
    txn_object["chainId"] = this.web3.utils.toHex(this.netId)
    txn_object["gasLimit"] = txn_object["gas"]
    let result = this.post("call-wallet", {session_token:this.session_token, call_id:call_id, accounts:this.accounts, call:["signTransaction",{txn_object}], return_url:this.getReturnUrl()})

    this.callbacks[call_id] = (data) => {
      callback(undefined, data)
    }

    result.then((data) => {
    }).catch((error_data) => {
      delete this.callbacks[call_id]
      callback(error_data, undefined);
    });
  }

  processTransaction(txn_object, callback) {
    let call_id = uuidv1()
    //translate gas to gasLimit
    txn_object["gasLimit"] = txn_object["gas"]
    let result = this.post("call-wallet", {session_token:this.session_token, call_id:call_id, accounts:this.accounts, call:["processTransaction",{txn_object}], return_url:this.getReturnUrl()})

    this.callbacks[call_id] = (data) => {
      callback(undefined, data.hash)
    }

    result.then((data) => {
    }).catch((error_data) => {
      delete this.callbacks[call_id]
      callback(error_data, undefined);
    });
  }


  async changeNetwork(networkRpcUrl, force=false) {
    if (this.networkRpcUrl != networkRpcUrl || force)
    {
      this.networkRpcUrl = networkRpcUrl
      this.networkChangeCb()
      this.netId = await this.web3.eth.net.getId()
    }
  }

  processMessages(messages) {
    for(let message of messages) {
      switch(message.type)
      {
        case "ACCOUNTS":
          this.accounts = message.accounts
          break;
        case "NETWORK":
          this.changeNetwork(message.network_rpc)
          break;
        case "CALL_RESPONSE":
          if (this.callbacks[message.call_id])
          {
            this.callbacks[message.call_id](message.result)
            delete this.callbacks[message.call_id]
          }
          else
          {
            if (message.result && message.result.purchase)
            {
                alert("Purchase successful.")
            }
          }
          break;
        case "LOGOUT":
          if(this.linked)
          {
            this.logout()
          }
          break;
      }
      if (message.id != undefined)
      {
        this.last_message_id = message.id
        this.syncLocalStorage()
      }
    }
  }

  startMessagesSync() {
    if(!this.interval) 
    {
      //5 second intervals for now
      this.interval = setInterval(this.syncLinkMessages.bind(this), 5*1000)
    }
  }

  getReturnUrl() {
    if ((typeof window.orientation !== "undefined") || (navigator.userAgent.indexOf('IEMobile') !== -1))
    {
        return window.location.href
    }
    else
    {
        return ""
    }
  }

  initSession() {
    if (this.linked)
    {
      this.changeNetwork(this.networkRpcUrl, true)
      this.startMessagesSync()
    }
    else
    {
      this.generateLinkCode()
    }
  }

  async generateLinkCode() {
    let ret = await this.post("generate-code", {return_url:this.getReturnUrl()})
    this.link_code = ret.link_code
    this.linked = ret.linked
    if (ret)
    {
      this.startMessagesSync()
    }
  }

  getLinkCode(){
    return this.link_code
  }

  async syncLinkMessages() {
    let ret = await this.post("link-messages", {session_token:this.session_token, last_message_id:this.last_message_id})
    if (ret.session_token)
    {
      this.session_token = ret.session_token
    }
    if (ret.messages)
    {
      this.linked = true
      this.processMessages(ret.messages)
    }
  }

  async http(baseUrl, url, body, method) {
    let response = await this.fetch(
      appendSlash(baseUrl) + url,
      {
        method,
        credentials: 'include',
        body: body ? JSON.stringify(body) : undefined,
        headers: { "content-type": "application/json" },
      }
    )
    let json = await response.json()
    if (response.ok) {
      return json
    }
    return Promise.reject(JSON.stringify(json))
  }

  async post(url, body) {
    return this.http(this.serverUrl, url, body, 'POST')
  }

  async get(url) {
    return this.http(this.serverUrl, url, undefined, 'GET')
  }
}

module.exports = WalletLinker
