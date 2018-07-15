pragma solidity 0.4.24;

import "./Ownable.sol";

contract EvolvingRegistry is Ownable {
  struct ItemType {
    string name;
    bool isEnabled;
  }

  struct Entry {
    address typeContract;
    uint256 id;
  }

  mapping(address => ItemType) public itemTypes;

  Entry[] public entries;

  function addItemType(address _typeContract, string _name) public onlyOwner() {
    itemTypes[_typeContract].name = _name;
    itemTypes[_typeContract].isEnabled = true;
  }

  function disableItemType(address _typeContract) public onlyOwner() {
    itemTypes[_typeContract].isEnabled = false;
  }

  function enableItemType(address _typeContract) public onlyOwner() {
    itemTypes[_typeContract].isEnabled = true;
  }

  function renameItemType(address _typeContract, string _name) public onlyOwner() {
    itemTypes[_typeContract].name = _name;
  }

  function size() public constant returns (uint256) {
    return entries.length;
  }

  function addEntry(uint256 _id) public {
    address _typeContract = msg.sender;
    require(itemTypes[_typeContract].isEnabled);
    entries.push(Entry(_typeContract, _id));
  }

  function getEntry(uint256 _index) public constant returns (address, uint256) {
    return (entries[_index].typeContract, entries[_index].id);
  }
}

contract UnitListing {
  EvolvingRegistry listingRegistry;

  modifier isSeller(uint256 _listingIndex) {
    require(msg.sender == listings[_listingIndex].seller);
    _;
  }

  modifier isNotSeller(uint256 _listingIndex) {
    require(msg.sender != listings[_listingIndex].seller);
    _;
  }

  modifier hasNotExpired(uint256 _listingIndex) {
    require(now < listings[_listingIndex].expiration);
    _;
  }

  enum Stages {
    AWAITING_PAYMENT, // Buyer hasn't paid full amount yet
    AWAITING_SELLER_APPROVAL, // Waiting on seller to approve purchase
    SELLER_REJECTED, // Seller has rejected purchase
    IN_ESCROW, // Payment has been received but not distributed to seller
    BUYER_PENDING, // Waiting for buyer to confirm receipt
    SELLER_PENDING, // Waiting for seller to confirm all is good
    IN_DISPUTE, // We are in a dispute
    REVIEW_PERIOD, // Time for reviews (only when transaction did not go through)
    COMPLETE // It's all over
  }

  struct Listing {
    address seller;
    uint256 created;
    uint256 expiration;
    bool needsSellerApproval;
    uint256 price;
    uint256 unitsAvailable;
    bytes32 ipfsHash;
  }

  struct Purchase {
    Stages internalStage;
    uint256 listingIndex;
    address buyer;
    uint256 created;
    uint256 buyerTimeout;
    uint256 listingVersion;
    bytes32 ipfsHash;
  }

  Listing[] public listings;
  mapping(uint256 => Purchase[]) public listingPurchases;

  constructor(EvolvingRegistry _listingRegistry) public {
    listingRegistry = _listingRegistry;
  }

  function purchasesLength(uint256 _listingIndex) public constant returns (uint) {
    return listingPurchases[_listingIndex].length;
  }

  function getPurchase(uint256 _listingIndex, uint256 _purchaseIndex)
    public
    constant
    returns (Stages, address, uint256, uint256, uint256, bytes32) {
    return (
      listingPurchases[_listingIndex][_purchaseIndex].internalStage,
      listingPurchases[_listingIndex][_purchaseIndex].buyer,
      listingPurchases[_listingIndex][_purchaseIndex].created,
      listingPurchases[_listingIndex][_purchaseIndex].buyerTimeout,
      listingPurchases[_listingIndex][_purchaseIndex].listingVersion,
      listingPurchases[_listingIndex][_purchaseIndex].ipfsHash
    );
  }

  function createListing (
    bytes32 _ipfsHash,
    uint256 _price,
    uint256 _unitsAvailable
  ) public {
    listings.push(Listing(
      msg.sender,
      now,
      now + 60 days,
      false,
      _price,
      _unitsAvailable,
      _ipfsHash
    ));
    listingRegistry.addEntry(listings.length - 1);
  }
}
