pragma solidity 0.4.24;

/**
 * @title Ownable
 * @dev The Ownable contract has an owner address, and provides basic authorization control
 * functions, this simplifies the implementation of "user permissions".
 */
contract Ownable {
  address public owner;


  event OwnershipRenounced(address indexed previousOwner);
  event OwnershipTransferred(
    address indexed previousOwner,
    address indexed newOwner
  );


  /**
   * @dev The Ownable constructor sets the original `owner` of the contract to the sender
   * account.
   */
  constructor() public {
    owner = msg.sender;
  }

  /**
   * @dev Throws if called by any account other than the owner.
   */
  modifier onlyOwner() {
    require(msg.sender == owner);
    _;
  }

  /**
   * @dev Allows the current owner to relinquish control of the contract.
   * @notice Renouncing to ownership will leave the contract without an owner.
   * It will not be possible to call the functions with the `onlyOwner`
   * modifier anymore.
   */
  function renounceOwnership() public onlyOwner {
    emit OwnershipRenounced(owner);
    owner = address(0);
  }

  /**
   * @dev Allows the current owner to transfer control of the contract to a newOwner.
   * @param _newOwner The address to transfer ownership to.
   */
  function transferOwnership(address _newOwner) public onlyOwner {
    _transferOwnership(_newOwner);
  }

  /**
   * @dev Transfers control of the contract to a newOwner.
   * @param _newOwner The address to transfer ownership to.
   */
  function _transferOwnership(address _newOwner) internal {
    require(_newOwner != address(0));
    emit OwnershipTransferred(owner, _newOwner);
    owner = _newOwner;
  }
}

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
    uint256 price;
    uint256 unitsAvailable;
  }

  struct Purchase {
    Stages internalStage;
    address buyer;
    uint256 created;
    uint256 buyerTimeout;
  }

  Listing[] public listings;
  Purchase[] public purchases;
  mapping(uint256 => uint256[]) public listingPurchases;

  constructor(EvolvingRegistry _listingRegistry) public {
    listingRegistry = _listingRegistry;
  }

  function purchasesLength(uint256 _listingIndex) public constant returns (uint) {
    return listingPurchases[_listingIndex].length;
  }

  function getPurchase(uint256 _listingIndex, uint256 _purchaseIndex)
    public
    constant
    returns (Stages, address, uint256, uint256) {
    return (
      purchases[listingPurchases[_listingIndex][_purchaseIndex]].internalStage,
      purchases[listingPurchases[_listingIndex][_purchaseIndex]].buyer,
      purchases[listingPurchases[_listingIndex][_purchaseIndex]].created,
      purchases[listingPurchases[_listingIndex][_purchaseIndex]].buyerTimeout
    );
  }

  function createListing (
    uint256 _price,
    uint256 _unitsAvailable
  ) public {
    listings.push(Listing(
      msg.sender,
      now,
      now + 60 days,
      _price,
      _unitsAvailable
    ));
    listingRegistry.addEntry(listings.length - 1);
  }

  function getListing (uint256 _index)
    public
    view
    returns (address _seller, uint _created, uint _expiration, uint _price, uint _unitsAvailable)
  {
    return (
      listings[_index].seller,
      listings[_index].created,
      listings[_index].expiration,
      listings[_index].price,
      listings[_index].unitsAvailable
    );
  }

  function buyListing (uint256 _index, uint256 _unitsToBuy)
    public
    payable
    isNotSeller(_index)
    hasNotExpired(_index)
  {
    require(_unitsToBuy <= listings[_index].unitsAvailable);
    purchases.push(Purchase(
      Stages.AWAITING_PAYMENT,
      msg.sender,
      now,
      now + 21 days
    ));
    listingPurchases[_index].push(purchases.length - 1);
  }

  function close(uint256 _index)
    public
    isSeller(_index)
  {
    listings[_index].unitsAvailable = 0;
  }

  function listingsLength()
    public
    constant
    returns (uint256)
  {
      return listings.length;
  }
}
