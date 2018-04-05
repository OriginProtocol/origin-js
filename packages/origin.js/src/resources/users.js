import userSchema from '../schemas/user.json'

var Ajv = require('ajv')
var ajv = new Ajv()

async function set(data) {
  let validate = ajv.compile(userSchema)
  if (!validate(data)) {
    throw new Error('invalid user data')
  } else {
    // Submit to IPFS
    let ipfsHash = await this.origin.ipfsService.submitFile(data)

    // Submit to ETH contract
    let txReceipt = await this.origin.contractService.setUser(ipfsHash)
    return txReceipt
  }
}

async function get(address) {
  let userIpfsHash = await this.origin.contractService.getUser(address)
  let userJson = await this.origin.ipfsService.getFile(userIpfsHash)
  return userJson
}

async function getCurrentUser() {
  let address = window.web3.eth.accounts[0]
  let user = await this.get(address)
  return user
}

async function setClaim(field, value) {
  let user = await this.getCurrentUser()
  let claims = user.claims || {}
  claims[field] = value
  user.claims = claims
  let txReceipt = await this.set(user)
  return txReceipt
}

async function removeClaim(field) {
  let user = await this.getCurrentUser()
  let claims = user.claims || {}
  delete claims[field]
  user.claims = claims
  let txReceipt = await this.set(user)
  return txReceipt
}

async function setCustomClaim(field, value) {
  let user = await this.getCurrentUser()
  let claims = user.claims || {}
  let customFields = claims.customFields || []

  // remove any existing custom claims with this field name
  customFields = customFields.filter((obj) => {
    return obj.field != field
  })

  customFields.push({field, value})
  claims.customFields = customFields
  user.claims = claims
  let txReceipt = await this.set(user)
  return txReceipt
}

async function removeCustomClaim(field) {
  let user = await this.getCurrentUser()
  let claims = user.claims || {}
  let customFields = claims.customFields || []
  customFields = customFields.filter((obj) => {
    return obj.field != field
  })
  claims.customFields = customFields
  user.claims = claims
  let txReceipt = await this.set(user)
  return txReceipt
}

async function addAttestation(attestation) {
  let user = await this.getCurrentUser()
  let attestations = user.attestations || []

  // remove any existing attestations for this service
  attestations = attestations.filter((obj) => {
    return obj.service != attestation.service
  })

  attestations.push(attestation)
  user.attestations = attestations
  let txReceipt = await this.set(user)
  return txReceipt
}

async function removeAttestation(service) {
  let user = await this.getCurrentUser()
  let attestations = user.attestations || []
  attestations = attestations.filter((obj) => {
    return obj.service != service
  })
  user.attestations = attestations
  let txReceipt = await this.set(user)
  return txReceipt
}

async function addProof(proof) {
  let user = await this.getCurrentUser()
  let proofs = user.proofs || []

  // remove any existing proofs for this service
  proofs = proofs.filter((obj) => {
    return obj.service != proof.service
  })

  proofs.push(proof)
  user.proofs = proofs
  let txReceipt = await this.set(user)
  return txReceipt
}

async function removeProof(service) {
  let user = await this.getCurrentUser()
  let proofs = user.proofs || []
  proofs = proofs.filter((obj) => {
    return obj.service != service
  })
  user.proofs = proofs
  let txReceipt = await this.set(user)
  return txReceipt
}

module.exports = {
  set,
  get,
  getCurrentUser,
  setClaim,
  removeClaim,
  setCustomClaim,
  removeCustomClaim,
  addAttestation,
  removeAttestation,
  addProof,
  removeProof
}
