import ResourceBase from './_resource-base'
import Web3 from 'web3'
import secp256k1 from 'secp256k1'
import CryptoJS from 'crypto-js'
import cryptoRandomString from 'crypto-random-string'
import EventEmitter from 'events'

const PROMPT_MESSAGE = "I wish to start messaging on origin protocol."
const PROMPT_PUB_KEY = "My public messaging key is: "
const MESSAGING_KEY = "MK_"
const PUB_MESSAGING_SIG = "PMS_"
const PUB_MESSAGING = "KEY_"
const GLOBAL_KEYS = "global"
const CONV_INIT_PREFIX = "convo-init-"
const CONV = "conv"

class InsertOnlyKeystore {
  constructor(pubKey, privKey, verifier, signFunc) {
    this._verifier = verifier
    this._signFunc = signFunc
    this._pubKey = pubKey
    this._privKey = privKey
  }

  setPostVerify(postFunc) {
    this._post_verify = postFunc
  }

  createKey(id) {
    return ""
  }

  getKey(id) {
    //for some reason Orbit requires a key for verify to be triggered
    return {
      getPublic:(type) => this._pubKey
    }
  }

  async exportPublicKey(key) {
    return this._pubKey
  }

  exportPrivateKey(key) {
    //This function should never be called
  }


  async importPublicKey(key) {
    return this._pubKey
  }

  async importPrivateKey(key) {
    return this._privKey
  }

  async sign(key, data) {
    return this._signFunc(key, data)
  }

  verify(signature, key, data) {
    try {
      let message = JSON.parse(data)
      console.log("verifying:", message)
      if (message.payload.op == "PUT" || message.payload.op == "ADD")
      {
        //verify all for now
        if(this._verifier(signature, key, message, data))
        {
          if (this._post_verify){
            this._post_verify(message)
          }
          return Promise.resolve(true)
        }
      }
    } catch (error) {
      console.log(error)
    }
    return Promise.reject(false)
  }
}

class Messaging extends ResourceBase {
  constructor({contractService, ipfsCreator, OrbitDB, ecies}) {
    super({contractService})
    this.web3 = this.contractService.web3
    this.ipfsCreator = ipfsCreator
    this.OrbitDB = OrbitDB
    this.sharedRooms = {}
    this.convs = {}
    this.ecies = ecies
    this.events = new EventEmitter()
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
    this.events.emit("new", this.account_key)
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

  refreshPeerList () {
    this.ipfs.swarm.peers()
      .then((peers) => {
          let peer_ids = peers.map( x => x.peer._idB58String )
          if (peer_ids && !_.isEqual(peer_ids, this.last_peers))
          {
            console.log("peers updated: ", peer_ids)
            this.last_peers = peer_ids
          }
        }
    )
  }

  initConvs(){
      let initKeyStore = new InsertOnlyKeystore(this.account_key, "-", this.verifySignature("conv_init"), this.signInitPair.bind(this))
      let convKeyStore = new InsertOnlyKeystore(this.account_key, "-", this.verifySignature("conv"), this.signMessaging.bind(this))

      this.conv_init_db = new this.OrbitDB(this.ipfs, "conv_init", {keystore:initKeyStore})
      this.conv_db = new this.OrbitDB(this.ipfs, "convs", {keystore:convKeyStore})

      initKeyStore.setPostVerify(message => this.startConvoRoom(message.payload.key))

      convKeyStore.setPostVerify( message => {
        let writers = this.conv_db.stores[message.id].access.write
        console.log("writers:", writers, " for room:", message.id)
        let room_id = this.joinConversationKey(...writers)
        console.log("message recieved for:", room_id, " message: ", message)
        this.processMessage(room_id, message.payload)
      })
      this.watchMyConv()
  }


  async initRemote() {
    this.ipfs = this.ipfsCreator(this.account_key)

    return new Promise((resolve, reject) => {
      this.ipfs.on('ready', async () => {
        console.log("ipfs starting...")
        if (this.refreshIntervalId)
        {
          clearInterval(this.refreshIntervalId)
        }
        
        this.refreshIntervalId = setInterval(this.refreshPeerList.bind(this), 5000)

        let keystore_global = new InsertOnlyKeystore("-", "-", this.verifySignature(GLOBAL_KEYS), this.signRegistry.bind(this))
        let orbitGlobal = new this.OrbitDB(this.ipfs, "globalNames", {keystore:keystore_global})

        // took a hint from peerpad
        this.global_keys = await orbitGlobal.kvstore(GLOBAL_KEYS, { write: ['*'] })
        await this.global_keys.load()
        console.log("Store:", this.global_keys)

        resolve(this.global_keys)
      }).on('error', reject)
    })
  }

  signRegistry(key, data) {
    console.log("Signing registry:", JSON.parse(data), " key: ", key)
    return this.pub_sig
  }

  signMessaging(key, data) {
    console.log("Signing message:", JSON.parse(data), " key: ", key)
    return this.account.sign(data).signature
  }


  signInitPair(key, data) {
    console.log("Signing message:", JSON.parse(data), " key: ", key)
    return this.account.sign(data).signature
  }

  verifySignature(room)
  {
    return (signature, key, data) => {
      console.log("verify[" , room, "] sig:", signature, " message:", data, " key:", key)
      // pass through for now
      return true
    }
  }

  async initMessaging() {
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
          await this.promptForSignature()
        }
      }
      else if (!entry)
      {
        console.log("We are not prompting for anything...")
        this.setRemoteMessagingSig()
      }

