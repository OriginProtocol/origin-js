const { ApolloServer, gql } = require('apollo-server')

var search = require('../lib/search.js')
var db = require('../lib/db.js')

/*
 * Implementation of the Origin GraphQL server.
  * Uses the Apollo framework: https://www.apollographql.com/server
 *
 */

// Type definitions define the "shape" of the data and specify
// which ways the data can be fetched from the GraphQL server.
const typeDefs = gql`
  ######################
  #
  # Query output schema.
  #
  ######################

  # When querying a set of items, the output is a page.
  interface OutputPage {
    totalCount: Int! # Total number of items in the set.
    more: Boolean!   # True if there is another page to fetch.
  }

  type Price {
    currency: String!
    amount: String!
  }

  type User {
    walletAddr: ID!   # Ethereum wallet address
    identityAddr: ID  # ERC 725 identity address.
    listings(page: Page, order: ListingOrder, filter: ListingFilter): ListingPage
    offers(page: Page, order: OfferOrder, filter: OfferFilter): OfferPage
    reviews(page: Page, order: ReviewOrder, filter: ReviewFilter): ReviewPage
  }

  enum OfferStatus {
    CREATED
    ACCEPTED
    DISPUTED
    # Note: There is no "Finalized" status stored on the Offer contract on-chain.
    #       This is computed by the indexing server.
    FINALIZED
  }

  type Offer {
    id: ID!
    ipfsHash: ID!
    listingId: ID!
    buyer: User!
    status: OfferStatus!
  }

  type OfferPage implements OutputPage {
    totalCount: Int!
    more: Boolean!
    offers: [Offer]
  }

  type Review {
    ipfsHash: ID!
    reviewer: User!
    text: String!
    rating: Int!
  }

  type ReviewPage implements OutputPage {
    totalCount: Int!
    more: Boolean!
    reviews: [Review]
  }

  # TODO: Add a status indicating if Listing is sold out.
  type Listing {
    id: ID!
    ipfsHash: ID!
    seller: User!
    title: String!
    description: String
    category: String!
    subCategory: String!
    price: Price!
    offers(page: Page, order: OfferOrder, filter: OfferFilter): OfferPage
    reviews(page: Page, order: ReviewOrder, filter: ReviewFilter): ReviewPage
  }

  type ListingPage implements OutputPage {
    totalCount: Int!
    more: Boolean!
    listings: [Listing]
  }

  ######################
  #
  # Query input schema.
  #
  # Note: Some input types have a "in" prefix because GraphQL does not allow to
  # use thw same name for both an input and output type.
  #
  ######################
  enum OrderDirection {
    ASC   # Default if no direction specified.
    DESC
  }

  input Page {
    num: Int!  # Page number.
    size: Int! # Number of items per page.
  }

  input inPrice {
    currency: String!
    amount: String!
  }

  #
  # ORDER
  #
  enum OfferOrderField {
    CREATION_DATE
    STATUS
  }

  enum ReviewOrderField {
    CREATION_DATE
  }

  enum ListingOrderField {
    RELEVANCE  # Default if no order field specified in the query.
    PRICE
    CREATION_DATE
    SELLER_RATING
  }

  input OfferOrder {
    field: OfferOrderField!
    order: OrderDirection
  }

  input ReviewOrder {
    field: ReviewOrderField!
    order: OrderDirection
  }

  input ListingOrder {
    field: ListingOrderField!
    order: OrderDirection
  }

  #
  # FILTERS
  #

  input OfferFilter {
    status: OfferStatus
  }

  input ReviewFilter {
    rating: Int
  }

  # TODO:
  #  - Filtering definition needs more thinking. This is not flexible at all...
  #  - Add location based filtering.
  #  - Add fractional usage (e.g. availability) filtering.
  input ListingFilter {
    priceMin: inPrice
    priceMax: inPrice
    category: String
    subCategory: String
    locale: String
    sellerAddr: String
    buyerAddr: String
  }

  # The "Query" type is the root of all GraphQL queries.
  type Query {
    Listings(searchQuery: String, page: Page, order: ListingOrder, filter: ListingFilter): ListingPage,
    Listing(id: ID!): Listing,
    
    User(walletAddr: ID!): User
  }
`

// Resolvers define the technique for fetching the types in the schema.
const resolvers = {
  Query: {
    async Listings(root, args, context, info) {
      // TODO: handle pagination, filters, order.
      let listings = []
      if (args.searchQuery) {
        listings = await search.Listing.search(args.searchQuery)
      }  else {
        listings = await db.Listing.all()
      }
      return {
        totalCount: listings.length,
        more: false,
        listings: listings,
      }
    },
    Listing(root, args, context, info) {
      return db.Listing.get(args.id)
    },
    User(root, args, context, info) {
      // TODO: implement me !
      return {}
    }
  },
  Listing: {
    seller(listing) {
      return { walletAddr: 'S_WADDR' }
    },
    title(listing) {
      return listing.name
    },
    category(listing) {
      return listing.type
    },
    subCategory(listing) {
      return listing.category
    },
    price(listing) {
      return {currency: 'ETH', amount: listing.price.toString()}
    },
    offers(listing, args) {
      // TODO: handle pagination, filters, order.
      return {
        totalCount: 1,
        more: false,
        offers: [{
          id: '123', ipfsHash: 'IPFS_H', listingId: listing.id,
          buyer: {walletAddr: 'B_WADDR',}, status: 'ACCEPTED',
        }]
      }
    },
    reviews(listing, args) {
      // TODO: handle pagination, filters, order.
      return {
        totalCount: 1,
        more: false,
        reviews: [{
          ipfsHash: 'IPFS_H', reviewer: {walletAddr: 'R_WADDR'},
          text: 'Great product. Great seller.',
        }]
      }
    },
  },
  User: {
    identityAddr(user) {
      // TODO fetch identify based on user.walletAddr
      return `I_${user.walletAddr}`
    },
    listings(user, args) {
      // TODO: load listings for the user, handle pagination, filters, order.
      return {}
    },
    offers(user, args) {
      // TODO: load offers for the user, handle pagination, filters, order.
      return {}
    },
    reviews(user, args) {
      // TODO: load reviews for the user, handle pagination, filters, order.
      return {}
    }
  },
}

// Start ApolloServer by passing type definitions (typeDefs) and the resolvers
// responsible for fetching the data for those types.
const server = new ApolloServer({ typeDefs, resolvers })

// The `listen` method launches a web-server.
server.listen().then(({ url }) => {
  console.log(`Apollo server ready at ${url}`)
})
