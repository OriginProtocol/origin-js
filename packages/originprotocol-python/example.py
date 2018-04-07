
from originprotocol import Origin
import time

origin = Origin(rpc_server='http://127.0.0.1:9545')

@origin.on(['ListingPurchased(address)'])
def print_listing(event):
    global origin
    print("A listing was purchased")
    print(event)
    try:
        listing = origin.listings.get(event['address'])
        print(listing)
    except:
        print("Could not load listing")
    

print("Watching for Origin Events!")
origin.start_following()


