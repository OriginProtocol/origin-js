pragma solidity 0.4.24;

contract V01_Escrow {
  address owner;
  uint256 amount;
  address recipient;

  constructor(address _recipient) public payable {
    owner = msg.sender;
    amount = msg.value;
    recipient = _recipient;
  }

  function release() public {
    require(msg.sender == owner);
    recipient.transfer(amount);
  }
}
