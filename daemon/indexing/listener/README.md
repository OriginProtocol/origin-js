# Origin Event Listener

The Origin Event Listener follows the blockchain, spotting origin.js events and passing those on to whatever systems need that data. These events are annotated with the full information about the origin resources (listings/offers) that fired off these events.

The data from the listener can be used to build and keep up-to-date an offline index of all Origin Protocol data on the chain.

The listener will let you know one or more times about an event. Make sure your webhook endpoint is idempotent, and can handle receiving the same data multiple times!

To allow the listener to be compatible with [infura.io](https://infura.io/), it does not use subscriptions, only API queries.

# Running

First you'll need a blockchain network to listen to. To get a local network work, you can start up the origin box, or you can run `npm start run` from the origin.js directory.

A simple way to see the listener in action:

    node daemon/indexing/listener/listener.js

## Command line options

Output:

`--verbose` Output json for all event information to stdout

`--webhook=yoururl` Post json for each event to the URL

`--elasticsearch` Experimental support for recording listings directly into elastic search

`--db` Experimental support for recording listings directly into postgres (see instructions for setting up the db [here](../README.md))

Events:

`--continue-file=path` Will start following events at the block number defined in the file, and will keep this file updated as it listens to events. The continue file is JSON, in the format `{"lastLogBlock":222, "version":1}`.


# How the listener works

The listener checks every few seconds for a new block number. If it sees one, it requests all origin related events from the last block it saw an event on, to the new block.

For each of those events, the listener decodes them, annotates them with some useful fields, then runs a rule based on the event/contract to load additional information about the event through origin.js. For example, a `ListingCreated` event on a marketplace contract will have the results of `origin.marketplace.get` added to it. The code that uses the event listener output doesn't need to talk to the blockchain or IPFS at all.

After being annotated with more information, the event is then output to the places set by the command line options.

## Error handling

- If there is an error loading information about an origin.js object, then the listener will skip that event and continue to the next. Because of the design of the Origin Protocol, there is zero guarantees that the associated IPFS data for a resource will be valid, or even there at all. Anyone can put whatever they want there.

- When an error is raised when outputting to specific output handler (webhook, db, etc), the listener will attempt retries with increasing delays, up to two minutes. These retries will block all further event processing until the event goes through. If a maximum number of retries on one event has failed, then listener will quit, allowing it to be restarted from outside.

- When an error is raised when getting event or block number information, the same retry strategy as for output errors is tried (increasing delays).