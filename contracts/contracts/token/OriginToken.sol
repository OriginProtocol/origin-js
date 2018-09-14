pragma solidity ^0.4.24;

import "../../../node_modules/openzeppelin-solidity/contracts/token/ERC20/BurnableToken.sol";
import "../../../node_modules/openzeppelin-solidity/contracts/token/ERC20/MintableToken.sol";

import "./WhitelistedPausableToken.sol";

/**
 * @title Origin token
 * @dev Token that allows minting, burning, and pausing by contract owner
 */
contract OriginToken is BurnableToken, MintableToken, WhitelistedPausableToken {
  string public constant name = "OriginToken"; // solium-disable-line uppercase
  string public constant symbol = "OGN"; // solium-disable-line uppercase
  uint8 public constant decimals = 18; // solium-disable-line uppercase

  event AddCallSpenderWhitelist(address enabler, address spender);
  event RemoveCallSpenderWhitelist(address disabler, address spender);

  mapping (address => bool) public callSpenderWhitelist;

  // @dev Constructor that gives msg.sender all initial tokens.
  constructor(uint256 initialSupply) public {
    owner = msg.sender;
    mint(owner, initialSupply);
  }

  //
  // Burn methods
  //

  // @dev Burns tokens belonging to the sender
  // @param _value Amount of token to be burned
  function burn(uint256 _value) public onlyOwner {
    // TODO: add a function & modifier to enable for all accounts without doing
    // a contract migration?
    super.burn(_value);
  }

  // @dev Burns tokens belonging to the specified address
  // @param _who The account whose tokens we're burning
  // @param _value Amount of token to be burned
  function burn(address _who, uint256 _value) public onlyOwner {
    _burn(_who, _value);
  }

  // whitelist would contain addresses for all active marketplace contracts
  function addCallSpenderWhitelist(address _spender) public onlyOwner {
      callSpenderWhitelist[_spender] = true;
      emit AddCallSpenderWhitelist(msg.sender, _spender);
  }

  function removeCallSpenderWhitelist(address _spender) public onlyOwner {
      delete callSpenderWhitelist[_spender];
      emit RemoveCallSpenderWhitelist(msg.sender, _spender);
  }

  function approveAndCallWithSender(
        address _spender,
        uint256 _value,
        bytes4 selector,
        bytes call_params
    )
        public
        payable
        returns (bool)
    {
      require(_spender != address(this), "token contract can't be approved");
      require(callSpenderWhitelist[_spender], "sender not in whitelist");

      super.approve(_spender, _value);

      bytes memory call_data = abi.encodePacked(selector, uint256(msg.sender), call_params);
      require(_spender.call.value(msg.value)(call_data), "proxied call failed");
      return true;
    }
}
