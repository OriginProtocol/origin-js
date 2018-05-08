pragma solidity ^0.4.21;

import '../../node_modules/openzeppelin-solidity/contracts/token/ERC20/StandardToken.sol';

contract OriginToken is StandardToken {
  string public name = 'OriginToken';
  string public symbol = 'OG';
  uint8 public decimals = 2;
  uint public INITIAL_SUPPLY = 12000;

  constructor() public {
    totalSupply_ = INITIAL_SUPPLY;
    balances[msg.sender] = INITIAL_SUPPLY;
  }

}
