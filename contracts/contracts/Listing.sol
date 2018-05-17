pragma solidity 0.4.23;

/// @title Listing
/// @dev An indiviual Origin Listing representing an offer for booking/purchase

import "./Purchase.sol";
import "./PurchaseLibrary.sol";
import '../../node_modules/openzeppelin-solidity/contracts/token/ERC827/ERC827Token.sol';


contract Listing {

  /*
   * Events
   */

  event ListingPurchased(Purchase _purchaseContract);
  event ListingChange();

    /*
    * Storage
    */

    address public owner;
    address public listingRegistry; // TODO: Define interface for real ListingRegistry ?
    // Assume IPFS defaults for hash: function:0x12=sha2, size:0x20=256 bits
    // See: https://ethereum.stackexchange.com/a/17112/20332
    // This assumption may have to change in future, but saves space now
    bytes32 public ipfsHash;
    uint public price;
    uint public unitsAvailable;
    uint public created;
    uint public expiration;
    Purchase[] public purchases;
    ERC827 public priceTokenContract; // Token to pay. If 0x00, means payment is ETH

    constructor (
      address _owner,
      bytes32 _ipfsHash,
      uint _price,
      uint _unitsAvailable,
      address _priceTokenContract
    )
    public
    {
      owner = _owner;
      listingRegistry = msg.sender; // ListingRegistry(msg.sender);
      ipfsHash = _ipfsHash;
      price = _price;
      unitsAvailable = _unitsAvailable;
      created = now;
      expiration = created + 60 days;
      priceTokenContract = ERC827(_priceTokenContract);
    }

  /*
    * Modifiers
    */

  modifier isSeller() {
    require(msg.sender == owner);
    _;
  }

  /*
    * Public functions
    */

  function data()
    public
    view
    returns (address _owner, bytes32 _ipfsHash, uint _price, uint _unitsAvailable, uint _created, uint _expiration, address _priceTokenContract)
  {
    return (owner, ipfsHash, price, unitsAvailable, created, expiration, address(priceTokenContract));
  }

  /// @dev buyListing(): Buy a listing
  /// @param _unitsToBuy Number of units to buy
  function buyListing(uint _unitsToBuy)
    public
    payable
  {
    // Ensure that this is not trying to purchase more than is available.
    require(_unitsToBuy <= unitsAvailable);

    // Ensure that we are not past the expiration
    require(now < expiration);

    // Create purchase contract
    Purchase purchaseContract = PurchaseLibrary.newPurchase(this, msg.sender);

    // Count units as sold
    unitsAvailable -= _unitsToBuy;

    purchases.push(purchaseContract);

    if (address(priceTokenContract) == 0x00) {
      // Price is in ETH
      purchaseContract.pay.value(msg.value)();
    }
    else {
      // Price is in ERC827
      priceTokenContract.transferFrom(tx.origin, purchaseContract, price);
      /* purchaseContract.payERC827(); */
    }

    emit ListingPurchased(purchaseContract);
    emit ListingChange();
  }

  /// @dev close(): Allows a seller to close the listing from further purchases
  function close()
    public
    isSeller
  {
    unitsAvailable = 0;
    emit ListingChange();
  }

  /// @dev purchasesLength(): Return number of purchases for a given listing
  function purchasesLength()
    public
    constant
    returns (uint)
  {
      return purchases.length;
  }

  /// @dev getPurchase(): Return purchase info for a given listing
  /// @param _index the index of the listing we want info about
  function getPurchase(uint _index)
    public
    constant
    returns (Purchase)
  {
    return (
      purchases[_index]
    );
  }

}
