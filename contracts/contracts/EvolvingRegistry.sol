pragma solidity 0.4.24;

import "./Ownable.sol";

contract EvolvingRegistry is Ownable {
  struct ItemType {
    string name;
    bool isEnabled;
  }

  struct Entry {
    address typeContract;
    uint256 id;
  }

  mapping(address => ItemType) public itemTypes;

  Entry[] public entries;

  function addItemType(address _typeContract, string _name) public onlyOwner() {
    itemTypes[_typeContract].name = _name;
    itemTypes[_typeContract].isEnabled = true;
  }

  function disableItemType(address _typeContract) public onlyOwner() {
    itemTypes[_typeContract].isEnabled = false;
  }

  function enableItemType(address _typeContract) public onlyOwner() {
    itemTypes[_typeContract].isEnabled = true;
  }

  function renameItemType(address _typeContract, string _name) public onlyOwner() {
    itemTypes[_typeContract].name = _name;
  }

  function size() public constant returns (uint256) {
    return entries.length;
  }

  function addEntry(uint256 _id) public {
    address _typeContract = msg.sender;
    require(itemTypes[_typeContract].isEnabled);
    entries.push(Entry(_typeContract, _id));
  }

  function getEntry(uint256 _index) public constant returns (address, uint256) {
    return (entries[_index].typeContract, entries[_index].id);
  }
}
