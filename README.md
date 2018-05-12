![origin_github_banner](https://user-images.githubusercontent.com/673455/37314301-f8db9a90-2618-11e8-8fee-b44f38febf38.png)

![origin_npm_version](https://img.shields.io/npm/v/origin.svg?style=flat-square&colorA=111d28&colorB=1a82ff)
![origin_license](https://img.shields.io/badge/license-MIT-6e3bea.svg?style=flat-square&colorA=111d28)
![origin_travis_banner](https://img.shields.io/travis/OriginProtocol/origin-js/master.svg?style=flat-square&colorA=111d28)
![discord](https://img.shields.io/discord/404673842007506945.svg?style=flat-square)


# Origin Protocol Overview

Origin is a protocol for creating sharing economy marketplaces using the Ethereum blockchain and IPFS.

We empower developers and businesses to build decentralized marketplaces on the blockchain. Our protocol makes it easy to create and manage listings for the fractional usage of assets and services. Buyers and sellers can discover each other, browse listings, make bookings, leave ratings and reviews, and much more.

Origin Protocol is a set of Ethereum smart contracts and a JavaScript library that allow anyone to create decentralized marketplaces.

Please refer to our [product brief](https://www.originprotocol.com/product-brief) and [technical whitepaper](https://www.originprotocol.com/whitepaper) for more detail.

This library is an abstraction layer for developers who want to build DApps on Origin Protocol, and is also used to build the [Origin Demo DApp](https://github.com/OriginProtocol/demo-dapp).

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
## Contents

- [Get Involved & Follow Our Progress](#get-involved--follow-our-progress)
  - [Contributing](#contributing)
- [Origin.js](#originjs)
- [Using Origin.js in Your Project](#using-originjs-in-your-project)
  - [Importing and Configuration Options](#importing-and-configuration-options)
  - [Origin.js API](#originjs-api)
- [Building for Local Development](#building-for-local-development)
  - [Environment Dependencies](#environment-dependencies)
  - [Clone and Run the Project](#clone-and-run-the-project)
  - [Local IPFS Deamon](#local-ipfs-deamon)
- [Troubleshooting](#troubleshooting)
  - [Python 3](#python-3)
- [Tests](#tests)
  - [Command Line (All Tests)](#command-line-all-tests)
  - [Command Line (Only Solidity Tests)](#command-line-only-solidity-tests)
  - [Browser Tests](#browser-tests)
- [License](#license)
- [Origin Protocol](#origin-protocol)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->
## Get Involved & Follow Our Progress

**This repo is under active development. We welcome your participation!**

1. [Join our #engineering channel on Discord](http://www.originprotocol.com/discord).

2. Listen in on our weekly engineering call on Google Hangouts. It happens every week and everyone is welcome to listen in and participate. [Join us on Google Hangouts](https://meet.google.com/pws-cgyd-tqp) on Wednesdays at 9pm GMT ([Add to Calendar](https://calendar.google.com/event?action=TEMPLATE&tmeid=MHAyNHI3N2hzMjk5b3V2bjhoM2Q1ZWVzY2pfMjAxODA0MTFUMjAwMDAwWiBqb3NoQG9yaWdpbnByb3RvY29sLmNvbQ&tmsrc=josh%40originprotocol.com&scp=ALL)):

| Pacific | Mountain | Central | Eastern | GMT |
|---------|----------|---------|---------|-----|
| Wed 1pm | Wed 2pm | Wed 3pm | Wed 4pm | Wed 9pm |

3. Catch up on our meeting notes & weekly sprint planning docs (feel free to add comments):
  - [Engineering meeting notes](https://docs.google.com/document/d/1aRcAk_rEjRgd1BppzxZJK9RXfDkbuwKKH8nPQk7FfaU/)
  - [Weekly sprint doc](https://docs.google.com/document/d/1qJ3sem38ED8oRI72JkeilcvIs82oDq5IT3fHKBrhZIM)

### Contributing

Read the [contributing guidelines](CONTRIBUTING.md) for details.

## Origin.js

Origin.js is a JavaScript library for interacting with the Origin protocol.

Using the library you can create new listings from your applications, purchase them, or update them from your own off-chain applications.

**Warning:**  
This is still an alpha version which will evolve significantly before the main net release.

## Using Origin.js in Your Project

The library is available as an NPM package you can add to your project using NPM or Yarn.

```
npm i -S origin
```
or
```
yarn add origin
```

A browser-compatible standalone JavaScript file `origin.js` is available in the "Releases" tab, and will soon be hosted on originprotocol.com.

### Importing and Configuration Options

```
import Origin from 'origin'

const configOptions = {
  option: 'value'
}

const { contractService, ipfsService, originService } = new Origin(configOptions)
```

Valid configOptions are:

- `ipfsDomain`
- `ipfsApiPort`
- `ipfsGatewayPort`
- `ipfsGatewayProtocol`
- `attestationServerUrl`

### Origin.js API

The API documentation will explain how developers can use the origin.js library to create and manage decentralized marketplaces that are built on top of IPFS and the Ethereum network.

Origin.js aims to create an easy and flexible abstraction layer that:

- Generates and deploys secure Ethereum smart contracts to the blockchain.
- Creates and posts user and listing metadata to distributed IPFS nodes
- Queries against open-source indexing servers to render content in decentralized applications (DApps)

Origin.js enables developers to create DApps that onboard new users to the Origin platform, add new listings to the listings registry, create booking contracts, close out bookings (transfer funds, write reviews, etc.), and more.

Visit [docs.originprotocol.com](http://docs.originprotocol.com/)

## Building for Local Development

### Environment Dependencies

You need some global environment configurations

- Install [Node.js](https://github.com/nodejs/node) v9.11.
It is recommended to use a node version manager such as [avn](https://github.com/creationix/nvm) or [tj/n](https://github.com/tj/n).

### Clone and Run the Project

1. `git clone` your fork. Note that the latest commits will be on the `develop`
 branch. So switch to that branch if you want to submit a PR or check out
 recently merged code.

2. Install:dev (shortcut for `npm install && npm link`). Linking makes this available as a local npm package for local dapp development.
  ```
  npm run install:dev
  ```

3. Start the local blockchain and create the build. Code changes will trigger a live rebuild.
```
npm start
```

In order to conduct test transactions, you can create a new wallet using the following seed phrase (Mnemonic):

_**Be careful to back up the seed phrases and private keys for any existing wallets before creating a new one.**_
```
candy maple cake sugar pudding cream honey rich smooth crumble sweet treat
```

4. To develop against a working dapp and UI, see [the instructions in our demo dapp](https://github.com/OriginProtocol/demo-dapp#developing-with-a-local-chain).


### Local IPFS Deamon

If you are running a local IPFS daemon then set the following config options ([see config options](#configuration-options)):

```
{
  ipfsDomain: '127.0.0.1',
  ipfsApiPort: '5001',
  ipfsGatewayPort: '8080',
  ipfsGatewayProtocol: 'http'
}
```

Configure your local IPFS daemon with the following settings to avoid CORS errors:

```
ipfs config --json API.HTTPHeaders.Access-Control-Allow-Origin '["localhost:*"]'
ipfs config --json API.HTTPHeaders.Access-Control-Allow-Methods '["GET", "POST", "PUT"]'
ipfs config --json API.HTTPHeaders.Access-Control-Allow-Credentials '["true"]'
```

## Troubleshooting

### Python 3

If you have Python 3 installed, you may see this error when installing dependencies:

```
gyp ERR! stack Error: Python executable "/Users/aiham/.pyenv/shims/python" is v3.6.4, which is not supported by gyp.
```

Resolve this by configuring npm to use Python 2 (where python2.7 is a binary accessible from your $PATH):

```
npm config set python python2.7
```

## Tests

### Command Line (All Tests)

Our full test suite can be run with:

```
npm run test
```

Note: you should *not* have the server running at this time, as these tests start their own local blockchain instance.

### Command Line (Only Solidity Tests)

Our Solidity tests (which use [Truffle](http://truffleframework.com/docs/getting_started/javascript-tests)) are located at `contracts/test`.

```
npm run test:contracts
```

Note: you should *not* have the server running at this time, as these tests start their own local blockchain instance.

### Browser Tests

A subset of our tests can be run from the browser. These tests are automatically served at `http://localhost:8081` when you run `npm start`. These tests are automatically rerun when source or test code is changed.

Run a subset of these tests using the `grep` query string parameter, for example: http://localhost:8081/?grep=IpfsService


## License
Code released under the [MIT License](https://github.com/OriginProtocol/origin-js/blob/master/LICENSE).

---

## Origin Protocol

Origin is building the sharing economy of tomorrow. Buyers and sellers will be able to transact without rent-seeking middlemen. We believe in lowering transaction fees, promoting free and transparent commerce, and giving early participants in the community a stake in the network.

[originprotocol.com](https://originprotocol.com)  

<!-- Please don't remove this: Grab your social icons from https://github.com/carlsednaoui/gitsocial -->

<!-- display the social media buttons in your README -->

[![Knowledge Twitter][1.1]][1]
[![Knowledge Facebook][2.1]][2]
[![Knowledge Github][3.1]][3]

<!-- links to social media icons -->
<!-- no need to change these -->

<!-- icons with padding -->

[1.1]: http://i.imgur.com/tXSoThF.png (twitter icon with padding)
[2.1]: http://i.imgur.com/P3YfQoD.png (facebook icon with padding)
[3.1]: http://i.imgur.com/0o48UoR.png (github icon with padding)

<!-- icons without padding -->

[1.2]: http://i.imgur.com/wWzX9uB.png (twitter icon without padding)
[2.2]: http://i.imgur.com/fep1WsG.png (facebook icon without padding)
[3.2]: http://i.imgur.com/9I6NRUm.png (github icon without padding)


<!-- links to your social media accounts -->
<!-- update these accordingly -->

[1]: http://www.twitter.com/OriginProtocol
[2]: http://www.facebook.com/OriginProtocol
[3]: http://www.github.com/OriginProtocol

<!-- Please don't remove this: Grab your social icons from https://github.com/carlsednaoui/gitsocial -->
