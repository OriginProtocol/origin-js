import { expect } from 'chai'
import IpfsService from '../src/services/ipfs-service'
import { listings, ipfsHashes } from './fixtures'

const clearCache = ipfsService => {
  const { mapCache } = ipfsService
  Object.keys(mapCache.__data__).forEach(key => mapCache.del(key))
}

const methodNames = ['submitFile', 'getFile', 'gatewayUrlForHash']

describe('IpfsService', () => {
  let ipfsService

  beforeEach(() => {
    ipfsService = new IpfsService({
      ipfsDomain: '127.0.0.1',
      ipfsApiPort: '5002',
      ipfsGatewayPort: '8080',
      ipfsGatewayProtocol: 'http'
    })
  })

  methodNames.forEach(methodName => {
    it(`should have ${methodName} method`, () => {
      expect(ipfsService[methodName]).to.be.an.instanceof(Function)
    })
  })

  describe('submitFile', () => {
    listings.forEach(({ data, ipfsHash }) => {
      it('should successfully submit file', async () => {
        const submittedHash = await ipfsService.submitFile(data)
        expect(submittedHash).to.equal(ipfsHash)

        const cachedData = await ipfsService.getFile(submittedHash)
        expect(cachedData).to.deep.eql(data)

        clearCache(ipfsService)

        const submittedData = await ipfsService.getFile(ipfsHash)
        expect(submittedData).to.deep.eql(data)
      })
    })
  })

  describe('getFile', () => {
    // Skipped because of https://github.com/OriginProtocol/platform/issues/27
    xit('should reject when listing cannot be found', done => {
      ipfsService
        .getFile('QmWHyrPWQnsz1wxHR219ooJDYTvxJPyZuDUPSDpdsAovN5')
        .then(done.fail, error => {
          expect(error).to.match(/Got ipfs cat error/)
          done()
        })
    })
  })

  describe('gatewayUrlForHash', () => {
    ipfsHashes.forEach(({ ipfsHash, url }) => {
      it(`should correctly create url for IPFS hash ${ipfsHash}`, () => {
        const result = ipfsService.gatewayUrlForHash(ipfsHash)
        expect(result).to.equal(url['local'])
      })
    })
  })
})
