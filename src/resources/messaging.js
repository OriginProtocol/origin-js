import ResourceBase from './_resource-base'
import Web3 from 'web3'
import secp256k1 from 'secp256k1'
import CryptoJS from 'crypto-js'
import cryptoRandomString from 'crypto-random-string'
import EventEmitter from 'events'
import Ajv from 'ajv'

const PROMPT_MESSAGE = "I wish to start messaging on origin protocol."
const PROMPT_PUB_KEY = "My public messaging key is: "
const MESSAGING_KEY = "MK_"
const PUB_MESSAGING_SIG = "PMS_"
const PUB_MESSAGING = "KEY_"
const GLOBAL_KEYS = "global"
const CONV_INIT_PREFIX = "convo-init-"
const CONV = "conv"

const MESSAGE_FORMAT = {
  type:'object',
  required:["created", "content"],
  properties:{
    content: {type:'string'},
    created: {type:'number'}
  }
}
const validator = new Ajv()
const validateMessage = validator.compile(MESSAGE_FORMAT)

const DEFAULT_ORBIT_OPTIONS = {referenceCount: 0}

class InsertOnlyKeystore {
  constructor(pubKey, privKey) {
    this._signVerifyRegistry = {}
    this._pubKey = pubKey
    this._privKey = privKey
  }

  registerSignVerify(db_id, signFunc, verifyFunc, postFunc) {
    this._signVerifyRegistry[db_id] = { signFunc, verifyFunc, postFunc}
  }

  getSignVerify(id) {
    let parts = id.split("/")
    let end = parts[parts.length-1]
  
    let obj = this._signVerifyRegistry[end]
    if (obj) return obj

    for (const k of Object.keys(this._signVerifyRegistry))
    {
      if (k.endsWith("-") && end.startsWith(k))
      {
        return this._signVerifyRegistry[k]
      }
    }
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
    return key
  }

  async importPrivateKey(key) {
    return this._privKey
  }

  async sign(key, data) {
    let message = JSON.parse(data)
    let obj = this.getSignVerify(message.id)
    if (obj && obj.signFunc)
    {
      return obj.signFunc(key, data)
    }
  }

