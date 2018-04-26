/**
 * IPFS interface
 *
 * Compare with: https://github.com/RequestNetwork/requestNetwork/blob/master/packages/requestNetwork.js/src/servicesExternal/ipfs-service.ts
 */

const ipfsAPI = require("ipfs-api")
const MapCache = require("map-cache")
const promisify = require("util.promisify")

class IpfsService {
  constructor({
    ipfsDomain,
    ipfsApiPort,
    ipfsGatewayPort,
    ipfsGatewayProtocol
  } = {}) {
    this.ipfsDomain = ipfsDomain || "gateway.originprotocol.com"
    this.ipfsApiPort = ipfsApiPort || "5002"
    this.ipfsGatewayPort = ipfsGatewayPort || ""
    this.ipfsGatewayProtocol = ipfsGatewayProtocol || "https"

    this.ipfs = ipfsAPI(this.ipfsDomain, this.ipfsApiPort, {
      protocol: this.ipfsGatewayProtocol
    })
    this.ipfs.swarm.peers(function(error, response) {
      if (error) {
        console.error("IPFS - Can't connect to the IPFS API.")
        console.error(error)
      }
    })

    // Caching
    this.mapCache = new MapCache()
  }

  async submitFile(jsonData) {
    const file = {
      path: "file.json",
      content: JSON.stringify(jsonData)
    }
    const addFile = promisify(this.ipfs.files.add.bind(this.ipfs.files))

    let response
    try {
      response = await addFile([file])
    } catch (error) {
      console.error("Can't connect to IPFS.", error)
      throw new Error("Can't connect to IPFS. Failure to submit file to IPFS")
    }

    const ipfsHashStr = response[0].hash
    if (!ipfsHashStr) {
      throw new Error("Failure to submit file to IPFS")
    }

    this.mapCache.set(ipfsHashStr, jsonData)
    return ipfsHashStr
  }

  async getFile(ipfsHashStr) {
    // Check for cache hit
    if (this.mapCache.has(ipfsHashStr)) {
      return this.mapCache.get(ipfsHashStr)
    }

    const response = await fetch(this.gatewayUrlForHash(ipfsHashStr))
    var ipfsData = await response.json()
    this.mapCache.set(ipfsHashStr, ipfsData)

    return ipfsData
  }

  gatewayUrlForHash(ipfsHashStr) {
    const defaultPort = this.ipfsGatewayProtocol === "https" ? "443" : "80"
    let port = String(this.ipfsGatewayPort)
    if (port.length > 0 && port !== defaultPort) {
      port = `:${port}`
    }
    return (
      `${this.ipfsGatewayProtocol}://${this.ipfsDomain}${port}` +
      `/ipfs/${ipfsHashStr}`
    )
  }
}

export default IpfsService
