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

  getMessageToTweet() {
    return originService.generateSignedMessage(messageToSign)
    .then((signedMessage) => {
      return `Verifying myself on originprotocol.com: ${signedMessage}`
    })
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
  addProof(username, serverUrl) {
    let messageToTweet
    return new Promise((resolve, reject) => {
      this.getMessageToTweet()
      .then((status) => {
        messageToTweet = status
        return axios.get(`${serverUrl}/api/twitter/statuses/user_timeline/${username}`)
      })
      .then(function (response) {
        let tweets = response.data
        let matchingTweets = tweets.filter((t) => {
          // the url is changed by twitter, so we can't do an exact message match
          return t.full_text.split(': ')[1] === messageToTweet.split(': ')[1]
        })
        if (!matchingTweets.length) {
          reject('Tweet not found')
        } else {
          let tweet = matchingTweets[0]
          let proofLink = `https://twitter.com/${tweet.user.screen_name}/status/${tweet.id_str}`
          window.web3.eth.getAccounts((error, accounts) => {
            originService.getUser(accounts[0])
            .then((user) => {
              user.proofs = user.proofs || []
              user.proofs.push({
                service: "twitter.com",
                username: tweet.user.screen_name,
                proofString: status,
                proofLink
              })
              return originService.setUser(user)
            })
            .then((response) => {
              resolve(response)
            })
            .catch((error) => {
              reject(`Error adding twitter proof: ${error}`)
            })
          })
        }
      })
      .catch((error) => {
        reject(`Error adding twitter proof: ${error}`)
      })
    })
  }
}

const twitterIdentityService = new TwitterIdentityService()

export default twitterIdentityService
