pragma solidity 0.4.23;

import "./Escrow.sol";

contract V01_Listings {
  event ListingChange(uint256 indexed _listingIndex, bytes32 _ipfsHash);
  event PurchaseChange(uint256 indexed _listingIndex, uint256 indexed _purchaseIndex, bytes32 _ipfsHash, Stages _stage);

  modifier isSeller(uint256 _listingIndex) {
    require(msg.sender == listings[_listingIndex].seller);
    _;
  }

  modifier isBuyer(uint256 _listingIndex, uint256 _purchaseIndex) {
    uint256 globalPurchaseIndex = listings[_listingIndex].purchaseIndices[_purchaseIndex];
    require(msg.sender == purchases[globalPurchaseIndex].buyer);
    _;
  }

  modifier isNotSeller(uint256 _listingIndex) {
    require(msg.sender != listings[_listingIndex].seller);
    _;
  }

  modifier isAtStage(uint256 _listingIndex, uint256 _purchaseIndex, Stages _stage) {
    uint256 globalPurchaseIndex = listings[_listingIndex].purchaseIndices[_purchaseIndex];
    require(purchases[globalPurchaseIndex].stage == _stage);
    _;
  }

  enum Stages {
    BUYER_REQUESTED,
    BUYER_CANCELED,
    SELLER_ACCEPTED,
    SELLER_REJECTED,
    BUYER_FINALIZED,
    SELLER_FINALIZED
  }

  struct Listing {
    address seller;
    bytes32[] ipfsVersions;
    uint256[] purchaseIndices;
  }

  struct Purchase {
    Stages stage;
    address buyer;
    address escrowContract;
  }

  Listing[] public listings;
  Purchase[] public purchases;

  function listingsLength() public constant returns (uint) {
    return listings.length;
  }

  function createListing(bytes32 _ipfsHash) public {
    Listing memory listing = Listing(
      msg.sender,
      new bytes32[](0),
      new uint256[](0)
    );
    listings.push(listing);
    listings[listings.length - 1].ipfsVersions.push(_ipfsHash);
    emit ListingChange(listings.length - 1, _ipfsHash);
  }

  function updateListing(uint256 _listingIndex, uint256 _currentVersion, bytes32 _ipfsHash)
    public
    isSeller(_listingIndex)
  {
    require(_currentVersion == listings[_listingIndex].ipfsVersions.length - 1);
    listings[_listingIndex].ipfsVersions.push(_ipfsHash);
    emit ListingChange(_listingIndex, _ipfsHash);
  }

  function getListing(uint256 _listingIndex)
    public
    view
    returns (address _seller, bytes32 _ipfsHash, uint256 _purchasesLength)
  {
    return (
      listings[_listingIndex].seller,
      listings[_listingIndex].ipfsVersions[listings[_listingIndex].ipfsVersions.length - 1],
      listings[_listingIndex].purchaseIndices.length
    );
  }

  function getListingVersion(uint256 _listingIndex)
    public
    view
    returns (uint256 _listingVersion)
  {
    return listings[_listingIndex].ipfsVersions.length - 1;
  }

  function requestPurchase(uint256 _listingIndex, bytes32 _ipfsHash)
    public
    payable
    isNotSeller(_listingIndex)
  {
    address escrowContract = (new V01_Escrow).value(msg.value)(msg.sender, listings[_listingIndex].seller);
    purchases.push(Purchase(
      Stages.BUYER_REQUESTED,
      msg.sender,
      escrowContract
    ));
    listings[_listingIndex].purchaseIndices.push(purchases.length - 1);
    emit PurchaseChange(_listingIndex, purchases.length - 1, _ipfsHash, Stages.BUYER_REQUESTED);
  }

  function cancelPurchaseRequest(uint256 _listingIndex, uint256 _purchaseIndex, bytes32 _ipfsHash)
    public
    payable
    isBuyer(_listingIndex, _purchaseIndex)
    isAtStage(_listingIndex, _purchaseIndex, Stages.BUYER_REQUESTED)
  {
    uint256 globalPurchaseIndex = listings[_listingIndex].purchaseIndices[_purchaseIndex];
    V01_Escrow escrow = V01_Escrow(purchases[globalPurchaseIndex].escrowContract);
    escrow.cancel();
    purchases[globalPurchaseIndex].stage = Stages.BUYER_CANCELED;
    emit PurchaseChange(_listingIndex, _purchaseIndex, _ipfsHash, purchases[globalPurchaseIndex].stage);
  }

  function acceptPurchaseRequest(uint256 _listingIndex, uint256 _purchaseIndex, bytes32 _ipfsHash)
    public
    payable
    isSeller(_listingIndex)
    isAtStage(_listingIndex, _purchaseIndex, Stages.BUYER_REQUESTED)
  {
    uint256 globalPurchaseIndex = listings[_listingIndex].purchaseIndices[_purchaseIndex];
    purchases[globalPurchaseIndex].stage = Stages.SELLER_ACCEPTED;
    emit PurchaseChange(_listingIndex, _purchaseIndex, _ipfsHash, purchases[globalPurchaseIndex].stage);
  }

  function acceptPurchaseAndUpdateListing(uint256 _listingIndex, uint256 _purchaseIndex, bytes32 _purchaseIpfsHash, uint256 _currentListingVersion, bytes32 _listingIpfsHash)
    public
    payable
    isSeller(_listingIndex)
    isAtStage(_listingIndex, _purchaseIndex, Stages.BUYER_REQUESTED)
  {
    acceptPurchaseRequest(_listingIndex, _purchaseIndex, _purchaseIpfsHash);
    updateListing(_listingIndex, _currentListingVersion, _listingIpfsHash);
  }

  function rejectPurchaseRequest(uint256 _listingIndex, uint256 _purchaseIndex, bytes32 _ipfsHash)
    public
    payable
    isSeller(_listingIndex)
    isAtStage(_listingIndex, _purchaseIndex, Stages.BUYER_REQUESTED)
  {
    uint256 globalPurchaseIndex = listings[_listingIndex].purchaseIndices[_purchaseIndex];
    V01_Escrow escrow = V01_Escrow(purchases[globalPurchaseIndex].escrowContract);
    escrow.cancel();
    purchases[globalPurchaseIndex].stage = Stages.SELLER_REJECTED;
    emit PurchaseChange(_listingIndex, _purchaseIndex, _ipfsHash, purchases[globalPurchaseIndex].stage);
  }

  function buyerFinalizePurchase(uint256 _listingIndex, uint256 _purchaseIndex, bytes32 _ipfsHash)
    public
    payable
    isBuyer(_listingIndex, _purchaseIndex)
    isAtStage(_listingIndex, _purchaseIndex, Stages.SELLER_ACCEPTED)
  {
    uint256 globalPurchaseIndex = listings[_listingIndex].purchaseIndices[_purchaseIndex];
    purchases[globalPurchaseIndex].stage = Stages.BUYER_FINALIZED;
    emit PurchaseChange(_listingIndex, _purchaseIndex, _ipfsHash, purchases[globalPurchaseIndex].stage);
  }

  function sellerFinalizePurchase(uint256 _listingIndex, uint256 _purchaseIndex, bytes32 _ipfsHash)
    public
    payable
    isSeller(_listingIndex)
    isAtStage(_listingIndex, _purchaseIndex, Stages.BUYER_FINALIZED)
  {
    uint256 globalPurchaseIndex = listings[_listingIndex].purchaseIndices[_purchaseIndex];
    V01_Escrow escrow = V01_Escrow(purchases[globalPurchaseIndex].escrowContract);
    escrow.complete();
    purchases[globalPurchaseIndex].stage = Stages.SELLER_FINALIZED;
    emit PurchaseChange(_listingIndex, _purchaseIndex, _ipfsHash, purchases[globalPurchaseIndex].stage);
  }

  function purchasesLength(uint256 _listingIndex) public constant returns (uint) {
    return listings[_listingIndex].purchaseIndices.length;
  }

  function getPurchase(uint256 _listingIndex, uint256 _purchaseIndex)
    public
    constant
    returns (Stages _stage, address _buyer, address _escrowContract) {
      uint256 globalPurchaseIndex = listings[_listingIndex].purchaseIndices[_purchaseIndex];
      Purchase memory purchase = purchases[globalPurchaseIndex];
      return (
        purchase.stage,
        purchase.buyer,
        purchase.escrowContract
      );
  }
}
