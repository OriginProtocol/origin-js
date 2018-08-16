pragma solidity 0.4.23;


import "../../../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";


/**
 * @title Key/value storage contract
 * @notice Maintains a set of key/value mappings for the
 * @dev Based on Rocket Pool's RocketStorage.
 *
 * Security model:
 * - Admins may add or remove admins or writers
 * - Admins and writers may mutate storage
 * - At least one admin always exists
 * - Anyone may read any key
 * - Because of Solidity/EVM limitations, there is no way to iterate through
 *   all keys.
 */
contract EternalStorage {
  event AdminAdded(address newAdmin);
  event AdminRemoved(address removedAdmin);
  event WriterAdded(address newWriter);
  event WriterRemoved(address removedWriter);

  using SafeMath for uint256;

  // Key/value mappings
  mapping(bytes32 => uint256)    private uintStorage;
  mapping(bytes32 => string)     private stringStorage;
  mapping(bytes32 => address)    private addressStorage;
  mapping(bytes32 => bytes)      private bytesStorage;
  mapping(bytes32 => bool)       private boolStorage;
  mapping(bytes32 => int256)     private intStorage;

  // Access control
  mapping(address => bool) admins;
  mapping(address => bool) writers;
  uint16 public adminCount;
  uint16 public writerCount;

  // @dev constructor
  constructor() public {
    // By default, the account that deployed this contract is the owner.
    admins[msg.sender] = true;
    adminCount++;
  }

  //
  // Access control functions
  //

  modifier ifAdmin() {
    require(isAdmin(msg.sender), "sender is not an owner of this contract");
    _;
  }

  modifier canWrite() {
    require(isWriter(msg.sender), "sender not authorized to write to this contract");
    _;
  }

  // @notice Adds an admin for this contract
  function addAdmin(address _admin) external ifAdmin {
    if (admins[_admin]) {
      return;
    }
    admins[_admin] = true;
    adminCount++;
    emit AdminAdded(_admin);
  }

  function isAdmin(address _admin) public view returns (bool) {
    return admins[_admin];
  }

  // @notice Removes an admin for this contract
  // @dev Reverts if attempting to remove last admin
  function removeAdmin(address _admin) external ifAdmin {
    if (!admins[_admin]) {
      return;
    }
    require(adminCount > 1, "cannot remove last admin");
    delete admins[_admin];
    adminCount--;
    emit AdminRemoved(_admin);
  }

  // @notice Adds an address that is authorized modify records in this contract
  function addWriter(address _writer) external ifAdmin {
    if (writers[_writer]) {
      return;
    }
    writers[_writer] = true;
    writerCount++;
    emit WriterAdded(_writer);
  }

  function isWriter(address _addr) public view returns (bool) {
    return writers[_addr] || admins[_addr];
  }

  // @notice Removes an address that is authorized modify records in this
  // contract
  function removeWriter(address _writer) external canWrite {
    if (!writers[_writer]) {
      return;
    }
    delete writers[_writer];
    writerCount--;
    emit WriterRemoved(_writer);
  }

  //
  // Get functions
  //

  // @param _key The key for the record
  function getAddress(bytes32 _key) external view returns (address) {
    return addressStorage[_key];
  }

  // @param _key The key for the record
  function getUint(bytes32 _key) external view returns (uint) {
    return uintStorage[_key];
  }

  // @param _key The key for the record
  function getString(bytes32 _key) external view returns (string) {
    return stringStorage[_key];
  }

  // @param _key The key for the record
  function getBytes(bytes32 _key) external view returns (bytes) {
    return bytesStorage[_key];
  }

  // @param _key The key for the record
  function getBool(bytes32 _key) external view returns (bool) {
    return boolStorage[_key];
  }

  // @param _key The key for the record
  function getInt(bytes32 _key) external view returns (int256) {
    return intStorage[_key];
  }

  //
  // Set functions
  //

  // @param _key The key for the record
  function setAddress(bytes32 _key, address _value) external canWrite {
    addressStorage[_key] = _value;
  }

  // @param _key The key for the record
  function setUint(bytes32 _key, uint _value) external canWrite {
    uintStorage[_key] = _value;
  }

  // @param _key The key for the record
  function setString(bytes32 _key, string _value) external canWrite {
    stringStorage[_key] = _value;
  }

  // @param _key The key for the record
  function setBytes(bytes32 _key, bytes _value) external canWrite {
    bytesStorage[_key] = _value;
  }

  // @param _key The key for the record
  function setBool(bytes32 _key, bool _value) external canWrite {
    boolStorage[_key] = _value;
  }

  // @param _key The key for the record
  function setInt(bytes32 _key, int256 _value) external canWrite {
    intStorage[_key] = _value;
  }

  //
  // Increment & decrement functions
  //

  // @notice Increments value corresponding to key
  // @dev Reverts on overflow or underflow
  function incrementUint(bytes32 _key, uint i) external canWrite returns (uint) {
    uintStorage[_key] = uintStorage[_key].add(i);
    return uintStorage[_key];
  }

  // @notice Decrements value corresponding to key
  // @dev Reverts on overflow or underflow
  function decrementUint(bytes32 _key, uint i) external canWrite returns (uint) {
    uintStorage[_key] = uintStorage[_key].sub(i);
    return uintStorage[_key];
  }

  // @notice Increments value corresponding to key
  // @dev Reverts on overflow or underflow
  function incrementInt(bytes32 _key, int i) external canWrite returns (int) {
    // SafeMath has nothing for signed numbers
    int256 oldValue = intStorage[_key];
    intStorage[_key] = oldValue + i;
    if (i >= 0) {
      assert(intStorage[_key] >= oldValue);
    } else {
      assert(intStorage[_key] < oldValue);
    }
    return intStorage[_key];
  }

  // @notice Decrements value corresponding to key
  // @dev Reverts on overflow or underflow
  function decrementInt(bytes32 _key, int i) external canWrite returns (int) {
    int256 oldValue = intStorage[_key];
    intStorage[_key] = oldValue - i;
    if (i >= 0) {
      assert(intStorage[_key] <= oldValue);
    } else {
      assert(intStorage[_key] > oldValue);
    }
    return intStorage[_key];
  }

  //
  // Delete functions
  //

  // @param _key The key for the record
  function deleteAddress(bytes32 _key) external canWrite {
    delete addressStorage[_key];
  }

  // @param _key The key for the record
  function deleteUint(bytes32 _key) external canWrite {
    delete uintStorage[_key];
  }

  // @param _key The key for the record
  function deleteString(bytes32 _key) external canWrite {
    delete stringStorage[_key];
  }

  // @param _key The key for the record
  function deleteBytes(bytes32 _key) external canWrite {
    delete bytesStorage[_key];
  }

  // @param _key The key for the record
  function deleteBool(bytes32 _key) external canWrite {
    delete boolStorage[_key];
  }

  // @param _key The key for the record
  function deleteInt(bytes32 _key) external canWrite {
    delete intStorage[_key];
  }
}
