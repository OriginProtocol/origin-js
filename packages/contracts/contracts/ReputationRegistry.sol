pragma solidity ^0.4.21;

import "./OriginRegistry.sol";
import "./ListingsRegistry.sol";

contract ReputationRegistry is OriginRegistryBase {
  mapping (address => int256) balances;

  modifier isAllowed() {
    require (msg.sender == owner_address || ListingsRegistry(msg.sender).owner_address() == owner_address);
    _;
  }

  function ReputationRegistry()
    public
  {
      owner_address = msg.sender;
  }    
 
  function upRep(address user, uint amount)
    isAllowed
    public
  {  
    balances[user] += int(amount);
  }

  function downRep(address user, int amount)
    isAllowed
    public
  {
    balances[user] -= int(amount);
  }

  function getRep(address user)
    public
    view
    returns (int256)
  {
    return balances[user];
  }
}
