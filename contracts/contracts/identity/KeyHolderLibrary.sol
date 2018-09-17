pragma solidity ^0.4.24;

library KeyHolderLibrary {
  event KeyAdded(bytes32 indexed key, uint256 indexed purpose, uint256 indexed keyType);
  event KeyRemoved(bytes32 indexed key, uint256 indexed purpose, uint256 indexed keyType);
  event ExecutionRequested(uint256 indexed executionId, address indexed to, uint256 indexed value, bytes data);
  event ExecutionFailed(uint256 indexed executionId, address indexed to, uint256 indexed value, bytes data);
  event Executed(uint256 indexed executionId, address indexed to, uint256 indexed value, bytes data);
  event Approved(uint256 indexed executionId, bool approved);

  struct Key {
      uint256[] purposes; //e.g., MANAGEMENT_KEY = 1, ACTION_KEY = 2, etc.
      uint256 keyType; // e.g. 1 = ECDSA, 2 = RSA, etc.
      bytes32 key;
  }

  struct KeyHolderData {
      uint256 executionNonce;
      mapping (bytes32 => Key) keys;
      mapping (uint256 => bytes32[]) keysByPurpose;
      mapping (uint256 => Execution) executions;
  }

  struct Execution {
      address to;
      uint256 value;
      bytes data;
      bool approved;
      bool executed;
  }

  function init(KeyHolderData storage _keyHolderData)
      public
  {
      bytes32 _key = keccak256(abi.encodePacked(msg.sender));
      _keyHolderData.keys[_key].key = _key;
      _keyHolderData.keys[_key].purposes.push(1);
      _keyHolderData.keys[_key].keyType = 1;
      _keyHolderData.keysByPurpose[1].push(_key);
      emit KeyAdded(_key, 1, 1);
  }

  function getKey(KeyHolderData storage _keyHolderData, bytes32 _key)
      public
      view
      returns(uint256[] purposes, uint256 keyType, bytes32 key)
  {
      return (
          _keyHolderData.keys[_key].purposes,
          _keyHolderData.keys[_key].keyType,
          _keyHolderData.keys[_key].key
      );
  }

  function getKeyPurposes(KeyHolderData storage _keyHolderData, bytes32 _key)
      public
      view
      returns(uint256[] purposes)
  {
      return (_keyHolderData.keys[_key].purposes);
  }

  function getKeysByPurpose(KeyHolderData storage _keyHolderData, uint256 _purpose)
      public
      view
      returns(bytes32[] _keys)
  {
      return _keyHolderData.keysByPurpose[_purpose];
  }

  function addKey(KeyHolderData storage _keyHolderData, bytes32 _key, uint256 _purpose, uint256 _type)
      public
      returns (bool success)
  {
      require(_keyHolderData.keys[_key].key != _key, "Key already exists"); // Key should not already exist
      if (msg.sender != address(this)) {
        require(keyHasPurpose(_keyHolderData, keccak256(abi.encodePacked(msg.sender)), 1), "Sender does not have management key"); // Sender has MANAGEMENT_KEY
      }

      _keyHolderData.keys[_key].key = _key;
      _keyHolderData.keys[_key].purposes.push(_purpose);
      _keyHolderData.keys[_key].keyType = _type;

      _keyHolderData.keysByPurpose[_purpose].push(_key);

      emit KeyAdded(_key, _purpose, _type);

      return true;
  }

  function approve(KeyHolderData storage _keyHolderData, uint256 _id, bool _approve)
      public
      returns (bool success)
  {
      require(keyHasPurpose(_keyHolderData, keccak256(abi.encodePacked(msg.sender)), 2), "Sender does not have action key");
      require(!_keyHolderData.executions[_id].executed, "Already executed");

      emit Approved(_id, _approve);

      if (_approve == true) {
          _keyHolderData.executions[_id].approved = true;
          success = _keyHolderData.executions[_id].to.call(_keyHolderData.executions[_id].data, 0);
          if (success) {
              _keyHolderData.executions[_id].executed = true;
              emit Executed(
                  _id,
                  _keyHolderData.executions[_id].to,
                  _keyHolderData.executions[_id].value,
                  _keyHolderData.executions[_id].data
              );
              return;
          } else {
              emit ExecutionFailed(
                  _id,
                  _keyHolderData.executions[_id].to,
                  _keyHolderData.executions[_id].value,
                  _keyHolderData.executions[_id].data
              );
              return;
          }
      } else {
          _keyHolderData.executions[_id].approved = false;
      }
      return true;
  }

  function execute(KeyHolderData storage _keyHolderData, address _to, uint256 _value, bytes _data)
      public
      returns (uint256 executionId)
  {
      require(!_keyHolderData.executions[_keyHolderData.executionNonce].executed, "Already executed");
      _keyHolderData.executions[_keyHolderData.executionNonce].to = _to;
      _keyHolderData.executions[_keyHolderData.executionNonce].value = _value;
      _keyHolderData.executions[_keyHolderData.executionNonce].data = _data;

      emit ExecutionRequested(_keyHolderData.executionNonce, _to, _value, _data);

      if (keyHasPurpose(_keyHolderData, keccak256(abi.encodePacked(msg.sender)),1) || keyHasPurpose(_keyHolderData, keccak256(abi.encodePacked(msg.sender)),2)) {
          approve(_keyHolderData, _keyHolderData.executionNonce, true);
      }

      _keyHolderData.executionNonce++;
      return _keyHolderData.executionNonce-1;
  }

  function removeKey(KeyHolderData storage _keyHolderData, bytes32 _key, uint256 _purpose)
      public
      returns (bool success)
  {
      if (msg.sender != address(this)) {
        require(keyHasPurpose(_keyHolderData, keccak256(abi.encodePacked(msg.sender)), 1), "Sender does not have management key"); // Sender has MANAGEMENT_KEY
      }

      require(_keyHolderData.keys[_key].key == _key, "No such key");
      emit KeyRemoved(_key, _purpose, _keyHolderData.keys[_key].keyType);

      // Remove purpose from key
      uint256[] storage purposes = _keyHolderData.keys[_key].purposes;
      for (uint i = 0; i < purposes.length; i++) {
          if (purposes[i] == _purpose) {
              purposes[i] = purposes[purposes.length - 1];
              delete purposes[purposes.length - 1];
              purposes.length--;
              break;
          }
      }

      // If no more purposes, delete key
      if (purposes.length == 0) {
        delete _keyHolderData.keys[_key];
      }

      // Remove key from keysByPurpose
      bytes32[] storage keys = _keyHolderData.keysByPurpose[_purpose];
      for (uint j = 0; j < keys.length; j++) {
          if (keys[j] == _key) {
              keys[j] = keys[keys.length - 1];
              delete keys[keys.length - 1];
              keys.length--;
              break;
          }
      }

      return true;
  }

  function keyHasPurpose(KeyHolderData storage _keyHolderData, bytes32 _key, uint256 _purpose)
      public
      view
      returns(bool result)
  {
      bool isThere;
      if (_keyHolderData.keys[_key].key == 0) return false;

      uint256[] storage purposes = _keyHolderData.keys[_key].purposes;
      for (uint i = 0; i < purposes.length; i++) {
          if (purposes[i] <= _purpose) {
              isThere = true;
              break;
          }
      }
      return isThere;
  }
}
