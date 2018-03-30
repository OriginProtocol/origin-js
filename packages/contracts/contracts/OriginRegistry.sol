pragma solidity ^0.4.21;

contract OriginRegistry {
  address public owner_address;

  mapping(string => address) contract_addresses;

  modifier isOwner() {
    require (OriginRegistryBase(msg.sender).owner_address() == owner_address);
    _;
  }

  function OriginRegistry( )
  public
  {
    owner_address = msg.sender;
  }

  function registerContractAddress(string name, address contract_address)
  public
  isOwner
  {
    contract_addresses[name] = contract_address;
  }

  function getContractAddress(string name)
  public
  view
  isOwner
  returns (address)
  {
    return contract_addresses[name];
  }
}


contract OriginRegistryBase {
  address public owner_address;
  OriginRegistry address_registry;

  modifier isOwner() {
    require (msg.sender == owner_address);
    _;
  }

  function OriginRegistryBase()
    public
  {
    // Defines origin admin address - may be removed for public deployment
    owner_address = msg.sender;
   }

  function registerContract(string contract_name, address registry_address)
    public
  {
    address_registry = OriginRegistry(registry_address);
    address_registry.registerContractAddress(contract_name, address(this));
  }

  function getContractAddress(string contract_name)
    view
    internal
    returns (address)
  {
    return address_registry.getContractAddress(contract_name);
  }

  function isValidContract(address contract_address)
    pure
    internal
    returns (bool)
  {
    return  contract_address != address(0);
  }
}
