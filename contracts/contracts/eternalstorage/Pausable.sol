pragma solidity ^0.4.23;

import "../eternalstorage/EternalStorage.sol";
import "../../../node_modules/openzeppelin-solidity/contracts/ownership/Ownable.sol";


/**
 * @title Pausable
 * @dev Base contract which allows children to implement an emergency stop mechanism.
 * Uses EternalStorage to persist pause status across logic contract upgrades.
 */
contract Pausable is Ownable {

  event Pause();
  event Unpause();

  EternalStorage es;

  bytes32 constant pausedKey = keccak256("token.paused");

  constructor(EternalStorage es_) public {
    es = es_;
    // We intentionally do not set the value for pausedKey here, because this
    // contract needs to be added to the EternalStorage contract's set of
    // writers. It isn't necessary, because lookups for nonexistent keys return
    // false.
  }

  function paused() public view returns (bool) {
    return es.getBool(pausedKey);
  }

  /**
   * @dev Modifier to make a function callable only when the contract is not paused.
   */
  modifier whenNotPaused() {
    require(!paused(), "cannot execute while paused");
    _;
  }

  /**
   * @dev Modifier to make a function callable only when the contract is paused.
   */
  modifier whenPaused() {
    require(paused(), "can only execute while paused");
    _;
  }

  /**
   * @dev called by the owner to pause, triggers stopped state
   */
  function pause() onlyOwner whenNotPaused public {
    es.setBool(pausedKey, true);
    emit Pause();
  }

  /**
   * @dev called by the owner to unpause, returns to normal state
   */
  function unpause() onlyOwner whenPaused public {
    es.setBool(pausedKey, false);
    emit Unpause();
  }
}
