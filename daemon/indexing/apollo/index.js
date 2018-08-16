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
    walletAddr: String!   # Ethereum wallet address
    identityAddr: String  # ERC 725 identity address.
  }

  type Offer {
    id: String!
    ipfsHash: String!
    listingId: String!
    buyer: User!
    status: Int! # Defined in contract: 1: Created, 2: Accepted, 3: Disputed
  }

  type Price {
    currency: String!
    amount: Float!
  }

  type Review {
    ipfsHash: String!
    reviewer: User!
    text: String!
    rating: Int!
  }

  type Listing {
    id: String!
    ipfsHash: String!
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
  input SearchFilter {
    priceMin: inPrice
    priceMax: inPrice
    cat: String
    subCat: String
    locale: String
  }

  enum SearchOrderBy {
    relevance         # Default if no order by specified.
    priceAsc          # Price low to high.
    priceDesc         # Price high to low.
    creationDateDesc  # Most to least recent.
    sellerRating      # Highest to lowest rating.
  }

  input SearchQuery {
    query: String!
    filter: SearchFilter
    orderBy: SearchOrderBy
    page: Page
  }

  input DbQuery {
    page: Page
  }

  # The "Query" type is the root of all GraphQL queries.
  type Query {
    Listings(db: DbQuery, search: SearchQuery): [Listing],
    Listing(id: String!): Listing,
  }
`

// Resolvers define the technique for fetching the types in the schema.
const resolvers = {
  Query: {
    Listings(root, args, context, info) {
      if (args.search) {
        // TODO: handle filters, order by, pagination.
        return search.Listing.search(args.search.query)
      }  else if (args.db) {
        // TODO: handle pagination.
        return db.Listing.all()
      } else {
        throw 'Must specify either a Search or DB query.'
      }
    },
    Listing(root, args, context, info) {
      console.log(`Feching listing with id ${args.id} from DB`)
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
      return { walletAddr: 'S_WADDR', identityAddr: 'S_IADDR' }
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
      return [
        { id: '123', ipfsHash: 'IPFS_H', listingId: listing.id,
          buyer: { walletAddr: 'B_WADDR', identityAddr: 'B_IADDR' },
        },
      ]
    },
    reviews(listing) {
      return [
        {
          ipfsHash: 'IPFS_H', reviewer: { walletAddr: 'R_WADDR', identityAddr: 'R_IADDR' },
          text: 'Great seller. A++', status: 1,
        }
      ]
    },
  },
}

// Start ApolloServer by passing type definitions (typeDefs) and the resolvers
// responsible for fetching the data for those types.
const server = new ApolloServer({ typeDefs, resolvers })

// The `listen` method launches a web-server.
server.listen().then(({ url }) => {
  console.log(`Apollo server ready at ${url}`)
})
