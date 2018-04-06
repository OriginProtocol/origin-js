# Origin Protocol for Python

## Introduction

This libary lets you get data from the Origin protocol, as well as live follow Origin events on the blockchain.

More information can be found at [Origin Platform Readme](/README.md)

## Usage

Proposed

    from originprotocol import Origin

    origin = Origin(rpc_server='http://127.0.0.1:9545')
    
    # Get information about a listing
    origin.listings.get(listingAddress)

    # Get information about a purchase
    origin.purchase.get(listingAddress)

    # Handle blockchain events:

    @origin.on("listing_changed")
    def listing_changed(event):
        print(str(event))
    
    @origin.on("purchase_changed")
    def purchase_changed(event):
        print(str(event))
