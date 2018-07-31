pragma solidity 0.4.23;

import "./NonceTracker.sol";
import "./BytesLib.sol";

library OnBehalfableLibrary {
  using BytesLib for bytes;

  function hashCheck(address __sender, uint8 __v, bytes32 __r, bytes32 __s, bytes32 in_hash) public pure returns (bool)
  {
    bytes memory prefix = "\x19Ethereum Signed Message:\n32";
    bytes32 hash = keccak256(prefix, in_hash);
    address _recovered = ecrecover(hash, __v, __r, __s);
    return _recovered == __sender;
  }
}
