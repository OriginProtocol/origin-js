pragma solidity ^0.4.23;

import "../token/V001/OriginToken.sol";
import "./EternalStorageMock.sol";

/**
 * @title Adapter for  OpenZeppelin token tests.
 */
contract OriginTokenMock is V001_OriginToken {
  constructor(
    EternalStorage _es
  )
    public
    V001_OriginToken(_es)
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

/**
 * @title Easy-to-use mock for Origin token. Intended for use with Remix.
 *
 * NOTE: You'll need to increase Remix's gas limit to at least 7,000,000 to
 * successfully deploy this contract.
 */
contract EasyOriginTokenMock is OriginTokenMock {
  constructor() public OriginTokenMock(new EternalStorageMock()) { }
}
