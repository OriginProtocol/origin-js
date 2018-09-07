import {
  dataAdapterFactory,
  LISTING_DATA_TYPE,
  OFFER_DATA_TYPE,
  REVIEW_DATA_TYPE
} from './_data-store-adapter'

//
// JSON data store backed by IPFS.
//
class IpfsDataStoreBase {
  /**
   *
   * @param {IpfsService} ipfsService - IPFS service to use.
   * @param {string} dataType - The type of object to store. 'listing', 'offer', 'review'.
   */
  constructor(ipfsService, dataType) {
    this.ipfsService = ipfsService
    this.dataType = dataType
  }

  /**
   * Loads and validates data from IPFS.
   * @param {bytes} ipfsHash - Base58 encoded IPFS hash.
   * @returns {object} data
   * @throws {Error}
   */
  async load(ipfsHash) {
    // Fetch the data from storage.
    const ipfsData = await this.ipfsService.loadObjFromFile(ipfsHash)

    // Get a data specific adapter.
    const adapter = dataAdapterFactory(this.dataType, ipfsData.schemaVersion)

    // Decode and validate the data.
    const data = adapter.decode(ipfsData)
    return data
  }

  /**
   * Validates and saves data to IPFS.
   * @param {object} data - Object compliant with Origin Protocol schema.
   * @returns {bytes} Base58 encoded IPFS Hash.
   * @throws {Error}
   */
  async save(data) {
    // Get a data specific adapter.
    const adapter = dataAdapterFactory(this.dataType, data.schemaVersion)

    // Validate and encode the input data.
    const ipfsData = await adapter.encode(data)

    // Write data to storage.
    const ipfsHash = await this.ipfsService.saveObjAsFile(ipfsData)
    return ipfsHash
  }
}

//
// ListingIpfsStore reads and writes listing data from/to IPFS.
//
export class ListingIpfsStore extends IpfsDataStoreBase {
  constructor(ipfsService) {
    super(ipfsService, LISTING_DATA_TYPE)
  }
}

//
// OfferIpfsStore reads and writes offer data from/to IPFS.
//
export class OfferIpfsStore extends IpfsDataStoreBase {
  constructor(ipfsService) {
    super(ipfsService, OFFER_DATA_TYPE)
  }
}

//
// Review IpfsStore reads and writes review data from/to IPFS.
//
export class ReviewIpfsStore extends IpfsDataStoreBase {
  constructor(ipfsService) {
    super(ipfsService, REVIEW_DATA_TYPE)
  }
}
