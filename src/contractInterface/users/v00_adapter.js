import AttestationObject from '../../models/attestation'
import {
  fromRpcSig,
  ecrecover,
  toBuffer,
  bufferToHex,
  pubToAddress
} from 'ethereumjs-util'
import Web3 from 'web3'
import { PROFILE_DATA_TYPE, IpfsDataStore } from '../../ipfsInterface/store'

const selfAttestationTopic = 13 // TODO: use the correct number here
const emptyAddress = '0x0000000000000000000000000000000000000000'

class V00_UsersAdapter {
  constructor({ contractService, ipfsService }) {
    this.contractService = contractService
    this.ipfsDataStore = new IpfsDataStore(ipfsService)
    this.web3EthAccounts = this.contractService.web3.eth.accounts
    this.contractName = 'V00_UserRegistry'
  }

  async set({ profile, attestations = [] }) {
    if (profile) {
      const selfAttestation = await this.profileAttestation(profile)
      attestations.push(selfAttestation)
    }
    const newAttestations = await this.newAttestations(attestations)
    return await this.addAttestations(newAttestations)
  }

  async get(address) {
    const identityAddress = await this.identityAddress(address)
    if (identityAddress) {
      const userData = await this.getClaims(identityAddress)
      return Object.assign({}, userData, { address, identityAddress })
    }
    return false
  }

  async identityAddress(address) {
    const account = await this.contractService.currentAccount()
    const userRegistry = await this.contractService.deployed(
      this.contractService.contracts[this.contractName]
    )
    address = address || account
    const result = await userRegistry.methods.users(address).call()
    if (String(result) === emptyAddress) {
      return false
    } else {
      return result
    }
  }

  async profileAttestation(profile) {
    // Validate the profile data and submits it to IPFS
    const ipfsHash = await this.ipfsDataStore.save(PROFILE_DATA_TYPE, profile)
    const asBytes32 = this.contractService.getBytes32FromIpfsHash(ipfsHash)
    // For now we'll ignore issuer & signature for self attestations
    // If it's a self-attestation, then no validation is necessary
    // A signature would be an extra UI step, so we don't want to add it if not necessary
    return new AttestationObject({
      topic: selfAttestationTopic,
      data: asBytes32,
      issuer: emptyAddress,
      signature:
        '0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000'
    })
  }

  async newAttestations(attestations) {
    const identityAddress = await this.identityAddress()
    let existingAttestations = []
    if (identityAddress) {
      const claims = await this.getClaims(identityAddress)
      existingAttestations = claims.attestations
    }
    return attestations.filter(attestation => {
      const matchingAttestation = existingAttestations.filter(
        existingAttestation => {
          const topicMatches =
            attestation.topic === existingAttestation.topic
          const dataMatches = attestation.data === existingAttestation.data
          const sigMatches =
            attestation.signature === existingAttestation.signature
          return topicMatches && dataMatches && sigMatches
        }
      )
      const isNew = matchingAttestation.length === 0
      return isNew
    })
  }

  async addAttestations(attestations) {
    const account = await this.contractService.currentAccount()
    const userRegistry = await this.contractService.deployed(
      this.contractService.contracts[this.contractName]
    )
    const identityAddress = await this.identityAddress()
    if (attestations.length) {
      // format params for solidity methods to batch add claims
      const topics = attestations.map(({ topic }) => topic)
      const issuers = attestations.map(({ issuer }) => issuer || emptyAddress)
      const sigs =
        '0x' +
        attestations
          .map(({ signature }) => {
            return signature.substr(2)
          })
          .join('')
      const data =
        '0x' +
        attestations
          .map(({ data }) => {
            return data.substr(2)
          })
          .join('')
      const dataOffsets = attestations.map(() => 32) // all data hashes will be 32 bytes

      if (identityAddress) {
        // batch add claims to existing identity
        return await this.contractService.call(
          'ClaimHolderRegistered',
          'addClaims',
          [topics, issuers, sigs, data, dataOffsets],
          { from: account, gas: 400000, contractAddress: identityAddress }
        )
      } else {
        // create identity with presigned claims
        const gas = 1500000 + attestations.length * 230000
        return await this.contractService.deploy(
          this.contractService.contracts.ClaimHolderPresigned,
          [
            userRegistry.options.address,
            topics,
            issuers,
            sigs,
            data,
            dataOffsets
          ],
          { from: account, gas }
        )
      }
    } else if (!identityAddress) {
      // create identity
      return await this.contractService.deploy(
        this.contractService.contracts.ClaimHolderRegistered,
        [userRegistry.options.address],
        { from: account, gas: 1700000 }
      )
    }
  }

  async getClaims(identityAddress) {
    const identity = await this.contractService.deployed(
      this.contractService.contracts.ClaimHolderRegistered,
      identityAddress
    )
    const allEvents = await identity.getPastEvents('allEvents', {
      fromBlock: 0
    })
    const claimAddedEvents = allEvents.filter(
      ({ event }) => event === 'ClaimAdded'
    )
    const mapped = claimAddedEvents.map(({ returnValues }) => {
      return {
        claimId: returnValues.claimId,
        topic: Number(returnValues.topic),
        data: returnValues.data,
        issuer: returnValues.issuer,
        scheme: Number(returnValues.scheme),
        signature: returnValues.signature,
        uri: returnValues.uri
      }
    })
    const profileClaims = mapped.filter(
      ({ topic }) => topic === selfAttestationTopic
    )
    const nonProfileClaims = mapped.filter(
      ({ topic }) => topic !== selfAttestationTopic
    )
    let profile = {}
    if (profileClaims.length) {
      const bytes32 = profileClaims[profileClaims.length - 1].data
      const ipfsHash = this.contractService.getIpfsHashFromBytes32(bytes32)
      profile = await this.ipfsDataStore.load(PROFILE_DATA_TYPE, ipfsHash)
    }
    const validAttestations = await this.validAttestations(
      identityAddress,
      nonProfileClaims
    )
    const attestations = validAttestations.map(
      att => new AttestationObject(att)
    )
    return { profile, attestations }
  }

  async isValidAttestation({ topic, data, signature }, identityAddress) {
    const originIdentity = await this.contractService.deployed(
      this.contractService.contracts.OriginIdentity
    )
    const msg = Web3.utils.soliditySha3(identityAddress, topic, data)
    const prefixedMsg = this.web3EthAccounts.hashMessage(msg)
    const dataBuf = toBuffer(prefixedMsg)
    const sig = fromRpcSig(signature)
    const recovered = ecrecover(dataBuf, sig.v, sig.r, sig.s)
    const recoveredBuf = pubToAddress(recovered)
    const recoveredHex = bufferToHex(recoveredBuf)
    const hashedRecovered = Web3.utils.soliditySha3(recoveredHex)
    return await originIdentity.methods.keyHasPurpose(hashedRecovered, 3).call()
  }

  async validAttestations(identityAddress, attestations) {
    const promiseWithValidation = attestations.map(async attestation => {
      const isValid = await this.isValidAttestation(
        attestation,
        identityAddress
      )
      return { isValid, attestation }
    })
    const withValidation = await Promise.all(promiseWithValidation)
    const filtered = withValidation.filter(({ isValid }) => isValid)
    return filtered.map(({ attestation }) => attestation)
  }
}

module.exports = V00_UsersAdapter
