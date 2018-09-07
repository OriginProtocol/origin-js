//
// Review is the main object exposed by Origin Protocol to access buyer's review data.
//
export class Review {
  /**
   * Constructs a review based on blockchain and IPFS data.
   * @param {string} listingId
   * @param {string} offerId
   * @param {object} event - Blockchain event emitted when offer finalized.
   * @param {object} ipfsReview - Review data stored in IPFS.
   */
  constructor(listingId, offerId, event, ipfsReview) {
    this.id = event.transactionHash
    this.listingId = listingId
    this.offerId = offerId
    this.reviewer = event.returnValues.party
    this.timestamp = event.timestamp
    this.rating = ipfsReview.rating
    this.text = ipfsReview.text
  }
}