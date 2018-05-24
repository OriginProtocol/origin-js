pragma solidity 0.4.23;

/// @title Listing
/// @dev Used to keep marketplace of listings for buyers and sellers

import "./Listing.sol";
import '../../node_modules/openzeppelin-solidity/contracts/token/ERC827/ERC827.sol';

contract ListingsRegistry {

  /*
   * Events
   */

  event NewListing(uint _index);

  /*
   * Storage
   */

  // Contract owner
  address public owner;

  // Array of all listings
  Listing[] public listings;

  // Our token
  ERC827 token;

  /*
   * Modifiers
   */
  modifier isValidListingIndex(uint _index) {
    require (_index < listings.length);
    _;
  }


  modifier isOwner() {
    require (msg.sender == owner);
    _;
  }


  /*
   * Public functions
   */

  constructor(address _tokenAddress)
    public
  {
    // Defines origin admin address - may be removed for public deployment
    owner = msg.sender;

    token = ERC827(_tokenAddress);
  }

  /// @dev listingsLength(): Return number of listings
  function listingsLength()
    public
    constant
    returns (uint)
  {
      return listings.length;
  }

  /// @dev getListing(): Return listing info for a given listing
  /// @param _index the index of the listing we want info about
  function getListing(uint _index)
    public
    constant
    returns (Listing, address, bytes32, uint, uint)
  {
    // Test in truffle develop:
    // ListingsRegistry.deployed().then(function(instance){ return instance.getListing.call(0) })

    // TODO (Stan): Determine if less gas to do one array lookup into var, and
    // return var struct parts
    return (
      listings[_index],
      listings[_index].owner(),
      listings[_index].ipfsHash(),
      listings[_index].price(),
      listings[_index].unitsAvailable()
    );
  }

  /// @dev create(): Create a new listing
  /// @param _ipfsHash Hash of data on ipfsHash
  /// @param _price Price of unit in wei
  /// @param _unitsAvailable Number of units availabe for sale at start
  ///
  /// Sample Remix invocation:
  /// ["0x01","0x7d","0xfd","0x85","0xd4","0xf6","0xcb","0x4d","0xcd","0x71","0x5a","0x88","0x10","0x1f","0x7b","0x1f","0x06","0xcd","0x1e","0x00","0x9b","0x23","0x27","0xa0","0x80","0x9d","0x01","0xeb","0x9c","0x91","0xf2","0x31"],"3140000000000000000",42
  function create(
    bytes32 _ipfsHash,
    uint _price,
    uint _unitsAvailable,
    address _priceTokenContract
  )
    public
    returns (uint)
  {
    // TODO: We should avoid using `tx.origin` per
    // https://ethereum.stackexchange.com/a/1892/20332
    // ...But how else to determine who really made the listing?
    // Maybe use the ERC725 identity?

    listings.push(new Listing(tx.origin, _ipfsHash, _price, _unitsAvailable, _priceTokenContract));
    emit NewListing(listings.length-1);
    return listings.length;
  }

  /// @dev createOnBehalf(): Create a new listing with specified creator
  ///                        Used for migrating from old contracts (admin only)
  /// @param _ipfsHash Hash of data on ipfsHash
  /// @param _price Price of unit in wei
  /// @param _unitsAvailable Number of units availabe for sale at start
  /// @param _creatorAddress Address of account to be the creator
  function createOnBehalf(
    bytes32 _ipfsHash,
    uint _price,
    uint _unitsAvailable,
    address _creatorAddress
  )
    public
    returns (uint)
  {
    require (msg.sender == owner, "Only callable by registry owner");
    listings.push(new Listing(_creatorAddress, _ipfsHash, _price, _unitsAvailable, 0x0000000000000000000000000000000000000000));
    emit NewListing(listings.length-1);
    return listings.length;
  }
}
