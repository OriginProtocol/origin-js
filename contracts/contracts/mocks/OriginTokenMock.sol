pragma solidity ^0.4.23;

import "../eternalstorage/ESInitializable.sol";
import "../token/ESToken.sol";


// @title Adapter for  OpenZeppelin token tests.
contract OriginTokenMock is ESToken, ESInitializable {
  constructor(
    EternalStorage es_
  )
    public
    ESToken(es_)
    ESInitializable(es_, "token_mock.initialized")
  {
    // The real work is done in initialize().
  }

  function initialize(
    address initialAccount,
    uint256 initialBalance
  )
    public
    isInitializer
  {
    require(!es.getBool(initializedKey), "cannot initialize more than once");
    owner = initialAccount;
    es.setUint(totalSupplyKey, initialBalance);
    es.setUint(balanceOfKey(owner), initialBalance);
    emit Transfer(address(0), owner, initialBalance);
  }
}
