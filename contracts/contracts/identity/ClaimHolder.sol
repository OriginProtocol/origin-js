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

        emit ClaimAdded(
            claimId,
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
        uint offset = 0;
        for (uint8 i = 0; i < _claimType.length; i++) {
            addClaim(
              _claimType[i],
              1,
              _issuer[i],
              ClaimHolderLibrary.getBytes(_signature, (i * 65), 65),
              ClaimHolderLibrary.getBytes(_data, offset, _offsets[i]),
              ""
            );
            offset += _offsets[i];
        }
    }

    function removeClaim(bytes32 _claimId) public returns (bool success) {
        if (msg.sender != address(this)) {
          require(keyHasPurpose(keccak256(msg.sender), 1), "Sender does not have management key");
        }

        /* uint index; */
        /* (index, ) = claimsByType[claims[_claimId].claimType].indexOf(_claimId);
        claimsByType[claims[_claimId].claimType].removeByIndex(index); */

        emit ClaimRemoved(
            _claimId,
            claims.byId[_claimId].claimType,
            claims.byId[_claimId].scheme,
            claims.byId[_claimId].issuer,
            claims.byId[_claimId].signature,
            claims.byId[_claimId].data,
            claims.byId[_claimId].uri
        );

        delete claims.byId[_claimId];
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
