class MarkeplaceAdapter {
  constructor({ contractService, contractName }) {
    this.web3 = contractService.web3
    this.contractService = contractService
    this.contractName = contractName
  }

  async getContract() {
    if (!this.contract) {
      this.contract = await this.contractService.deployed(
        this.contractService[this.contractName]
      )
    }
  }

  async getListingsCount() {
    await this.getContract()
    const total = await this.contract.methods.totalListings().call()
    return Number(total)
  }

  async createListing(ipfsBytes, { deposit = '0', arbitrator }) {
    await this.getContract()
    const from = await this.contractService.currentAccount()
    return this.contract.methods
      .createListing(ipfsBytes, deposit, arbitrator || from)
      .send({ gas: 4612388, from })
  }

  async makeOffer(listingId, ipfsBytes, data) {
    await this.getContract()
    const from = await this.contractService.currentAccount()
    const { finalizes, affiliate, commission, price, arbitrator, currencyAddr } = data

    const args = [
      listingId,
      ipfsBytes,
      finalizes || Math.round(+new Date() / 1000) + (60 * 60 * 24), // 24 hrs
      affiliate || '0x0',
      commission || '0',
      price,
      currencyAddr || '0x0',
      arbitrator || '0x0'
    ]
    const opts = { gas: 4612388, from }
    if (!currencyAddr) {
      opts.value = price
    }
    return this.contract.methods.makeOffer(...args).send(opts)
  }

  async getListing(listingId) {
    await this.getContract()

    // Get the raw listing data from the contract
    const rawListing = await this.contract.methods.listings(listingId).call()

    // Find all events related to this listing
    const listingTopic = this.web3.utils.padLeft(web3.utils.numberToHex(listingId), 64)
    const events = await this.contract.getPastEvents('allEvents', {
      topics: [null, null, listingTopic, null],
      fromBlock: 0
    })

    // Loop through the events looking and update the IPFS hash appropriately
    let ipfsHash
    events.forEach(e => {
      if (e.event === 'ListingCreated') {
        ipfsHash = e.returnValues.ipfsHash
      } else if (e.event === 'ListingUpdated') {
        ipfsHash = e.returnValues.ipfsHash
      }
    })

    // Return the raw listing along with events and IPFS hash
    return Object.assign({}, rawListing, { ipfsHash, events })
  }

  async getListings(opts) {
    await this.getContract()

    if (opts.purchasesFor) {
      const events = await this.contract.getPastEvents('OfferCreated', {
        filter: { party: opts.purchasesFor },
        fromBlock: 0
      })
      const listingIds = []
      events.forEach(e => {
        const listingId = Number(e.returnValues.listingID)
        if (listingIds.indexOf(listingId) < 0) {
          listingIds.push(listingId)
        }
      })
      return listingIds
    } else {
      const total = await this.contract.methods.totalListings().call()
      return [...Array(Number(total)).keys()]
    }
  }

  async getOffers(listingIndex, opts) {
    await this.getContract()
    let filter = {}
    if (listingIndex) {
      filter = Object.assign(filter, { listingID: listingIndex })
    }
    if (opts.for) {
      filter = Object.assign(filter, { party: opts.for })
    }
    const events = await this.contract.getPastEvents('OfferCreated', {
      filter,
      fromBlock: 0
    })
    return events.map(e => Number(e.returnValues.offerID))
  }

  async getOffer(listingIndex, offerIndex) {
    await this.getContract()

    // Get the raw listing data from the contract
    const rawOffer = await this.contract.methods.offers(listingIndex, offerIndex).call()

    // Find all events related to this offer
    const listingTopic = this.web3.utils.padLeft(web3.utils.numberToHex(listingIndex), 64)
    const offerTopic = this.web3.utils.padLeft(web3.utils.numberToHex(offerIndex), 64)
    const events = await this.contract.getPastEvents('allEvents', {
      topics: [null, null, listingTopic, offerTopic],
      fromBlock: 0
    })

    // Loop through the events looking and update the IPFS hash appropriately
    let ipfsHash
    events.forEach(e => {
      if (e.event === 'OfferCreated') {
        ipfsHash = e.returnValues.ipfsHash
      }
    })
    const createdAt = (events && events.length)
      ? await this.contractService.getTimestamp(events[0])
      : undefined

    // Return the raw listing along with events and IPFS hash
    return Object.assign({}, rawOffer, { ipfsHash, events, createdAt })
  }

  async getOfferLogs(listingIndex, offerIndex) {
    await this.getContract()

    // Get the raw listing data from the contract
    const rawOffer = await this.contract.methods.offers(listingIndex, offerIndex).call()

    // Find all events related to this offer
    const listingTopic = this.web3.utils.padLeft(web3.utils.numberToHex(listingIndex), 64)
    const offerTopic = this.web3.utils.padLeft(web3.utils.numberToHex(offerIndex), 64)
    const logs = await this.contract.getPastEvents('allEvents', {
      topics: [null, null, listingTopic, offerTopic],
      fromBlock: 0
    })
    const withTimestampPromise = logs.map(log => {
      return new Promise(async resolve => {
        const createdAt = await this.contractService.getTimestamp(log)
        resolve({ log, createdAt })
      })
    })
    return await Promise.all(withTimestampPromise)
  }
}

export default MarkeplaceAdapter
