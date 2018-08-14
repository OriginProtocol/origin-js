const { ApolloServer, gql } = require('apollo-server')

var search = require('../common/search.js')
var db = require('../common/db.js')


// Type definitions define the "shape" of your data and specify
// which ways the data can be fetched from the GraphQL server.
const typeDefs = gql`
  # Comments in GraphQL are defined with the hash (#) symbol.

  # This "Listing" type can be used in other type declarations.
  type Listing {
    id: String
    name: String
    description: String
    price: Float
  }

  # The "Query" type is the root of all GraphQL queries.
  type Query {
    searchListings(query: String!): [Listing],
    allListings: [Listing],
  }
`

// Resolvers define the technique for fetching the types in the schema.
const resolvers = {
  Query: {
    searchListings(root, args, context, info) {
      return search.searchListings(args.query)
    },
    allListings(root, args, context, info) {
      return db.getListings()
    },
  },
}

// In the most basic sense, the ApolloServer can be started
// by passing type definitions (typeDefs) and the resolvers
// responsible for fetching the data for those types.
const server = new ApolloServer({ typeDefs, resolvers })

// The `listen` method launches a web-server.
server.listen().then(({ url }) => {
  console.log(`Apollo server ready at ${url}`)
})
