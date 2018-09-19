var elasticsearch = require('elasticsearch')

/*
  Module to interface with ElasticSearch.
 */


var client = new elasticsearch.Client({
  hosts: [
    process.env.ELASTICSEARCH_HOST || 'elasticsearch:9200'
  ]
})

// Elasticsearch index and type names for our data
// Elasticsearch is depreciating storing different types in the same index.
// (and forbids it unless you enable a special flag)
const LISTINGS_INDEX = 'listings'
const LISTINGS_TYPE = 'listing'
const OFFER_INDEX = 'offers'
const OFFER_TYPE = 'offer'
const USER_INDEX = 'users'
const USER_TYPE = 'user'


class Cluster {
  /**
   * Gets cluster health and prints it.
   */
  static async health() {
    const resp = await client.cluster.health({})
    console.log('-- Search cluster health --\n', resp)
  }
}


class Listing {
  /**
   * Counts number of listings indexed.
   * @returns The number of listings indexed.
   */
  static async count() {
    const resp = await client.count({index: LISTINGS_INDEX, type: LISTINGS_TYPE})
    console.log(`Counted ${resp.count} listings in the search index.`)
    return resp.count
  }

  static async get(id) {
    const resp = await client.get({id: id, index: LISTINGS_INDEX, type: LISTINGS_TYPE})
    if(!resp.found){
      throw Error("Listing not found")
    }
    const listing = resp._source
    listing.id = id
    return resp._source
  }

  /**
   * Indexes a listing.
   * @param {string} listingId - The unique ID of the listing.
   * @param {string} buyerAddress - ETH address of the buyer.
   * @param {string} ipfsHash - 32 bytes IPFS hash, in hexa (not base58 encoded).
   * @param {object} listing - JSON listing data.
   * @throws Throws an error if indexing operation failed.
   * @returns The listingId indexed.
   */
  static async index(listingId, buyerAddress, ipfsHash, listing) {
    const resp = await client.index({
      index: LISTINGS_INDEX,
      id: listingId,
      type: LISTINGS_TYPE,
      body: listing
    })
    console.log(`Indexed listing ${listingId} in search index.`)
    return listingId
  }

  /**
   * Searches for listings.
   * @param {string} query - The search query.
   * @param {array} filters - Array of filter objects
   * @param {integer} numberOfItems - number of items to display per page
   * @param {integer} offset - what page to return results from
   * @throws Throws an error if the search operation failed.
   * @returns A list of listings (can be empty).
   */
  static async search(query, filters, numberOfItems, offset) {
    const esQuery = {
      bool: {
        must: [],
        should: [],
        filter: []
      }
    }

    if (query !== undefined && query !== ""){
      // all_text is a field where all searchable fields get copied to
      esQuery.bool.must.push({
        match: {
          all_text: {
            query,
            fuzziness: "AUTO"
          }
        }
      })
      // give extra score if the search query matches in the title
      esQuery.bool.should.push({
        match: {
          title: {
            query: query,
            boost: 2,
            fuzziness: "AUTO"
          }
        }
      })
    } else {
      esQuery.bool.must.push({ match_all: {} })
    }

    /* interestingly JSON.strigify performs pretty well:
     * https://stackoverflow.com/questions/122102/what-is-the-most-efficient-way-to-deep-clone-an-object-in-javascript/5344074#5344074
     */
    const esQueryWithoutFilters = JSON.parse(JSON.stringify(esQuery))

    filters
      .forEach(filter => {
        let innerFilter = {}

        if (filter.operator === 'GREATER_OR_EQUAL'){
          innerFilter = {
            range: {
              [filter.name]: {
                gte: filter.value
              }
            }
          }
        } else if (filter.operator === 'LESSER_OR_EQUAL'){
          innerFilter = {
            range: {
              [filter.name]: {
                lte: filter.value
              }
            }
          }
        } else if (filter.operator === 'CONTAINS' && filter.valueType === 'ARRAY_STRING'){
          innerFilter = {
            bool: {
              should: filter
                .value
                .split(',')
                .map(singleValue => {
                  return { term: {[filter.name]: singleValue} }
                })
            }
          }
        } else if (filter.operator === 'EQUALS'){
          innerFilter = { term: {[filter.name]: filter.value} }
        }


        esQuery.bool.filter.push(innerFilter)
      })

    /* When users boost their listing using OGN tokens we boost that listing in elasticSearch.
     * For more details see document: https://docs.google.com/spreadsheets/d/1bgBlwWvYL7kgAb8aUH4cwDtTHQuFThQ4BCp870O-zEs/edit#gid=0
     */
    const boostScoreQuery = {
      function_score: {
        query: esQuery,
        field_value_factor: {
          field: 'commission.amount',
          factor: 0.005 // the same as delimited by 200
        },
        boost_mode: 'sum'
      }
    }

    const searchRequest = client.search({
      index: LISTINGS_INDEX,
      type: LISTINGS_TYPE,
      body: {
        from: offset,
        size: numberOfItems,
        query: boostScoreQuery,
        _source: ['title', 'description', 'price']
      }
    })

    const aggregationRequest = client.search({
      index: LISTINGS_INDEX,
      type: LISTINGS_TYPE,
      body: {
        query: esQueryWithoutFilters,
        _source: ['_id'],
        aggs : {
          'max_price' : { 'max' : { 'field' : 'price.amount' } },
          'min_price' : { 'min' : { 'field' : 'price.amount' } }
        }
      }
    })

    const [searchResponse, aggregationResponse] = await Promise.all([searchRequest, aggregationRequest])  
    const listings = []
    searchResponse.hits.hits.forEach((hit) => {
      const listing = {
        id: hit._id,
        title: hit._source.title,
        category: hit._source.category,
        subCategory: hit._source.subCategory,
        description: hit._source.description,
        priceAmount: (hit._source.price||{}).amount,
        priceCurrency: (hit._source.price||{}).currency,
      }
      listings.push(listing)
    })

    const maxPrice = aggregationResponse.aggregations.max_price.value
    const minPrice = aggregationResponse.aggregations.min_price.value
    const totalNumberOfListings = searchResponse.hits.total

    return {
      listings,
      totalNumberOfListings,
      maxPrice: maxPrice ? maxPrice : 0,
      minPrice: minPrice ? minPrice : 0
    }
  }
}

