pragma solidity 0.4.24;

import "../../EvolvingRegistry.sol";
import "./Escrow.sol";

contract V01_Listings {
  EvolvingRegistry listingRegistry;

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

  mapping(uint256 => Listing) public listings;

  Purchase[] public purchases;

  constructor(EvolvingRegistry _listingRegistry) public {
    listingRegistry = _listingRegistry;
  }

  function createListing(bytes32 _ipfsHash) public {
    uint256 entryId = listingRegistry.addEntry();
    Listing memory listing = Listing(
      msg.sender,
      new bytes32[](0),
      new uint256[](0)
    );
    listings[entryId] = listing;
    listings[entryId].ipfsVersions.push(_ipfsHash);
  }

  function updateListing(uint256 _listingIndex, uint256 _currentVersion, bytes32 _ipfsHash)
    public
    isSeller(_listingIndex)
  {
    if (_currentVersion == listings[_listingIndex].ipfsVersions.length - 1) {
      listings[_listingIndex].ipfsVersions.push(_ipfsHash);
    }
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

  function requestPurchase(uint256 _listingIndex)
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
  }

  function cancelPurchaseRequest(uint256 _listingIndex, uint256 _purchaseIndex)
    public
    payable
    isBuyer(_listingIndex, _purchaseIndex)
    isAtStage(_listingIndex, _purchaseIndex, Stages.BUYER_REQUESTED)
  {
    uint256 globalPurchaseIndex = listings[_listingIndex].purchaseIndices[_purchaseIndex];
    V01_Escrow escrow = V01_Escrow(purchases[globalPurchaseIndex].escrowContract);
    escrow.cancel();
    purchases[globalPurchaseIndex].stage = Stages.BUYER_CANCELED;
  }

  function purchasesLength(uint256 _listingIndex) public constant returns (uint) {
    return listings[_listingIndex].purchaseIndices.length;
  }

  function getPurchase(uint256 _listingIndex, uint256 _purchaseIndex)
    public
    constant
    returns (Stages, address, address _escrowContract) {
      uint256 globalPurchaseIndex = listings[_listingIndex].purchaseIndices[_purchaseIndex];
      Purchase memory purchase = purchases[globalPurchaseIndex];
      return (
        purchase.stage,
        purchase.buyer,
        purchase.escrowContract
      );
  }
}
