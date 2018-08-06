pragma solidity ^0.4.23;


import "../token/ESToken.sol";

// @title Adapter for OpenZeppelin token minting tests
contract MintableTokenMock is ESToken {
  constructor(EternalStorage es_) public ESToken(es_) { }
}
