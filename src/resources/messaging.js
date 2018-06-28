import ResourceBase from './_resource-base'
import Web3 from 'web3'
import secp256k1 from 'secp256k1'
import CryptoJS from 'crypto-js'
import cryptoRandomString from 'crypto-random-string'

const PROMPT_MESSAGE = "I wish to start messaging on origin protocol."
const PROMPT_PUB_KEY = "My public messaging key is: "
const MESSAGING_KEY = "MK_"
const PUB_MESSAGING_SIG = "PMS_"
const PUB_MESSAGING = "KEY_"
const GLOBAL_KEYS = "global"
const CONV_INIT_PREFIX = "convo-init-"
const CONV_PREFIX = "convo-"

class Messaging extends ResourceBase {
  constructor({contractService, ipfsCreator, Y, ecies}) {
    super({contractService})
    this.web3 = this.contractService.web3
    this.ipfsCreator = ipfsCreator
    this.Y = Y
    this.sharedYs = {}
    this.convs = {}
    this.ecies = ecies
  }

  onAccount(account_key)
  {
    if ((account_key && !this.account_key) || (account_key != this.account_key))
    {
      this.init(account_key)
    }
  }

  async init(key) {
    this.account_key = key
    //just start it up here
    if(await this.initRemote())
    {
      const sig_key = localStorage.getItem(MESSAGING_KEY+this.account_key)
      this.pub_sig = localStorage.getItem(PUB_MESSAGING_SIG+this.account_key)
      this.pub_msg = localStorage.getItem(PUB_MESSAGING+this.account_key)

      if (sig_key)
      {
        this.setAccount(sig_key)
      }
      else
      {
        this.promptInit()
      }
    }
  }

  repairAll() {
    if (this.crdt && this.crdt.connector.isSynced)
    {
      //for some stupid reason I have to repair this, semi often
      this.crdt.connector.repair()
    }

    Object.keys(this.sharedYs).forEach((key) => {
      this.sharedYs[key].connector.repair()
    })

  }

  refreshPeerList () {
    this.ipfs.swarm.peers()
      .then((peers) => {
          if (peers && !_.isEqual(peers, this.last_peers))
          {
            console.log("peers updated: ", peers)
            this.last_peers = peers
          }
        }
    )
    //this.repairAll()
  }



  async initRemote() {
    this.ipfs = this.ipfsCreator(this.account_key)

    this.ipfs.on('ready', () => {
      console.log("ipfs starting...")
      if (this.refreshIntervalId)
      {
        clearInterval(this.refreshIntervalId)
      }
      this.refreshIntervalId = setInterval(this.refreshPeerList.bind(this), 5000)
    })

    // took a hint from peerpad
    let crdt = await this.Y(
      {
        db: {
          name: 'memory'
        },
        connector: {
          name: 'ipfs', // use the IPFS connector
          ipfs: this.ipfs, // inject the IPFS object
          room: GLOBAL_KEYS,
          verifySignature: this.verifySignature(GLOBAL_KEYS)
        },
        sourceDir: '/node_modules',
        share: {
          ethMessagingKeys:'Map'
        }
      }
    )
    this.crdt = crdt
    return crdt
  }


  verifySignature(room)
  {
    return (peer, message, signature, callback) => {
      console.log("verify[" , room, "] peer:", peer, " message:", JSON.parse(message), " signature:", signature)
      // pass through for now
      callback(0, true)
    }
  }

  initMessaging() {
      let entry = this.getRemoteMessagingSig()

      if (!(this.pub_sig && this.pub_msg))
      {
        if (entry)
        {
          this.pub_sig = entry.sig
          this.pub_msg = entry.msg
        }
        else
        {
          this.promptForSignature()
        }
      }
      else if (!entry)
      {
        this.setRemoteMessagingSig()
      }
  }

  getRemoteMessagingSig() {
    let entry = this.crdt.share.ethMessagingKeys.get(this.account_key)
    if (entry && entry.address == this.account.address)
    {
      console.log("Got key from remote...", entry)
      return entry
    }
  }

  setRemoteMessagingSig() {
    console.log("set remote key...")
    this.crdt.share.ethMessagingKeys.set(this.account_key, {address:this.account.address, 
      msg: this.pub_msg,
      sig: this.pub_sig,
      pub_key: this.account.publicKey})

    this.watchMyConv()
  }

  setAccount(key_str) {
    this.account = this.web3.eth.accounts.privateKeyToAccount(key_str)
    this.account.publicKey = "0x" + secp256k1.publicKeyCreate(new Buffer(key_str.substring(2), 'hex'), false).slice(1).toString("hex")
    //send it to local storage
    localStorage.setItem(MESSAGING_KEY + this.account_key, key_str)
    this.initMessaging()
  }

  async promptInit() {
    const signature = await this.web3.eth.personal.sign(PROMPT_MESSAGE, this.account_key)

    // 32 bytes in hex + 0x
    const sig_key = signature.substring(0, 66)

    this.setAccount(sig_key)
  }

