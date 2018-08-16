pragma solidity ^0.4.23;

import "./StandardToken.sol";

contract V001_BurnableToken is V001_StandardToken {
  //
  // Ported from OpenZeppelin's BurnableToken to use EternalStorage
  //

  event Burn(address indexed burner, uint256 value);

  /**
   * @dev Burns a specific amount of tokens.
   * @param _value The amount of token to be burned.
   */
  function burn(uint256 _value) public {
    _burn(msg.sender, _value);
  }

  function _burn(address _who, uint256 _value) internal {
    // TODO: limit to owner?
    require(_value <= balanceOf(_who));
    // no need to require value <= totalSupply, since that would imply the
    // sender's balance is greater than the totalSupply, which *should* be an assertion failure

    es.decrementUint(totalSupplyKey, _value);
    es.decrementUint(balanceOfKey(_who), _value);
    emit Burn(_who, _value);
    emit Transfer(_who, address(0), _value);
  }

  //
  // Ported from OpenZeppelin's StandardBurnableToken to use EternalStorage
  //

  /**
   * @dev Burns a specific amount of tokens from the target address and decrements allowance
   * @param _from address The address which you want to send tokens from
   * @param _value uint256 The amount of token to be burned
   */
  function burnFrom(address _from, uint256 _value) public {
    // was: require(_value <= allowed[_from][msg.sender]);
    require(_value <= es.getUint(allowedKey(_from, msg.sender)));
    // Should https://github.com/OpenZeppelin/zeppelin-solidity/issues/707 be accepted,
    // this function needs to emit an event with the updated approval.
    // was: allowed[_from][msg.sender] = allowed[_from][msg.sender].sub(_value);
    es.decrementUint(allowedKey(_from, msg.sender), _value);
    _burn(_from, _value);
  }
}
