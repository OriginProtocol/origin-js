pragma solidity 0.4.23;

import './identity/ClaimHolderPresigned.sol';

/// @title UserRegistry
/// @dev Used to keep registry of user identifies
/// @author Matt Liu <matt@originprotocol.com>, Josh Fraser <josh@originprotocol.com>, Stan James <stan@originprotocol.com>

contract UserRegistry {
    /*
    * Events
    */

    event NewUser(address _address, address _identity);

    /*
    * Storage
    */

    // Mapping from ethereum wallet to ERC725 identity
    mapping(address => address) public users;

    /*
    * Public functions
    */

    /// @dev registerUser(): Add a user to the registry
    function registerUser(
      uint256[] _claimType,
      address[] _issuer,
      bytes _signature,
      bytes _data,
      uint256[] _offsets
    )
      public
    {
        ClaimHolderPresigned identity = ClaimHolderPresigned(
            msg.sender, // set the identity owner
            _claimType,
            _issuer,
            _signature,
            _data,
            _offsets
        );
        users[msg.sender] = identity;
        emit NewUser(msg.sender, identity);
    }

    /// @dev clearUser(): Remove user from the registry
    function clearUser()
      public
    {
        users[msg.sender] = 0;
    }
}
