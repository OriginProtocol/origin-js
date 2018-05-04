pragma solidity ^0.4.21;

import '../../node_modules/zeppelin-solidity/contracts/token/ERC20/StandardToken.sol';

contract TutorialToken is StandardToken {
  string public name = 'TutorialToken';
  string public symbol = 'TT';
  uint8 public decimals = 2;
  uint public INITIAL_SUPPLY = 13000;

  function TutorialToken() public {
    totalSupply_ = INITIAL_SUPPLY;
    balances[msg.sender] = INITIAL_SUPPLY;
  }

}
