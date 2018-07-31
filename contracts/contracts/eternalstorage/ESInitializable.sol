pragma solidity ^0.4.23;

import "./EternalStorage.sol";

/**
 * @title Ensures at most one initialization for a contract
 */
contract ESInitializable {
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