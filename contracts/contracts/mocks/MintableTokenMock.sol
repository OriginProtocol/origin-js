pragma solidity ^0.4.23;


import "../token/ESToken.sol";

// @title Needed for OpenZeppelin MintableToken tests
contract MintableTokenMock is ESToken {
  constructor(EternalStorage es_) public ESToken(es_) { }
}
