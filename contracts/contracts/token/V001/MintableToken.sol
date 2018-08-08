pragma solidity ^0.4.23;

import "./StandardToken.sol";

contract V001_MintableToken is V001_StandardToken {
  //
  // Functions from OpenZeppelin's MintableToken to use EternalStorage
  //

  event Mint(address indexed to, uint256 amount);
  event MintFinished();

  // EternalStorage keys
  bytes32 constant mintingFinishedKey = keccak256("token.mintingfinished");

  modifier canMint() {
    require(!mintingFinished());
    _;
  }

  function mintingFinished() public view returns (bool) {
    return es.getBool(mintingFinishedKey);
  }

  modifier hasMintPermission() {
    require(msg.sender == owner);
    _;
  }

  /**
   * @dev Function to mint tokens
   * @param _to The address that will receive the minted tokens.
   * @param _amount The amount of tokens to mint.
   * @return A boolean that indicates if the operation was successful.
   */
  function mint(
    address _to,
    uint256 _amount
  )
    hasMintPermission
    canMint
    public
    returns (bool)
  {
    es.incrementUint(totalSupplyKey, _amount);
    es.incrementUint(balanceOfKey(_to), _amount);
    emit Mint(_to, _amount);
    emit Transfer(address(0), _to, _amount);
    return true;
  }

  /**
   * @dev Function to stop minting new tokens.
   * @return True if the operation was successful.
   */
  function finishMinting() onlyOwner canMint public returns (bool) {
    es.setBool(mintingFinishedKey, true);
    emit MintFinished();
    return true;
  }
}