  verify(signature, key, data) {
    try {
      let message = JSON.parse(data)
      console.log("verifying:", message)
      let obj = this.getSignVerify(message.id)
      if (obj && obj.verifyFunc)
      {
        if (message.payload.op == "PUT" || message.payload.op == "ADD")
        {
          //verify all for now
          if(obj.verifyFunc(signature, key, message, data))
          {
            if (obj.postFunc){
              obj.postFunc(message)
            }
            return Promise.resolve(true)
          }
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

  getMessagingKey()
  {
    return localStorage.getItem(MESSAGING_KEY+this.account_key)
  }

  initKeys() {
      const sig_key = this.getMessagingKey()
      if (sig_key)
      {
        this.setAccount(sig_key)
      }
      else
      {
        this.promptInit()
      }
  }


  startConversing() {
    if (this.ipfs_bound_account == this.account_key && !this.account)
    {
      //remote has been initialized
      this.initKeys()
    }
    else
    {
      this.convs_enabled = true
    }
  }

  async init(key) {
    this.account_key = key
    this.account = undefined
    this.events.emit("new", this.account_key)
    //just start it up here
    if(await this.initRemote())
    {
      this.pub_sig = localStorage.getItem(PUB_MESSAGING_SIG+this.account_key)
      this.pub_msg = localStorage.getItem(PUB_MESSAGING+this.account_key)

      this.initConvs()
      this.events.emit("initialized", this.account_key)
      if(this.convs_enabled || this.getMessagingKey())
      {
        console.log("setting the initiate keys...")
        this.initKeys()
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
      this.main_orbit.keystore.registerSignVerify(CONV_INIT_PREFIX, this.signInitPair.bind(this), this.verifyConversationSignature.bind(this),
        message => {
          let eth_address = message.id.substr(-42) //hopefully the last 42 is the eth address
          console.log("verifying conv-init", eth_address, " vs ", this.account_key)
          if (eth_address == this.account_key)
          {
            console.log("pending conversations...", message.payload.key)
            this.events.emit("pending_conv", message.payload.key)
            const remote_address = message.payload.key
            this.startConvoRoom(remote_address)
            this.getConvo(remote_address)
          }
        }
      )
      this.main_orbit.keystore.registerSignVerify(CONV, this.signInitPair.bind(this), this.verifyMessageSignature.bind(this))

      this.watchMyConv()
  }

  orbitStoreOptions(options) {
    return Object.assign(Object.assign({}, DEFAULT_ORBIT_OPTIONS), options)
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

        let main_keystore = new InsertOnlyKeystore(this.account_key, "-")
        this.main_orbit = new this.OrbitDB(this.ipfs, "main_orbit", {keystore:main_keystore})

        main_keystore.registerSignVerify(GLOBAL_KEYS, this.signRegistry.bind(this), this.verifyRegistrySignature.bind(this))

        // took a hint from peerpad
        this.global_keys = await this.main_orbit.kvstore(GLOBAL_KEYS, this.orbitStoreOptions({ write: ['*'] }))

        try {
          await this.global_keys.load()
        } catch(error)
        {
          console.log(error)
        }
        console.log("Store:", this.global_keys)

        this.ipfs_bound_account = this.account_key
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

  verifyRegistrySignature(signature, key, message)
  {
    let value = message.payload.value
    let set_key = message.payload.key
    let verify_address = web3.eth.accounts.recover(value.msg, signature)
    if (verify_address == set_key && value.msg.includes(value.address))
    {
      let extracted_address = "0x" + web3.utils.sha3(value.pub_key).substr(-40)
      if (extracted_address == value.address.toLowerCase())
      {
        let verify_ph_address = web3.eth.accounts.recover(value.ph, value.phs)
        if (verify_ph_address == value.address)
        {
          console.log("Key Verified: ", value.msg, " Signature: ", signature,  " Signed with: ", verify_address)
          return true
        }
      }
    }
    console.log("Verify failed...")
    return false
  }

  verifyMessageSignature(signature, key, message, buffer)
  {
    let verify_address = web3.eth.accounts.recover(buffer.toString("utf8"), signature)
    let entry = this.global_keys.get(key)
    console.log("key:", key, "Verifying address: ", verify_address, " entry:", entry)
    //only two addresses should have write access to here
    if (entry && entry.address == verify_address)
    {
      return true
    }
    return false
  }

  verifyConversationSignature(signature, key, message, buffer)
  {
    let verify_address = web3.eth.accounts.recover(buffer.toString("utf8"), signature)
    let eth_address = message.id.substr(-42) //hopefully the last 42 is the eth address
    if(key == message.payload.key || key == eth_address) //only one of the two conversers can set this parameter
    {
      let entry = this.global_keys.get(key)
      if (entry.address == verify_address)
      {
        return true
      }
    }
    return false
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
      console.log("ready for conversations...")
      this.events.emit("ready", this.account_key)
      this.loadMyConvs()
  }

  getRemoteMessagingSig() {
    let entry = this.global_keys.get(this.account_key)
    console.log("Got key from remote...", entry, " vs address:", this.account.address)
    if (entry && entry.address == this.account.address)
    {
      return entry
    }
  }

  setRemoteMessagingSig() {
    console.log("set remote key...")
    let msg = PROMPT_MESSAGE
    this.global_keys.set(this.account_key, {address:this.account.address, 
      msg: this.pub_msg,
      pub_key: this.account.publicKey,
      ph:msg,
      phs: this.account.sign(msg).signature})

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

  async getShareRoom(room_id, db_type, writers, onShare){
    let key = room_id
    if (writers.length != 1 || writers[0] != "*")
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
      let r = await this.main_orbit[db_type](room_id, this.orbitStoreOptions({write:writers}))
      this.sharedRooms[key] = r

      if (onShare){
        onShare(r)
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
    return this.getShareRoom(room, "kvstore", ["*"])
  }

  decryptMsg(iv_str, msg, key)
  {
    const buffer = CryptoJS.AES.decrypt(msg, key, {iv:CryptoJS.enc.Base64.parse(iv_str)})
    let out_text
    try {  
      out_text = buffer.toString(CryptoJS.enc.Utf8)
    } catch(error) {
      return
    }

    if (out_text && out_text.length > 6)
    {
      const verify_text = out_text.slice(0, -6)
      const sha_check = out_text.substr(-6)
      if (sha_check == CryptoJS.enc.Base64.stringify(CryptoJS.SHA1(verify_text)).substr(0, 6))
      {
        return verify_text
      }
    }
  }

  processEntry(entry, conv_obj, onMessage, onEncrypted)
  {
    for (let v of entry.payload.value)
    {
      if(v.type == "key")
      {
        if(v.address == this.account_key)
        {
          let key = this.ec_decrypt(v.ekey)
          if (key && !conv_obj.keys.includes(key))
          {
            conv_obj.keys.push(key)
            console.log("Extrtacted key is:", key)
          }
        }
      }
      else if (v.type == "msg")
      {
        let decrypted = false
        for(const key of conv_obj.keys)
        {
          const buffer = this.decryptMsg(v.i, v.emsg, key)
          if (buffer != undefined)
          {
            let obj = buffer
            try{
              obj = JSON.parse(buffer)
            }catch(error){
              //pass
            }
            if (!validateMessage(obj))
            {
              //force it to be an object
              continue
            }
            onMessage(obj, v.address)
            decrypted = true
            break
          }
        }
        if(!decrypted && onEncrypted)
        {
          onEncrypted(v.emsg, v.address)
        }
      }
    }
  }

  processMessage(room_id, room, ignore_current_hash) {
    if (!this.convs[room_id])
    {
      this.convs[room_id] = {keys:[]}
    }
    let conv_obj = this.convs[room_id]
    let last_hashes = ignore_current_hash ? [] : conv_obj.last_hashes || []
    let ops = room._index.get()
    let hashes = ops.map((e) => e.hash)
  
    ops.forEach((entry, index) => {
      if (index == last_hashes.indexOf(entry.hash))
      {
        //we seen this already
        return
      }
      this.processEntry(entry, conv_obj, (message, address) => {
        console.log("We got a message:", message, "on index", index)
        this.events.emit("msg", message, index, address, entry.hash)
      },  (emessage, address) => {
        console.log("We got a encrypted message:", emessage, "on index", index)
        this.events.emit("emsg", emessage, index, address, entry.hash)
      })
    })

    conv_obj.last_hashes = hashes
    conv_obj.last_hash = hashes[hashes.length-1]
    console.log("Last check hash:", conv_obj.last_hash)
  }

  getAllMessages(remote_eth_address)
  {
    let room_id = this.joinConversationKey(this.account_key, remote_eth_address)
    let conv_obj = this.convs[room_id]

    if (conv_obj){
      let room = this.sharedRooms[CONV + "-" + room_id]
      let ops = room._index.get()
      let messages = []
      ops.forEach((entry, index) => {
        this.processEntry(entry, conv_obj, (message, address) => {
          messages.push({msg:message, index, address, hash:entry.hash})
        })
      })
      return messages
    }
  }

  getAllRawMessages(remote_eth_address)
  {
    let room_id = this.joinConversationKey(this.account_key, remote_eth_address)
    let conv_obj = this.convs[room_id]

    if (conv_obj){
      let room = this.sharedRooms[CONV + "-" + room_id]
      let ops = room._index.get()
      let messages = []
      ops.forEach((entry, index) => {
        for (const v of entry.payload.value)
        {
          messages.push(v)
        }
      })
      return messages
    }
  }

  getMessagesCount(remote_eth_address)
  {
    let room_id = this.joinConversationKey(this.account_key, remote_eth_address)
    let conv_obj = this.convs[room_id]

    if (conv_obj){
      const room = this.sharedRooms[CONV + "-" + room_id]
      const ops = room._index.get()
      let messages_count = 0
      ops.forEach((entry, index) => {
        for (const v of entry.payload.value)
        {
          if (v.type == "msg")
          {
            messages_count += 1
          }
        }
      })
      return messages_count
    }
  }


  async startConvoRoom(remote_eth_address) {
    let writers = [this.account_key, remote_eth_address].sort()
    let room_id = this.joinConversationKey(...writers)
    let room = await this.getShareRoom(CONV, "eventlog", writers,
        (room) => {
          room.events.on("write", (dbname, entry, items) => {
            console.log("conv write:", room_id)
            this.processMessage(room_id, room)
          })
          room.events.on("ready", (dbname, entry, items) => {
            console.log("conv ready:", room_id)
            this.processMessage(room_id, room)
          })
          room.events.on("replicated", (dbname) => {
            console.log("conv replicated:", room_id)
            this.processMessage(room_id, room)
          })

        })
    return room
  }

  async watchMyConv(){
    let watchConv = await this.getConvo(this.account_key)
    console.log("watching convs...")
  }

  async getMyConvs() {
    let watchConv = await this.getConvo(this.account_key)
    return watchConv.all()
  }

  async loadMyConvs(){
    for (const k of Object.keys(await this.getMyConvs()))
    {
      console.log("Starting conv with:", k)
      this.startConvoRoom(k)
    }
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
    if (this.account)
    {
      return this.ecies.decrypt(new Buffer(this.account.privateKey.substring(2), "hex"), new Buffer(buffer, "hex")).toString("utf8")
    }
  }

  canConverse(remote_eth_address) {
    if (remote_eth_address != this.account_key)
    {
      let entry = this.global_keys.get(remote_eth_address)
      if(entry) {
        return true
      }
    }
    return false
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
    }
    return room
  }

  async sendConvMessage(remote_eth_address, message_obj) {
    if (this._sending_message)
    {
      console.log("There's a Message being sent!")
      return false
    }
    let room_id = this.joinConversationKey(this.account_key, remote_eth_address)
    let room
    console.log("sending to:", room_id)
    if (this.convs[room_id] && this.convs[room_id].keys.length)
    {
      room = await this.startConvoRoom(remote_eth_address)
    }
    else
    {
      room = await this.startConv(remote_eth_address)
    }

    if (typeof(message_obj) == "string")
    {
      message_obj = {content:message_obj}
    }
    const message = Object.assign({}, message_obj)
    //set timestamp
    message.created = Date.now()

    if (!validateMessage(message))
    {
      console.log("Errors validating:", message, " errors: ", validator.errors)
      return false
    }
    const key = this.convs[room_id].keys[0]
    const iv = CryptoJS.lib.WordArray.random(16)
    const message_str = JSON.stringify(message)
    const sha_sub = CryptoJS.enc.Base64.stringify(CryptoJS.SHA1(message_str)).substr(0, 6)
    const encmsg = CryptoJS.AES.encrypt(message_str + sha_sub, key, {iv:iv}).toString()
    const iv_str = CryptoJS.enc.Base64.stringify(iv)
    this._sending_message = true
    //include a random iv str so that people can't match strings of the same message
    await room.add([{type:"msg", emsg:encmsg, i:iv_str, address: this.account_key}])
    this._sending_message = false
    return true
  }
}

export default Messaging
