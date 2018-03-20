import originService from './origin-service'

var axios = require('axios')

const messageToSign = 'originprotocol'

class TwitterIdentityService {
  static instance

  constructor() {
    if (TwitterIdentityService.instance) {
      return TwitterIdentityService.instance
    }
    TwitterIdentityService.instance = this
  }

  // TODO: set server url upon origin.js instantiation as a config option, rather than passing into this method
  getValidatedUsername(userAddress, serverUrl) {
    return new Promise((resolve, reject) => {
      let username
      originService.getUser(userAddress)
      .then((user) => {
        let proofs = user.proofs || []
        let twitterProofs = proofs.filter((proof) => {
          return proof.service === 'twitter.com'
        })
        if (twitterProofs.length) {
          let mostRecentTwitterProof = twitterProofs[twitterProofs.length - 1]
          let tweetId = mostRecentTwitterProof.proofLink.split('status/')[1]
          username = mostRecentTwitterProof.username
          return axios.get(`${serverUrl}/api/twitter/statuses/show/${tweetId}`)
        } else {
          resolve(null)
        }
      })
      .then((response) => {
        let tweet = response.data
        let signature = tweet.full_text.split(': ')[1]
        let isValid = originService.verifySignedMessage(messageToSign, userAddress, signature)
        if (isValid) {
          resolve(username)
        } else {
          reject('Proof is invalid')
        }
      })
      .catch(function (error) {
        reject(`Error getting validated twitter username: ${error}`)
      })
    })
  }

  // TODO: set server url upon origin.js instantiation as a config option, rather than passing into this method
  addProof(accessTokenKey, accessTokenSecret, serverUrl) {
    return new Promise((resolve, reject) => {
      originService.generateSignedMessage(messageToSign)
      .then((signedMessage) => {
        let status = `Verifying myself on originprotocol.com: ${signedMessage}`
        return axios.post(`${serverUrl}/api/twitter/statuses/update`, { accessTokenKey, accessTokenSecret, status })
      })
      .then(function (response) {
        let tweet = response.data
        let proofLink = `https://twitter.com/${tweet.user.screen_name}/status/${tweet.id_str}`
        window.web3.eth.getAccounts((error, accounts) => {
          originService.getUser(accounts[0])
          .then((user) => {
            let proofs = user.proofs || []
            proofs.push({
              service: "twitter.com",
              username: tweet.user.screen_name,
              proofString: status,
              proofLink
            })
            user.proofs = proofs
            return originService.setUser(user)
          })
          .then((response) => {
            resolve(response)
          })
          .catch((error) => {
            reject(`Error adding twitter proof: ${error}`)
          })
        })
      })
      .catch((error) => {
        reject(`Error adding twitter proof: ${error}`)
      })
    })
  }
}

const twitterIdentityService = new TwitterIdentityService()

export default twitterIdentityService
