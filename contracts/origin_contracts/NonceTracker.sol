pragma solidity 0.4.23;

contract NonceTracker {
  mapping (address => mapping(address=> uint)) nonces;

  function getNextNonce(address _contract, address _sender) view public returns (uint) 
  {
    return nonces[_contract][_sender] + 1;
  }

  function setNonce(address _sender, uint _nonce) public returns (bool) 
  {
    //make sure this has to be next in the sequence
    if(nonces[msg.sender][_sender] + 1 == _nonce)
      {
        nonces[msg.sender][_sender] = _nonce;
        return true;
      }
    else
      {
        return false;
      }
  }
}
