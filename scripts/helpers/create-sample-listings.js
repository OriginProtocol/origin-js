const chalk = require('chalk')
const fs = require('fs')
const Web3 = require('web3')

const Config = require('../../token/lib/config.js')
// FIXME FIXME FIXME: this does not work because index.js gets created as part of the run of build.js
const Origin = require('../../dist/index.js')

async function _createListings(marketplace) {
  const fixturesDir = __dirname + '/../../test/fixtures'

  const listingDirectories = fs.readdirSync(fixturesDir)

  for (const listingDirectoryName of listingDirectories) {
    // Iterate over each directory in the fixtures dir.
    const listingDirectory = fixturesDir + '/' + listingDirectoryName
    const stat = fs.statSync(listingDirectory)

    // Only process directories in the fixtures directory.
    if (!stat.isDirectory()) {
      continue
    }

    // Grab the filename for the listing IPFS data.
    const listingFilename = fs.readdirSync(listingDirectory).find(file => {
      return file.endsWith('json')
    })
    if (!listingFilename) {
      // No listing json file, don't proceed.
      throw new Error(`Listing json not found in ${listingDirectory}`)
    }

    // Get all the images from the listing directory
    const imagePaths = fs
      .readdirSync(listingDirectory)
      .filter(file => {
        return file.endsWith('jpg') || file.endsWith('png')
      })
      .map(imageFilename => {
        return listingDirectory + '/' + imageFilename
      })

    // Read the listing data.
    const dataJson = fs.readFileSync(listingDirectory + '/' + listingFilename)
    const data = JSON.parse(dataJson)

    // Add images as data URI in the media section of the listing data.
    data.media = []
    for (const imagePath of imagePaths) {
      const imageBin = fs.readFileSync(imagePath)
      const imageBase64 = new Buffer(imageBin).toString('base64')
      const contentType = imagePath.endsWith('jpg')
        ? 'image/jpeg'
        : 'image/png'
      const medium = {
        url: `data:${contentType};base64,${imageBase64}`,
        contentType: contentType
      }
      data.media.push(medium)
    }

    // Add listing to the marketplace.
    const listing = await marketplace.createListing(data)
    console.log(chalk.green(`Created listing ${listingFilename} id=${listing.listingId}`))
  }
}

async function createSampleListings() {
  // Pick network to operate on based on mnemonic env variables.
  let networkId = '999' // Local blockchain
  if (process.env.MAINNET_MNEMONIC) {
    throw new Error('Script not for use on MainNet')
  } else if (process.env.ROPSTEN_MNEMONIC) {
    networkId = '3'
  } else if (process.env.RINKEBY_MNEMONIC) {
    networkId = '4'
  } else if (process.env.ORIGIN_MNEMONIC) {
    networkId = '222'
  }

  const provider = Config.createProviders([networkId])[networkId]
  const web3 = new Web3(provider)

  const o = new Origin({
    ipfsDomain: '127.0.0.1' || process.env.IPFS_DOMAIN,
    ipfsApiPort: '5002' || process.env.IPFS_API_PORT,
    ipfsGatewayPort: '8080' || process.env.IPFS_GATEWAY_PORT,
    ipfsGatewayProtocol: 'http' || process.env.IPFS_GATEWAY_PROTOCOL,
    web3
  })

  // Set account that will be used as seller for creating listings.
  // TODO: setup a profile for the seller account.
  const accounts = await web3.eth.getAccounts()
  const seller = accounts[1]
  o.contractService.web3.eth.defaultAccount = seller

  console.log(chalk.blue('Creating sample listings...'))
  await _createListings(o.marketplace)
  console.log(chalk.green('Sample listings created.'))
}

if (require.main === module)
  createSampleListings()
    .then(() => {
      process.exit(0)
    })
    .catch((err) => {
      console.log(chalk.red('Error while creating sample listings'))
      console.trace(err)
      process.exit(-1)
    })

module.exports = createSampleListings