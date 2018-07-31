pragma solidity ^0.4.23;


import "../eternalstorage/ESPausable.sol";
import "../eternalstorage/EternalStorage.sol";
import "../../../node_modules/openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "../../../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";
import "../../../node_modules/openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";

/**
 * @title ERC-20 compliant token using external EternalStorage contract
 * @notice Based on OpenZeppelin's ERC-20 contracts, this token provides
 * features not specified by ERC-20, such as minting, burning, and pausing of
 * tokens.
 * @dev All storage, except the owner of the contract, is stored in an external
 * EternalStorage contract, providing upgradability of the token contract logic.
 * When applicable, functions and state are grouped according to the
 * OpenZeppelin token contract upon which they are based. This eases the porting
 * of fixes from OpenZeppelin to this code.
 */
contract ESToken is ERC20, ESPausable {
  using SafeMath for uint256;

  constructor(EternalStorage es_) public ESPausable(es_) { }

  //
  // Ported from OpenZeppelin's BasicToken to use EternalStorage
  //

  // Keys for EternalStorage
  bytes32 public constant totalSupplyKey = keccak256("token.totalSupply");
  function balanceOfKey(address _owner) public pure returns (bytes32) {
    return keccak256(abi.encodePacked("token.balances.", _owner));
  }
  bytes32 internal constant initializedKey = keccak256("token.initialized");

  /**
  * @dev total number of tokens in existence
  */
  function totalSupply() public view returns (uint256) {
    return es.getUint(totalSupplyKey);
  }

  /**
  * @dev transfer token for a specified address
  * @param _to The address to transfer to.
  * @param _value The amount to be transferred.
  */
  function transfer(
    address _to,
    uint256 _value
  )
    public
    whenNotPaused
    returns (bool)
  {
    require(_to != address(0));

    bytes32 senderBalanceKey = balanceOfKey(msg.sender);
    bytes32 toBalanceKey = balanceOfKey(_to);
    uint senderBalance = es.getUint(senderBalanceKey);

    require(_value <= senderBalance);

    es.decrementUint(senderBalanceKey, _value);
    es.incrementUint(toBalanceKey, _value);
    emit Transfer(msg.sender, _to, _value);
    return true;
  }

  /**
  * @dev Gets the balance of the specified address.
  * @param _owner The address to query the the balance of.
  * @return An uint256 representing the amount owned by the passed address.
  */
  function balanceOf(address _owner) public view returns (uint256) {
    // was: return balances[_owner];
    return es.getUint(balanceOfKey(_owner));
  }

  //
  // Ported from OpenZeppelin's StandardToken to use EternalStorage
  //

  function allowedKey(
    address _from,
    address _to
  )
    public
    pure
    returns (bytes32)
  {
    return keccak256(abi.encodePacked("token.allowed",_from, _to));
  }

  function allowed(address _from, address _to) internal view returns (uint256) {
    return es.getUint(allowedKey(_from, _to));
  }

  /**
   * @dev Transfer tokens from one address to another
   * @param _from address The address which you want to send tokens from
   * @param _to address The address which you want to transfer to
   * @param _value uint256 the amount of tokens to be transferred
   */
  function transferFrom(
    address _from,
    address _to,
    uint256 _value
  )
    public
    whenNotPaused
    returns (bool)
  {
    require(_to != address(0));
    require(_value <= balanceOf(_from));
    require(_value <= allowed(_from, msg.sender));

    es.decrementUint(balanceOfKey(_from), _value);
    es.incrementUint(balanceOfKey(_to), _value);
    es.decrementUint(allowedKey(_from, msg.sender), _value);
    emit Transfer(_from, _to, _value);
    return true;
  }

  /**
   * @dev Approve the passed address to spend the specified amount of tokens on behalf of msg.sender.
   *
   * Beware that changing an allowance with this method brings the risk that someone may use both the old
   * and the new allowance by unfortunate transaction ordering. One possible solution to mitigate this
   * race condition is to first reduce the spender's allowance to 0 and set the desired value afterwards:
   * https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729
   * @param _spender The address which will spend the funds.
   * @param _value The amount of tokens to be spent.
   */
  function approve(
    address _spender,
    uint256 _value
  )
    public
    whenNotPaused
    returns (bool)
  {
    // was: allowed[msg.sender][_spender] = _value;
    es.setUint(allowedKey(msg.sender, _spender), _value);
    emit Approval(msg.sender, _spender, _value);
    return true;
  }

  /**
   * @dev Function to check the amount of tokens that an owner allowed to a spender.
   * @param _owner address The address which owns the funds.
   * @param _spender address The address which will spend the funds.
   * @return A uint256 specifying the amount of tokens still available for the spender.
   */
  function allowance(
    address _owner,
    address _spender
   )
    public
    view
    returns (uint256)
  {
    // was: return allowed[_owner][_spender];
    return es.getUint(allowedKey(_owner, _spender));
  }

  /**
   * @dev Increase the amount of tokens that an owner allowed to a spender.
   *
   * approve should be called when allowed[_spender] == 0. To increment
   * allowed value is better to use this function to avoid 2 calls (and wait until
   * the first transaction is mined)
   * From MonolithDAO Token.sol
   * @param _spender The address which will spend the funds.
   * @param _addedValue The amount of tokens to increase the allowance by.
   */
  function increaseApproval(
    address _spender,
    uint _addedValue
  )
    public
    whenNotPaused
    returns (bool)
  {
    bytes32 spenderAllowedKey = allowedKey(msg.sender, _spender);
    uint256 newAllowed = es.incrementUint(spenderAllowedKey, _addedValue);
    emit Approval(msg.sender, _spender, newAllowed);
    return true;
  }

  /**
   * @dev Decrease the amount of tokens that an owner allowed to a spender.
   *
   * approve should be called when allowed[_spender] == 0. To decrement
   * allowed value is better to use this function to avoid 2 calls (and wait until
   * the first transaction is mined)
   * From MonolithDAO Token.sol
   * @param _spender The address which will spend the funds.
   * @param _subtractedValue The amount of tokens to decrease the allowance by.
   */
  function decreaseApproval(
    address _spender,
    uint _subtractedValue
  )
    public
    whenNotPaused
    returns (bool)
  {
    bytes32 spenderAllowedKey = allowedKey(msg.sender, _spender);
    uint oldValue = allowed(msg.sender, _spender);
    uint newValue = 0;
    if (_subtractedValue > oldValue) {
      es.setUint(spenderAllowedKey, 0);
    } else {
      newValue = es.decrementUint(spenderAllowedKey, _subtractedValue);
    }
    emit Approval(msg.sender, _spender, newValue);
    return true;
  }

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
