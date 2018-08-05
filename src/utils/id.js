const separator = '-'

function parseListingId(listingId) {
  if (typeof listingId !== 'string') {
    throw new Error(`Listing id ${listingId} must be a string`)
  }
  const exploded = listingId.split(separator)
  if (exploded.length !== 3) {
    throw new Error(`Invalid listing id: ${listingId}`)
  }
  const [ network, version, listingIndex ] = exploded
  return { network, version, listingIndex }
}

function generateListingId({ version, network, listingIndex }) {
  return [ network, version, listingIndex ].join(separator)
}

module.exports = { parseListingId, generateListingId }