  async promptForSignature() {
    this.pub_msg = PROMPT_PUB_KEY + this.account.address
    this.pub_sig = await this.web3.eth.personal.sign(this.pub_msg, this.account_key)
    localStorage.setItem(PUB_MESSAGING_SIG+this.account_key, this.pub_sig)
    localStorage.setItem(PUB_MESSAGING +this.account_key, this.pub_msg)
    this.setRemoteMessagingSig()
  }

  async getShareY(room_id, verify_func, shareObj){
    if (this.sharedYs[room_id])
    {
      return this.sharedYs[room_id]
    }
    else
    {
      console.log("Starting db[", room_id, "]")
      let y = await this.Y(
        {
          db: {
            name: 'memory'
          },
          connector: {
            name: 'ipfs', // use the IPFS connector
            ipfs: this.ipfs, // inject the IPFS object
            room: room_id,
            verifySignature: verify_func
          },
          sourceDir: '/node_modules',
          share:shareObj
        })
      this.sharedYs[room_id] = y
      return y
    }

  }

  joinConversationKey(converser1, converser2)
  {
    let keys = [converser1, converser2]
    keys.sort()

    return keys.join('-')
  }

  getConvo(eth_address) {
    let room = CONV_INIT_PREFIX + eth_address
    return this.getShareY(room, this.verifySignature(room), {conversers:'Map'})
  }

  processMessage(room_id) {
    if (!this.convs[room_id])
    {
      this.convs[room_id] = {}
    }

    return event => {
      if(event.type == "insert")
      {
        for (let v of event.values)
        {
          if(v.type == "key")
          {
            if(v.address == this.account_key)
            {
              console.log("v:", v)
              this.convs[room_id].key = this.ec_decrypt(v.ekey)
              console.log("Extrtacted key is:", this.convs[room_id].key, " on behalf of:", v.address)
            }
          }
          else if (v.type == "msg")
          {

            let key = this.convs[room_id].key
            let msg = CryptoJS.AES.decrypt(v.emsg, key).toString(CryptoJS.enc.Utf8)
            console.log("We got a message:", msg)
          }

        }
      }
    }
  }

  async startConvoRoom(remote_eth_address) {
    let room_id = CONV_PREFIX + this.joinConversationKey(this.account_key, remote_eth_address)
    let room = await this.getShareY(room_id, this.verifySignature(room_id), {conversation:'Array'})

    room.share.conversation.observe(this.processMessage(room_id))
    return room
  }

  async watchMyConv(){
    let watchConv_y = await this.getConvo(this.account_key)
    console.log("ready for conversations...")
    watchConv_y.share.conversers.observe(event => {
        console.log("new event:", event.name, " type:", event.type)
        if (event.type == "add" || event.type == "update")
        {
          console.log("conversation started with:", event.name)
          this.startConvoRoom(event.name)
        }
    })
  }

  ec_encrypt(text, pub_key) {
    let plaintext = new Buffer(text)
    if (!pub_key)
    {
      pub_key = this.account.publicKey
    }
    return this.ecies.encrypt(new Buffer(pub_key.substring(2), "hex"), plaintext).toString("hex")
  }

  ec_decrypt(buffer) {
    return this.ecies.decrypt(new Buffer(this.account.privateKey.substring(2), "hex"), new Buffer(buffer, "hex")).toString("utf8")
  }

  async startConv(remote_eth_address) {
    let entry = this.crdt.share.ethMessagingKeys.get(remote_eth_address)

    if(!entry) {
      console.log("Remote account does not have messaging enabled")
      return
    }

    let self_y = await this.getConvo(this.account_key)
    let remote_y = await this.getConvo(remote_eth_address)

    let ts = Date.now()
    let msg = this.joinConversationKey(this.account_key, remote_eth_address) + JSON.stringify(ts) 

    let sig_entry = await this.account.sign(msg)
    let sig = sig_entry.signature
    self_y.share.conversers.set(remote_eth_address, {
      ts:ts,
      sig:sig
    })
    remote_y.share.conversers.set(this.account_key, {
      ts:ts,
      sig:sig
    })

    let room = await this.startConvoRoom(remote_eth_address)
    let encrypt_key = cryptoRandomString(32).toString("hex")

    console.log("the Encrypt key is:", encrypt_key)

    room.share.conversation.push([{type:"key", ekey:this.ec_encrypt(encrypt_key), address: this.account_key}])
    room.share.conversation.push([{type:"key", ekey:this.ec_encrypt(encrypt_key, entry.pub_key), address: remote_eth_address}])
  }

  async sendConvMessage(remote_eth_address, message) {
    let room = await this.startConvoRoom(remote_eth_address)
    let room_id = CONV_PREFIX + this.joinConversationKey(this.account_key, remote_eth_address)

    if (this.convs[room_id])
    {
      let key = this.convs[room_id].key
      let encmsg = CryptoJS.AES.encrypt(message, key).toString()
      room.share.conversation.push([{type:"msg", emsg:encmsg, address: this.account_key}])
    }
  }

}

export default Messaging
