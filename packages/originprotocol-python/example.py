
from originprotocol import Origin

listingAddress = '0x3d62a3ea28fee3d2faeb6ab708d7890772936de7'  # Will certainly not exisit

origin = Origin(rpc_server='http://127.0.0.1:9545')

# Get information about a listing
listing = origin.listings.get(listingAddress)

print("Origin!")
print(listing)


