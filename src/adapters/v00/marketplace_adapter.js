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
    const {
      finalizes,
      affiliate,
      commission,
      price,
      arbitrator,
      currencyAddr
    } = data

    const args = [
      listingId,
      ipfsBytes,
      finalizes || Math.round(+new Date() / 1000) + 60 * 60 * 24, // 24 hrs
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

  async acceptOffer(listingIndex, offerIndex, ipfsBytes, confirmationCallback) {
    await this.getContract()
    const from = await this.contractService.currentAccount()

    const args = [listingIndex, offerIndex, ipfsBytes]
    const opts = { gas: 4612388, from }
    return await new Promise((resolve, reject) => {
      this.contract.methods
        .acceptOffer(...args)
        .send(opts)
        .on('receipt', resolve)
        .on('confirmation', confirmationCallback)
        .on('error', reject)
    })
  }

  async finalizeOffer(
    listingIndex,
    offerIndex,
    ipfsBytes,
    confirmationCallback
  ) {
    await this.getContract()
    const from = await this.contractService.currentAccount()

    const args = [listingIndex, offerIndex, ipfsBytes]
    const opts = { gas: 4612388, from }
    return await new Promise((resolve, reject) => {
      this.contract.methods
        .finalize(...args)
        .send(opts)
        .on('receipt', resolve)
        .on('confirmation', confirmationCallback)
        .on('error', reject)
    })
  }

  async getListing(listingId) {
    await this.getContract()

    // Get the raw listing data from the contract
    const rawListing = await this.contract.methods.listings(listingId).call()

    // Find all events related to this listing
    const listingTopic = this.padTopic(listingId)
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
    const rawOffer = await this.contract.methods
      .offers(listingIndex, offerIndex)
      .call()

    // Find all events related to this offer
    const listingTopic = this.padTopic(listingIndex)
    const offerTopic = this.padTopic(offerIndex)
    const events = await this.contract.getPastEvents('allEvents', {
      topics: [null, null, listingTopic, offerTopic],
      fromBlock: 0
    })

    // Loop through the events looking and update the IPFS hash appropriately
    let ipfsHash, createdAt
    for (const e of events) {
      const timestamp = await this.contractService.getTimestamp(e)
      if (e.event === 'OfferCreated') {
        ipfsHash = e.returnValues.ipfsHash
        createdAt = timestamp
      }
      // Override status if offer was deleted from blockchain state
      if (e.event === 'OfferFinalized') {
        rawOffer.status = '3'
      }
      // TODO: Assumes OfferData event is a seller review
      if (e.event === 'OfferData') {
        rawOffer.status = '4'
      }
      e.timestamp = timestamp
    }

    // Return the raw listing along with events and IPFS hash
    return Object.assign({}, rawOffer, { ipfsHash, events, createdAt })
  }

  async addData(ipfsBytes, listingIndex, offerIndex, confirmationCallback) {
    await this.getContract()
    const from = await this.contractService.currentAccount()
    return await new Promise((resolve, reject) => {
      return this.contract.methods
        .addData(listingIndex, offerIndex, ipfsBytes)
        .send({ gas: 4612388, from })
        .on('receipt', resolve)
        .on('confirmation', confirmationCallback)
        .on('error', reject)
    })
  }

  padTopic(id) {
    return this.web3.utils.padLeft(web3.utils.numberToHex(id), 64)
  }
}

export default MarkeplaceAdapter
