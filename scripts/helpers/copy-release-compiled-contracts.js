const chalk = require('chalk')
const fs = require('fs-extra')

/**
 * Copies compiled contracts from the latest release to
 * the contracts build directory.
 */
const copyReleaseCompiledContracts = (dstDir) => {
  // Get list of release directories.
  let dirs = fs.readdirSync('contracts/releases')
  dirs = dirs.filter(dir => (/^\d+\.\d+\.\d+$/.test(dir)))

  // Get latest release directory.
  const latestVersion = dirs.sort().reverse()[0]

  // Create build directory if it does not exist.
  if (!fs.pathExists(dstDir)) {
    fs.mkdirpSync(dstDir)
  }

  // Copy compiled contract files from latest release to the build directory.
  const srcDir = `contracts/releases/${latestVersion}/build/contracts`
  fs.copySync(srcDir, dstDir)
  console.log(chalk.green(`Copied compiled contracts from ${srcDir} to ${dstDir}`))
}

module.exports = copyReleaseCompiledContracts
