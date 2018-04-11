import json
import time
from web3 import Web3
from web3.contract import Contract


class Origin:
    def __init__(self, rpc_server, ipfs_server="https://gateway.originprotocol.com/"):
        self.ipfs_server = ipfs_server
        self.web3 = Web3(Web3.HTTPProvider(rpc_server))

        self.listings = Listings(self)

        self.event_followers = []

    def on(self, event_names):
        """
        Takes a list of event names with paramaters. For example ['ListingPurchased(address)'].
        """
        def decorator(f):
            self.event_followers.append(EventFollower(self.web3, event_names, f))
            return f
        return decorator

    def start_following(self, poll_time=2.0):
        while True:
            for event_follower in self.event_followers:
                event_follower.handle_new_entries()
            time.sleep(poll_time)


class EventFollower:
    def __init__(self, w3, event_names, f):
        self.web3 = w3
        self.event_names = event_names
        self.f = f

        event_name_hashes = []
        for name in event_names:
            event_name_hashes.append(self.web3.sha3(text=name).hex())

        self.event_filter = self.web3.eth.filter({
            "topics": [event_name_hashes],
        })

    def handle_new_entries(self):
        for event in self.event_filter.get_new_entries():
            self.f(event)


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
