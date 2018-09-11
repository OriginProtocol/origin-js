const fs = require('fs')
const fsExtra = require('fs-extra')

module.exports = function() {
  if (!fs.existsSync(".env")) {
    console.log(`\nFile .env does not exist. Copying contents from dev.env to .env\n`)
    fsExtra.copySync('dev.env', '.env')
  }
}
