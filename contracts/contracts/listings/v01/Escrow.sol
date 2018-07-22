pragma solidity 0.4.24;

contract V01_Escrow {
  address owner;
  uint256 amount;
  address sender;
  address recipient;

  constructor(address _sender, address _recipient) public payable {
    owner = msg.sender;
    amount = msg.value;
    sender = _sender;
    recipient = _recipient;
  }

  function cancel() public {
    require(msg.sender == owner);
    sender.transfer(amount);
  }

  function complete() public {
    require(msg.sender == owner);
    recipient.transfer(amount);
  }
}
