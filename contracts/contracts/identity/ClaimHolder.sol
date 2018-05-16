pragma solidity ^0.4.23;

import './ERC735.sol';
import './KeyHolder.sol';
import "./ClaimHolderLibrary.sol";

contract ClaimHolder is KeyHolder, ERC735 {

    ClaimHolderLibrary.Claims claims;

    function addClaim(
        uint256 _claimType,
        uint256 _scheme,
        address _issuer,
        bytes _signature,
        bytes _data,
        string _uri
    )
        public
        returns (bytes32 claimRequestId)
    {
        KeyHolder issuer = KeyHolder(issuer);

        if (msg.sender != address(this)) {
          require(keyHasPurpose(keccak256(msg.sender), 3), "Sender does not have management key");
        }

        bytes32 claimId = ClaimHolderLibrary.add(
            claims,
            _claimType,
            _scheme,
            _issuer,
            _signature,
            _data,
            _uri
        );

        return claimId;
    }

    function addClaims(
        uint256[] _claimType,
        address[] _issuer,
        bytes _signature,
        bytes _data,
        uint256[] _offsets
    )
        public
    {
        ClaimHolderLibrary.addMultiple(
            claims,
            _claimType,
            _issuer,
            _signature,
            _data,
            _offsets
        );
    }

    function removeClaim(bytes32 _claimId) public returns (bool success) {
        if (msg.sender != address(this)) {
          require(keyHasPurpose(keccak256(msg.sender), 1), "Sender does not have management key");
        }

        ClaimHolderLibrary.remove(claims, _claimId);

        return true;
    }

    function getClaim(bytes32 _claimId)
        public
        constant
        returns(
            uint256 claimType,
            uint256 scheme,
            address issuer,
            bytes signature,
            bytes data,
            string uri
        )
    {
        return ClaimHolderLibrary.get(claims, _claimId);
    }

    function getClaimIdsByType(uint256 _claimType)
        public
        constant
        returns(bytes32[] claimIds)
    {
        return claims.byType[_claimType];
    }
}
