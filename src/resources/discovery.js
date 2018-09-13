class Discovery {
  constructor({ discoveryServerUrl, fetch }) {
    this.discoveryServerUrl = discoveryServerUrl
    this.fetch = fetch
  }

  async query(graphQlQuery){
    const url = this.discoveryServerUrl
    const resp = await this.fetch(url, {
      method: 'POST',
      body: JSON.stringify({
        query: graphQlQuery
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    },
    function(error, meta, body){
      if (error !== undefined)
        throw Error(`An error occured when reaching discovery server: ${error}`)  
    })

    if(resp.status !== 200){
      //TODO: also report error message here
      throw Error(`Discovery server retuned unexpected status code ${resp.status} with error `)
    }
    return await resp.json()
  }

  /**
   * Issues a search request to the indexing server which returns Listings result as a promise.
   * This way the caller of the function can implement error checks when results is something
   * unexpected. To get JSON result caller should call `await searchResponse.json()` to get the
   * actual JSON.
   * @param searchQuery {string} general search query
   * @param category {string} one of the supported categories
   * @param filters {object} object with properties: name, value, valueType, operator
   * @returns {Promise<HTTP_Response>}
   */
  async search(searchQuery, category, filters = []) {
    const categoryFilterOption = category === 'all'
      ? ''
      // category is indexed as upper case
      : `category: "${category[0].toUpperCase() + category.substring(1)}"`
    const query = `
    {
      listings (
        searchQuery: "${searchQuery}"
        ${categoryFilterOption}
        filters: [${filters
    .map(filter => {
      return `
    {
      name: "${filter.name}"
      value: "${String(filter.value)}"
      valueType: ${filter.valueType}
      operator: ${filter.operator}
    }
    `
    })
    .join(',')}]
      ) {
        nodes {
          id
        }
      }
    }`

    return this.query(query)
  }
}

module.exports = Discovery