      this.initConvs()
  }

  getRemoteMessagingSig() {
    let entry = this.global_keys.get(this.account_key)
    if (entry && entry.address == this.account.address)
    {
      console.log("Got key from remote...", entry)
      return entry
    }
  }

  setRemoteMessagingSig() {
    console.log("set remote key...")
    this.global_keys.set(this.account_key, {address:this.account.address, 
      msg: this.pub_msg,
      pub_key: this.account.publicKey})

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

  async getShareRoom(db, room_id, db_type, writers, onWrite){
    let key = room_id
    if (writers.lenght == 1 && writers[0] == "*")
    {
      key = room_id + "-" +  writers.join("-")
    }
    if (this.sharedRooms[key])
    {
      return this.sharedRooms[key]
    }
    else
    {
      console.log("Starting db[", room_id, "]")
      let r = await db[db_type](room_id, {write:writers})
      this.sharedRooms[key] = r

      if (onWrite){
        r.events.on("write", onWrite)
      }
      await r.load()
      return r
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
    return this.getShareRoom(this.conv_init_db, room, "kvstore", ["*"])
  }

  processMessage(room_id, payload) {
    if (!this.convs[room_id])
    {
      this.convs[room_id] = {}
    }
    for (let v of payload.value)
    {
      if(v.type == "key")
      {
        if(v.address == this.account_key)
        {
          console.log("v:", v)
          let key = this.ec_decrypt(v.ekey)
          this.convs[room_id].key = key
          console.log("Extrtacted key is:", key, " for:",room_id)
          let buffer = this.convs[room_id].buffer
          while(buffer && buffer.length)
          {
            let emsg = buffer.pop()
            let msg = CryptoJS.AES.decrypt(emsg, key).toString(CryptoJS.enc.Utf8)
            console.log("We got a message:", msg)
            this.events.emit("msg", msg)
          }

        }
      }
      else if (v.type == "msg")
      {
        let key = this.convs[room_id].key
        if (key)
        {
          let msg = CryptoJS.AES.decrypt(v.emsg, key).toString(CryptoJS.enc.Utf8)
          console.log("We got a message:", msg)
          this.events.emit("msg", msg)
        }
        else
        {
          let obj = this.convs[room_id]
          if (obj.buffer)
          {
            obj.buffer.push(v.emsg)
          }
          else
          {
            obj.buffer = [v.emsg]
          }
          console.log("We haven't got keys yet")
        }
      }
    }
  }

  async startConvoRoom(remote_eth_address) {
    let writers = [this.account_key, remote_eth_address].sort()
    let room_id = this.joinConversationKey(...writers)
    let room = await this.getShareRoom(this.conv_db, CONV, "eventlog", writers,
        (dbname, entry, heads) => {
          console.log("conv write:", room_id, " entry:", entry)
          this.processMessage(room_id, entry.payload)
        })
    return room
  }

  async watchMyConv(){
    let watchConv = await this.getConvo(this.account_key)
    console.log("ready for conversations...")
    this.events.emit("ready", this.account_key)
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
    let entry = this.global_keys.get(remote_eth_address)

    if(!entry) {
      console.log("Remote account does not have messaging enabled")
      return
    }

    let self_init_conv = await this.getConvo(this.account_key)
    let remote_init_conv = await this.getConvo(remote_eth_address)
    let ts = Date.now()

    remote_init_conv.set(this.account_key, ts) 
    self_init_conv.set(remote_eth_address, ts)

    let room = await this.startConvoRoom(remote_eth_address)

    //we haven't put any keys here yet
    if (room.iterator({ limit: 2 }).collect().length < 2)
    {
      let encrypt_key = cryptoRandomString(32).toString("hex")
      console.log("the Encrypt key is:", encrypt_key)

      await room.add([{type:"key", ekey:this.ec_encrypt(encrypt_key), address: this.account_key},
        {type:"key", ekey:this.ec_encrypt(encrypt_key, entry.pub_key), address: remote_eth_address}])
      return room
    }
  }

  async sendConvMessage(remote_eth_address, message) {
    if (this._sending_message)
    {
      console.log("There's a Message being sent!")
      return false
    }
    let room_id = this.joinConversationKey(this.account_key, remote_eth_address)
    let room
    console.log("sending to:", room_id)
    if (this.convs[room_id].key)
    {
      room = await this.startConvoRoom(remote_eth_address)
    }
    else
    {
      room = await this.startConv(remote_eth_address)
    }

    let key = this.convs[room_id].key
    let encmsg = CryptoJS.AES.encrypt(message, key).toString()
    this._sending_message = true
    await room.add([{type:"msg", emsg:encmsg, address: this.account_key}])
    this._sending_message = false
    return true
  }
}

export default Messaging
