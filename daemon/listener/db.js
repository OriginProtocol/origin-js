const { Pool } = require('pg')

/*
  Module to interface with Postgres database.
 */

const dbName = 'origin'
const listingTable = 'listing'

// TODO(franck): dynamically configure client.
const pool = new Pool(
  {
    host: 'localhost',
    database: dbName,
    // user: 'franck',
    // password: 'franck',
  })


async function getListing(listingId) {
  return pool.query(`SELECT * FROM ${listingTable} WHERE id=$1`, [listingId]).then((res) => {
    return res.rows
  })
}

/*
 * Returns all rows from the listing table.
 * @throws Throws an error if the read operation failed.
 * @returns A promise that resolves to a list of rows (can be empty).
 *
 * TODO(franck): add support for pagination.
 */
async function getListings() {
  return pool.query(`SELECT * FROM ${listingTable}`, []).then((res) => {
    return res.rows
  })
}

/*
 * Adds a row to the listing table.
 * @params {string} listingId - The unique ID of the listing.
 * @params {object} listing - Listing to add.
 * @throws Throws an error if the operation failed.
 * @returns A promise that resolves to the listingId indexed.
 */
async function insertListing(listingId, listing) {
  return pool.query(
    `INSERT INTO ${listingTable}(id, data) VALUES($1, $2)`, [listingId, listing]).then((res) => {
    console.log(`Added row ${listingId} to listing table.`)
    return listingId
  })
}

module.exports = {
  getListing,
  getListings,
  insertListing,
}

