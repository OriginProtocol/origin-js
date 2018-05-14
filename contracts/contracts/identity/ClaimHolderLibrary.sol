pragma solidity ^0.4.23;

library ClaimHolderLibrary {
  function getBytes(bytes _str, uint256 _offset, uint256 _length)
      internal
      pure
      returns (bytes)
  {
      bytes memory sig = new bytes(_length);
      uint256 j = 0;
      for (uint256 k = _offset; k< _offset + _length; k++) {
        sig[j] = _str[k];
        j++;
      }
      return sig;
  }
}
