pragma solidity 0.4.23;

import "../../eternalstorage/Initializable.sol";
import "./StandardToken.sol";

/**
 * @title Origin token
 * @dev This token is an ERC-20 compliant token that stores its state in an
 * EternalStorage contract.
 */
contract V000_OriginToken is V000_StandardToken, Initializable {
  string public constant name = "OriginToken"; // solium-disable-line uppercase
  string public constant symbol = "OGN"; // solium-disable-line uppercase
  uint8 public constant decimals = 18; // solium-disable-line uppercase
  uint256 public constant INITIAL_SUPPLY = 1e9 * (10 ** uint256(decimals));

  // @notice Trivial constructor.
  // @dev Does not mint initial tokens. That is done in initialize(), which
  // allows EternalStorage permissions to be granted between constructor() and
  // initialize().
  constructor(
    EternalStorage _es
  )
    public
    V000_StandardToken(_es)
    Initializable(_es, "token.initialized")
  {
    owner = msg.sender;
  }

  // @notice Perform initial minting and grant of tokens to contract owner.
  function initialize() public isInitializer {
    es.setUint(totalSupplyKey, INITIAL_SUPPLY);
    es.setUint(balanceOfKey(msg.sender), INITIAL_SUPPLY);
    emit Transfer(address(0), msg.sender, INITIAL_SUPPLY);
  }
}
