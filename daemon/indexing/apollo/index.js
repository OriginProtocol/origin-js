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

  type User {
    walletAddr: ID!   # Ethereum wallet address
    identityAddr: ID  # ERC 725 identity address.
  }

  type Offer {
    id: ID!
    ipfsHash: ID!
    listingId: ID!
    buyer: User!
    # Per contract definition: 1: Created, 2: Accepted, 3: Disputed
    # NOTE: There is no "Finalized" status stored on-chain but could be useful
    #       to compute it when resolving this object.
    status: Int!
  }

  type Price {
    currency: String!
    amount: Float!
  }

  type Review {
    ipfsHash: ID!
    reviewer: User!
    text: String!
    rating: Int!
  }

  # TODO: Add a status indicating if Listing is sold out.
  type Listing {
    id: ID!
    ipfsHash: ID!
    seller: User!
    title: String!
    description: String
    price: Price!
    offers: [Offer]
    reviews: [Review]
  }

  ######################
  #
  # Query input schema.
  #
  ######################

  input Page {
    num: Int!  # Page number.
    size: Int! # Number of items per page.
  }

  # Note: Defined as inPrice vs Price because GraphQL does not allow to
  # use same name for input and output types.
  input inPrice {
    currency: String!
    amount: Float!
  }

  # TODO:
  #  - Filtering definition needs more thinking. This is not flexible at all...
  #  - Add location based filtering.
  #  - Add fractional usage (e.g. availability) filtering.
  input ListingFilter {
    priceMin: inPrice
    priceMax: inPrice
    cat: String
    subCat: String
    locale: String
    sellerAddr: String
    buyerAddr: String
  }

  enum ListingOrderBy {
    relevance         # Default if no order by specified.
    priceAsc          # Price low to high.
    priceDesc         # Price high to low.
    creationDateDesc  # Most to least recent.
    sellerRating      # Highest to lowest rating.
  }

  input ListingQuery {
    search: String    # Search query. If not specified, all listings are candidates.
    filter: ListingFilter
    orderBy: ListingOrderBy
    page: Page
  }

  # The "Query" type is the root of all GraphQL queries.
  type Query {
    Listings(query: ListingQuery!): [Listing],
    Listing(id: ID!): Listing,
  }
`

// Resolvers define the technique for fetching the types in the schema.
const resolvers = {
  Query: {
    Listings(root, args, context, info) {
      // TODO: handle filters, order by, pagination.
      if (args.query.search) {
        return search.Listing.search(args.query.search)
      }  else {
        return db.Listing.all()
      }
    },
    Listing(root, args, context, info) {
      return db.Listing.get(args.id)
    },
  },
  Listing: {
    id(listing) {
      return listing.id
    },
    ipfsHash(listing) {
      return listing.ipfsHash
    },
    seller(listing) {
      return { walletAddr: 'S_WADDR' }
    },
    title(listing) {
      return listing.name
    },
    description(listing) {
      return listing.description
    },
    price(listing) {
      return {currency: 'ETH', amount: listing.price}
    },
    offers(listing) {
      // TODO: fetch all offers for the given listing.id
      return [
        { id: '123', ipfsHash: 'IPFS_H', listingId: listing.id,
          buyer: { walletAddr: 'B_WADDR', },
        },
      ]
    },
    reviews(listing) {
      // TODO: fetch all reviews for the given listing.id
      return [
        { ipfsHash: 'IPFS_H', reviewer: { walletAddr: 'R_WADDR' },
          text: 'Great product. Great seller.', status: 1,
        },
      ]
    },
  },
  User: {
    identityAddr(user) {
      // TODO fetch identify based on user.walletAddr
      return `I_${user.walletAddr}`
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
