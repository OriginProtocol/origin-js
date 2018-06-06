pragma solidity 0.4.23;

/// @title Purchase
/// @dev An purchase Origin Listing representing a purchase/booking
import "./Listing.sol";


contract Purchase {

  /*
  * Events
  */

  event PurchaseChange(Stages stage);
  event PurchaseReview(address reviewer, address reviewee, Roles revieweeRole, uint8 rating, bytes32 ipfsHash);

  /*
  * Enum
  */

  enum Stages {
    AWAITING_PAYMENT, // Buyer hasn't paid full amount yet
    SHIPPING_PENDING, // Waiting for the seller to ship
    BUYER_PENDING, // Waiting for buyer to confirm receipt
    SELLER_PENDING, // Waiting for seller to confirm all is good
    IN_DISPUTE, // We are in a dispute
    REVIEW_PERIOD, // Time for reviews (only when transaction did not go through)
    COMPLETE // It's all over
  }

  enum Roles {
    BUYER,
    SELLER
  }

  /*
  * Storage
  */

  Stages private internalStage = Stages.AWAITING_PAYMENT;

  Listing public listingContract; // listing that is being purchased
  address public buyer; // User who is buying. Seller is derived from listing
  uint public created;
  uint public buyerTimout;

  /*
  * Modifiers
  */

  modifier isSeller() {
    require(msg.sender == listingContract.owner());
    _;
  }

  modifier isBuyer() {
    require(msg.sender == buyer);
    _;
  }

  modifier atStage(Stages _stage) {
    require(stage() == _stage);
    _;
  }

  /*
  * Public functions
  */

  constructor(
    address _listingContractAddress,
    address _buyer
  )
  public
  {
    buyer = _buyer;
    listingContract = Listing(_listingContractAddress);
    created = now;
    emit PurchaseChange(internalStage);
  }

  function data()
  public
  view
  returns (Stages _stage, Listing _listingContract, address _buyer, uint _created, uint _buyerTimout) {
      return (stage(), listingContract, buyer, created, buyerTimout);
  }

  // Pay for listing
  // We used to limit this to buyer, but that prevents Listing contract from
  // paying
  function pay()
  public
  payable
  atStage(Stages.AWAITING_PAYMENT)
  {
    if (address(this).balance >= listingContract.price()) {
      // Buyer (or their proxy) has paid enough to cover purchase
      setStage(Stages.SHIPPING_PENDING);
    }
    // Possible that nothing happens, and contract just accumulates sent value
  }

  function stage()
  public
  view
  returns (Stages _stage)
  {
    if (internalStage == Stages.BUYER_PENDING) {
      if (now > buyerTimout) {
        return Stages.SELLER_PENDING;
      }
    }
    return internalStage;
  }

  function sellerConfirmShipped()
  public
  isSeller
  atStage(Stages.SHIPPING_PENDING)
  {
      buyerTimout = now + 21 days;
      setStage(Stages.BUYER_PENDING);
  }

  function buyerConfirmReceipt(uint8 _rating, bytes32 _ipfsHash)
  public
  isBuyer
  atStage(Stages.BUYER_PENDING)
  {
    // Checks
    require(_rating >= 1);
    require(_rating <= 5);

    // State changes
    setStage(Stages.SELLER_PENDING);

    // Events
    emit PurchaseReview(buyer, listingContract.owner(), Roles.SELLER, _rating, _ipfsHash);
  }

  function sellerCollectPayout(uint8 _rating, bytes32 _ipfsHash)
  public
  isSeller
  atStage(Stages.SELLER_PENDING)
  {
    // Checks
    require(_rating >= 1);
    require(_rating <= 5);

    // State changes
    setStage(Stages.COMPLETE);

    // Events
    emit PurchaseReview(listingContract.owner(), buyer, Roles.BUYER, _rating, _ipfsHash);

    // Transfers
    // Send contract funds to seller (ie owner of Listing)
    // Transfering money always needs to be the last thing we do, do avoid
    // rentrancy bugs. (Though here the seller would just be getting their own money)
    listingContract.owner().transfer(address(this).balance);
  }

  function openDispute()
  public
  {
    // Must be buyer or seller
    require(
      (msg.sender == buyer) ||
      (msg.sender == listingContract.owner())
    );

    // Must be in a valid stage
    require(
      (stage() == Stages.BUYER_PENDING) ||
      (stage() == Stages.SELLER_PENDING)
    );

    setStage(Stages.IN_DISPUTE);

    // TODO: Create a dispute contract?
    // Right now there's no way to exit this state.
  }

  function setStage(Stages _stage)
  private
  {
    internalStage = _stage;
    emit PurchaseChange(_stage);
  }
}
