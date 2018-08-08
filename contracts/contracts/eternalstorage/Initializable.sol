pragma solidity ^0.4.23;

import "./EternalStorage.sol";

/**
 * @title Ensures at most one initialization for a contract
 * @dev Add isInitializer to the contract function that you want to make into an
 * initializer that will only run once.
 */
contract Initializable {
  EternalStorage es;
  bytes32 internal initializedKey;

  constructor(EternalStorage _es, bytes32 _initializedKey) public {
    es = _es;
    initializedKey = _initializedKey;
  }

  modifier isInitializer() {
    require(!es.getBool(initializedKey), "Contract instance has already been initialized");
    _;
    es.setBool(initializedKey, true);
  }
}
