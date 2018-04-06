import json
from web3 import Web3
from web3.contract import Contract


class Origin:
    def __init__(self, rpc_server, ipfs_server="https://gateway.originprotocol.com/"):
        self.ipfs_server = ipfs_server

        self.web3 = Web3(Web3.HTTPProvider(rpc_server))

        self.listings = Listings(self)


class Listings:
    def __init__(self, origin):
        self.origin = origin
        # This loading will move out to a base class later
        # TODO: when packaging this up for pip, we'll need to include our contract definitions
        with open("../contracts/build/contracts/Listing.json") as f:
            self.contract_interface = json.loads(f.read())


    def get(self, address):
        listing = self.origin.web3.eth.contract(
            abi=self.contract_interface['abi'],
            address=Web3.toChecksumAddress(address),
            ContractFactoryClass=Contract)
        # TODO: Get all listing data
        # TODO: Load from IPFS
        return {"priceGwie": listing.functions.price().call()}
