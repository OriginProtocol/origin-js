const listingsContract = 'v01_ListingsContract'

const purchaseStageNames = [
  'BUYER_REQUESTED',
  'BUYER_CANCELED',
  'SELLER_ACCEPTED',
  'SELLER_REJECTED',
  'BUYER_FINALIZED',
  'SELLER_FINALIZED'
]

async function createBlockchainListing(contractService, ipfsListing) {
  const account = await contractService.currentAccount()
  return await contractService.call(
    listingsContract,
    'createListing',
    [contractService.getBytes32FromIpfsHash(ipfsListing)],
    { from: account }
  )
}

async function getIpfsData(contractService, ipfsService, asBytes32) {
  const ipfsHash = contractService.getIpfsHashFromBytes32(asBytes32)
  return await ipfsService.getFile(ipfsHash)
}

async function getPurchaseLogs(contractService, listingIndex, purchaseIndex) {
  const v01_ListingsContract = await contractService.deployed(
    contractService.v01_ListingsContract
  )
  return await new Promise(resolve => {
    v01_ListingsContract.getPastEvents(
      'PurchaseChange',
      {
        fromBlock: 0,
        toBlock: 'latest',
        filter: { _listingIndex: listingIndex, _purchaseIndex: purchaseIndex }
      },
      (error, logs) => {
        resolve(logs)
      }
    )
  })
}

async function getPurchaseIpfsData(
  contractService,
  ipfsService,
  listingIndex,
  purchaseIndex
) {
  const events = await getPurchaseLogs(
    contractService,
    listingIndex,
    purchaseIndex
  )
  if (!events || !events.length) {
    throw new Error('No matching events found!')
  }
  const latestEvent = events[events.length - 1]
  return await getIpfsData(
    contractService,
    ipfsService,
    latestEvent.returnValues._ipfsHash
  )
}

async function getPurchase(
  contractService,
  ipfsService,
  listingIndex,
  purchaseIndex
) {
  const result = await contractService.call(listingsContract, 'getPurchase', [
    listingIndex,
    purchaseIndex
  ])
  const ipfsData = await getPurchaseIpfsData(
    contractService,
    ipfsService,
    listingIndex,
    purchaseIndex
  )
  return {
    ipfsData,
    stage: purchaseStageNames[result._stage],
    buyerAddress: result._buyer,
    escrowContract: result._escrowContract,
    priceEth: weiToEth(contractService, ipfsData.priceWei)
  }
}

function weiToEth(contractService, priceWei) {
  if (typeof priceWei !== 'undefined') {
    return contractService.web3.utils.fromWei(String(priceWei), 'ether')
  }
}

module.exports = {
  createBlockchainListing,
  getIpfsData,
  getPurchaseIpfsData,
  getPurchase,
  getPurchaseLogs,
  purchaseStageNames,
  weiToEth
}
