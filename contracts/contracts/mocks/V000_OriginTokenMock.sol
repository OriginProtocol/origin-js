pragma solidity ^0.4.23;

import "../token/V000/OriginToken.sol";
import "../eternalstorage/EternalStorage.sol";

/**
 * @title Adapter for  OpenZeppelin token tests.
 */
contract V000_OriginTokenMock is V000_OriginToken {
  constructor(
    EternalStorage _es
  )
    public
    V000_OriginToken(_es)
  {
    // The real work is done in initialize().
  }

  function initializeMock(
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
