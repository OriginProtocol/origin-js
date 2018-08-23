pragma solidity ^0.4.23;

import "./OriginToken.sol";

// not meant to merged; for use with Remix, just a very basic set of tests
// DO NOT MERGE
contract TestWhitelistedPausableToken {
  uint256 constant initialSupply = 1000;
  uint256 constant transferAmount = 1;
  address constant other = address(1);
  
  event Debug(uint256 d);
    
  function testTransferWithoutWhitelist() public {
    OriginToken token = new OriginToken(initialSupply);
    require(token.transfer(other, transferAmount), "transfer failed");
    require(token.balanceOf(this) == initialSupply - transferAmount,
        "sender balance mismatch");
    require(token.balanceOf(other) == transferAmount, "other balance mismatch");
  }
  
  function testTransferAllowedRecipient() public {
    OriginToken token = new OriginToken(initialSupply);
    token.setWhitelistExpiration(block.timestamp + 1 days);
    token.addAllowedRecipient(other);
    
    require(token.transfer(other, transferAmount), "transfer failed");
    require(token.balanceOf(this) == initialSupply - transferAmount,
        "sender balance mismatch");
    require(token.balanceOf(other) == transferAmount, "other balance mismatch");
  }
  
  function testTransferAllowedSender() public {
    OriginToken token = new OriginToken(initialSupply);
    token.setWhitelistExpiration(block.timestamp + 1 days);
    token.addAllowedSender(this);
    
    require(token.transfer(other, transferAmount), "transfer failed");
    require(token.balanceOf(this) == initialSupply - transferAmount,
        "sender balance mismatch");
    require(token.balanceOf(other) == transferAmount, "other balance mismatch");
  }
  
  function testFailsTransferNonAllowedSender() public {
    OriginToken token = new OriginToken(initialSupply);
    token.setWhitelistExpiration(block.timestamp + 1 days);
    token.addAllowedSender(other);
    // This will fail
    token.transfer(other, transferAmount);
  }
}
// DO NOT MERGE