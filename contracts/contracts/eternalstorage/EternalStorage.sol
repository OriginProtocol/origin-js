pragma solidity 0.4.23;


import "../../../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";


// @title Key/value storage contract
// @note Based on Rocket Pool's RocketStorage.
contract EternalStorage {
  using SafeMath for uint256;
  using SafeMath for int256;

  // Key/value mappings

  mapping(bytes32 => uint256)    private uIntStorage;
  mapping(bytes32 => string)     private stringStorage;
  mapping(bytes32 => address)    private addressStorage;
  mapping(bytes32 => bytes)      private bytesStorage;
  mapping(bytes32 => bool)       private boolStorage;
  mapping(bytes32 => int256)     private intStorage;

  mapping(address => bool) admins;
  mapping(address => bool) writers;
  uint16 adminCount;

  /*** Modifiers ************/

  // TODO: implement ownership of this contract

  /// @dev constructor
  constructor() public {
    // By default, the account that deployed this contract is the owner.
    admins[msg.sender] = true;
    adminCount++;
  }

  //
  // Ownership functions
  //

  modifier ifAdmin() {
    require(isAdmin(msg.sender), "sender is not an owner of this contract");
    _;
  }

  modifier ifWriter() {
    require(isWriter(msg.sender), "sender not authorized to write to this contract");
    _;
  }

  function addAdmin(address _admin) external ifAdmin {
    if (!admins[_admin]) {
      admins[_admin] = true;
      adminCount++;
    }
  }

  function isAdmin(address _admin) public view returns (bool) {
    return admins[_admin];
  }

  function removeAdmin(address _admin) external ifAdmin {
    require(adminCount > 1, "cannot remove last admin");
    if (admins[_admin]) {
      delete admins[_admin];
      adminCount--;
    }
  }

  function addWriter(address _writer) external ifAdmin {
    writers[_writer] = true;
  }

  function isWriter(address _addr) public view returns (bool) {
    return writers[_addr] || admins[_addr];
  }

  function removeWriter(address _writer) external ifWriter {
    delete writers[_writer];
  }

  //
  // Get functions
  //

  /// @param _key The key for the record
  function getAddress(bytes32 _key) external view returns (address) {
    return addressStorage[_key];
  }

  /// @param _key The key for the record
  function getUint(bytes32 _key) external view returns (uint) {
    return uIntStorage[_key];
  }

  /// @param _key The key for the record
  function getString(bytes32 _key) external view returns (string) {
    return stringStorage[_key];
  }

  /// @param _key The key for the record
  function getBytes(bytes32 _key) external view returns (bytes) {
    return bytesStorage[_key];
  }

  /// @param _key The key for the record
  function getBool(bytes32 _key) external view returns (bool) {
    return boolStorage[_key];
  }

  /// @param _key The key for the record
  function getInt(bytes32 _key) external view returns (int) {
    return intStorage[_key];
  }

  //
  // Set functions
  //
  // TODO(cuongdo): implement access control for setters & deleters

  /// @param _key The key for the record
  function setAddress(bytes32 _key, address _value) external ifWriter {
    addressStorage[_key] = _value;
  }

  /// @param _key The key for the record
  function setUint(bytes32 _key, uint _value) external ifWriter {
    uIntStorage[_key] = _value;
  }

  /// @param _key The key for the record
  function setString(bytes32 _key, string _value) external ifWriter {
    stringStorage[_key] = _value;
  }

  /// @param _key The key for the record
  function setBytes(bytes32 _key, bytes _value) external ifWriter {
    bytesStorage[_key] = _value;
  }

  /// @param _key The key for the record
  function setBool(bytes32 _key, bool _value) external ifWriter {
    boolStorage[_key] = _value;
  }

  /// @param _key The key for the record
  function setInt(bytes32 _key, int _value) external ifWriter {
    intStorage[_key] = _value;
  }

  //
  // Increment & decrement functions
  //

  function incrementUint(bytes32 _key, uint i) external ifWriter returns (uint) {
    uIntStorage[_key] = uIntStorage[_key].add(i);
    return uIntStorage[_key];
  }

  function decrementUint(bytes32 _key, uint i) external ifWriter returns (uint) {
    uIntStorage[_key] = uIntStorage[_key].sub(i);
    return uIntStorage[_key];
  }

  function incrementInt(bytes32 _key, int i) external ifWriter returns (int) {
    // TODO: make this use some SafeMath-equivalent for int256's
    intStorage[_key] += i;
    return intStorage[_key];
  }

  function decrementInt(bytes32 _key, int i) external ifWriter returns (int) {
    // TODO: make this use some SafeMath-equivalent for int256's
    intStorage[_key] -= i;
    return intStorage[_key];
  }

  //
  // Delete functions
  //

  /// @param _key The key for the record
  function deleteAddress(bytes32 _key) external ifWriter {
    delete addressStorage[_key];
  }

  /// @param _key The key for the record
  function deleteUint(bytes32 _key) external ifWriter {
    delete uIntStorage[_key];
  }

  /// @param _key The key for the record
  function deleteString(bytes32 _key) external ifWriter {
    delete stringStorage[_key];
  }

  /// @param _key The key for the record
  function deleteBytes(bytes32 _key) external ifWriter {
    delete bytesStorage[_key];
  }

  /// @param _key The key for the record
  function deleteBool(bytes32 _key) external ifWriter {
    delete boolStorage[_key];
  }

  /// @param _key The key for the record
  function deleteInt(bytes32 _key) external ifWriter {
    delete intStorage[_key];
  }
}