class Offer {
  /**
   * Indexes an Offer
   * @param {object} offer - JSON offer data from origin.js
   * @throws Throws an error if indexing operation failed. 
   */
  static async index(offer, listing){
    const resp = await client.index({
      index: OFFER_INDEX,
      type: OFFER_TYPE,
      id: offer.id,
      body: {
        id: offer.id,
        listingId: offer.listingId,
        buyer: offer.buyer,
        seller: listing.seller,
        affiliate: offer.affiliate,
        priceEth: offer.priceEth,
        status: offer.status
      }
    })
  }

  static async get(id) {
    const resp = await client.get({id: id, index: OFFER_INDEX, type: OFFER_TYPE})
    if(!resp.found){
      throw Error("Offer not found")
    }
    return resp._source
  }

  static async search(opts) {
    let mustQueries = []
    if (opts.buyerAddress !== undefined) {
      mustQueries.push({term: {'buyer.keyword': opts.buyerAddress}})
    }
    if (opts.listingId !== undefined) {
      mustQueries.push({term: {'listingId.keyword': opts.listingId}})
    }
    let query
    if (mustQueries.length > 0){
      query = {bool: {must: mustQueries}}
    } else{
      query = {match_all: {}}
    }

    const resp = await client.search({
      index: OFFER_INDEX,
      type: OFFER_TYPE,
      body: {
        query,
      }
    })
    return resp.hits.hits.map(x=>x._source)
  }
}


class User {
  /**
   * Indexes a user
   * @param {object} user - JSON user data from origin.js 
   */
  static async index(user){
    const profile = user.profile || {}
    const resp = await client.index({
      index: USER_INDEX,
      type: USER_TYPE,
      id: user.address,
      body: {
        walletAddress: user.address,
        identityAddress: user.identityAddress,
        firstName: profile.firstName,
        lastName: profile.lastName,
        description: profile.description,
      }
    })
  }

  static async get(walletAddress) {
    const resp = await client.get({id: walletAddress, index: USER_INDEX, type: USER_TYPE})
    if(!resp.found){
      throw Error("User not found")
    }
    return resp._source
  }
}


module.exports = {
  Cluster,
  Listing,
  Offer,
  User
}
