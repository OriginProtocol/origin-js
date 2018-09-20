const HttpIPFS = require('ipfs/src/http')

const startIpfs = () =>
  new Promise((resolve, reject) => {
    const httpAPI = new HttpIPFS(undefined, {
      Addresses: {
        API: '/ip4/0.0.0.0/tcp/5002',
        Gateway: '/ip4/0.0.0.0/tcp/8080'
      }
    })
    console.log('Start IPFS')
    httpAPI.start(true, async err => {
      if (err) {
        return reject(err)
      }
      console.log('Started IPFS')
      resolve()
    })
  })

module.exports = startIpfs
