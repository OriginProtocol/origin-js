const fs = require('fs')
const ipfsAPI = require('ipfs-api')
const HttpIPFS = require('ipfs/src/http')
const ReadableStream = require('stream').Readable

const fixturesDir = __dirname + '/../../test/fixtures'

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
      await populateIpfs()

      resolve()
    })
  })

/**
 * Populate IPFS with sample listings from the fixtures directory.
 */
const populateIpfs = async () => {
  const ipfs = ipfsAPI('localhost', '5002', { protocol: 'http' })

  console.log('Populating IPFS...')

  fs.readdir(fixturesDir, (error, listingDirectories) => {
    if (error) {
      throw error
    }

    listingDirectories.forEach((listingDirectoryName, index) => {
      // Iterate over each directory in the fixtures dir
      const listingDirectory = fixturesDir + '/' + listingDirectoryName
      fs.stat(listingDirectory, async (err, stat) => {
        // Make sure the listing is a directory
        if (stat.isDirectory()) {
          // Grab the schema filename
          const schemaFilename = fs.readdirSync(listingDirectory).find((file) => {
            return file.endsWith('json')
          })
          if (!schemaFilename) {
            // No schema, don't proceed
            throw new Error(`Schema not found in ${listingDirectory}`)
          }

          // Get all the images from the listing directory
          const imagePaths = fs.readdirSync(listingDirectory).filter((file) => {
            return file.endsWith('jpg') || file.endsWith('png')
          }).map((imageFilename) => {
            return listingDirectory + '/' + imageFilename
          })

          // Read the schema JSON
          const schema = fs.readFileSync(listingDirectory + '/' + schemaFilename)
          const schemaJson = JSON.parse(schema)
          // Preserve order of uploaded images to maintain IPFS hash
          for (const imagePath of imagePaths) {
            const imageUpload = await ipfs.util.addFromFs(imagePath)
            schemaJson['data']['pictures'].push(`ipfs://${imageUpload[0]['hash']}`)
          }

          // Upload schema JSON to ipfs
          let stream = new ReadableStream
          stream.push(JSON.stringify(schemaJson))
          stream.push(null)
          await ipfs.add(stream)
        }
      })
    })
  })
}

module.exports = startIpfs
