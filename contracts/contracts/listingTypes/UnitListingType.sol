pragma solidity 0.4.24;

import "../EvolvingRegistry.sol";

contract UnitListingType {
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
