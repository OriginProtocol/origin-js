pragma solidity ^0.4.24;

import "../../../node_modules/openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "../../../node_modules/openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "./OriginToken.sol";


/**
 * @title Migrates balances from one token contract to another
 * @dev Migrates all balances from one token contract to another. Both contracts
 * must be pausable (to prevent changes during migration), and the target
 * contract must support minting tokens.
 */
contract TokenMigration is Ownable {
    OriginToken public fromToken;
    OriginToken public toToken;
    mapping (address => bool) public migrated;
    bool public finished;

    event Migrated(address indexed account, uint256 balance);
    event MigrationFinished();

    modifier notFinished() {
        require(!finished, "migration already finished");
        _;
    }

    // @dev Public constructor
    constructor(OriginToken _fromToken, OriginToken _toToken) public {
        owner = msg.sender;
        fromToken = _fromToken;
        toToken = _toToken;
    }

    // @dev Migrates a set of accounts, which should be limited in size so that
    // the transaction is under the gas limit.
    function migrateAccounts(address[] _holders) public onlyOwner notFinished {
        for (uint i = 0; i < _holders.length; i++) {
            migrateAccount(_holders[i]);
        }
    }

    // @dev Migrates the balance for a single address by minting the same number
    // of new tokens the address had with the old token.
    function migrateAccount(address _holder) public onlyOwner notFinished {
        require(!migrated[_holder], "holder already migrated");
        uint256 balance = fromToken.balanceOf(_holder);
        if (balance > 0) {
            toToken.mint(_holder, balance);
            migrated[_holder] = true;
            emit Migrated(_holder, balance);
        }
    }

    // @dev Finishes migration and transfers token ownership to new owner.
    function finish(address _newTokenOwner) public onlyOwner notFinished {
        require(
            fromToken.totalSupply() == toToken.totalSupply(),
            "total token supplies do not match"
        );
        require(
            _newTokenOwner != address(this),
            "this contract cannot own the token contract"
        );
        finished = true;
        toToken.transferOwnership(_newTokenOwner);
        emit MigrationFinished();
    }

    // TODO: revisit whether we want to migrate approvals
}
