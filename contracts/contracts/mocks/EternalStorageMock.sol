pragma solidity ^0.4.23;

import "../eternalstorage/EternalStorage.sol";


// @title Mock for EternalStorage that doesn't check permissions
// @notice Useful for unit tests and using contracts in Remix
contract EternalStorageMock is EternalStorage {
  modifier ifAdmin() {
    _;
  }

  modifier ifWriter() {
    _;
  }
}