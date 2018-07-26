pragma solidity 0.4.23;

import '../../node_modules/openzeppelin-solidity/contracts/ownership/Ownable.sol';

contract EvolvingRegistry is Ownable {
  event NewEntryType(uint16 indexed _entryTypeIndex);
  event EntryTypeUpdate(uint16 indexed _entryTypeIndex);
  event NewEntry(uint256 indexed _entryIndex, uint16 _entryTypeIndex);

  struct EntryType {
    address contractAddress;
    string name;
    bool isEnabled;
  }

  EntryType[2**16] public entryTypes;
  uint16 entryTypeLength;

  // Enables easy lookup of entry type by contract address instead of index
  mapping(address => uint16) public entryTypesByAddress;

  /* Entries, represented by an array of entry type indices.
    The index of each entry is the entry id;
    The value of each entry is the index of the entry type.
    The index can be used to get the entry type contract.
    The entry type contract handles all logic for the entry.
  */
  uint16[] public entries;

  function addEntryType(address _contractAddress, string _name) public onlyOwner() {
    // Don't allow the same contract address to be added twice
    uint16 trialIndex = entryTypesByAddress[_contractAddress];
    require(entryTypes[trialIndex].contractAddress != _contractAddress);
    uint16 entryTypeIndex = entryTypeLength;
    entryTypes[entryTypeIndex] = EntryType(_contractAddress, _name, true);
    entryTypesByAddress[_contractAddress] = entryTypeIndex;
    entryTypeLength++;
    emit NewEntryType(entryTypeIndex);
  }

  function disableEntryType(uint16 _entryTypeIndex) public onlyOwner() {
    entryTypes[_entryTypeIndex].isEnabled = false;
    emit EntryTypeUpdate(_entryTypeIndex);
  }

  function enableEntryType(uint16 _entryTypeIndex) public onlyOwner() {
    entryTypes[_entryTypeIndex].isEnabled = true;
    emit EntryTypeUpdate(_entryTypeIndex);
  }

  function renameEntryType(uint16 _entryTypeIndex, string _name) public onlyOwner() {
    entryTypes[_entryTypeIndex].name = _name;
    emit EntryTypeUpdate(_entryTypeIndex);
  }

  function size() public constant returns (uint256) {
    return entries.length;
  }

  function addEntry() public returns (uint256) {
    // This lookup will succeed and return 0 for a contract address that we don't have an entry for...
    uint16 _entryTypeIndex = entryTypesByAddress[msg.sender];
    // ...which will give us a vaild, but wrong entry type.
    // Therefore we check that we have actualy looked up the matching entry type
    require(entryTypes[_entryTypeIndex].contractAddress == msg.sender);
    require(entryTypes[_entryTypeIndex].isEnabled);
    entries.push(_entryTypeIndex);
    uint256 entryIndex = entries.length - 1;
    emit NewEntry(entryIndex, _entryTypeIndex);
    return entryIndex;
  }

  function getEntryType(uint16 _entryTypeIndex) public constant returns (address _contractAddress, string _name, bool _isEnabled) {
    return (
      entryTypes[_entryTypeIndex].contractAddress,
      entryTypes[_entryTypeIndex].name,
      entryTypes[_entryTypeIndex].isEnabled
    );
  }

  function getEntryTypeOfEntry(uint256 _entryIndex) public constant returns (address _contractAddress, string _name, bool _isEnabled) {
    uint16 _entryTypeIndex = entries[_entryIndex];
    return getEntryType(_entryTypeIndex);
  }
}
