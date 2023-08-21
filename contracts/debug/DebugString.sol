// SPDX-License-Identifier: MIT

pragma solidity ^0.8.21;

contract DebugString {
  event StringToBytes(string from, bytes32 to);
  event BytesToString(bytes32 from, string to);

  function stringToBytesAssembly() external returns (bytes32 result) {
    string memory from = unicode"ABC강😆";
    assembly {
      result := mload(add(from, 0x20))
    }
    emit StringToBytes(from, result);
  }

  function stringToBytesABI() external returns (bytes32 result) {
    string memory from = unicode"ABC강😆";
    result = bytes32(abi.encodePacked(from));
    emit StringToBytes(from, result);
  }

  function bytesToStringAssembly() external returns (string memory result) {
    bytes32 from = unicode"ABC강😆";
    assembly {
      let m := mload(0x40)
      mstore(m, 0x20)
      mstore(add(m, 0x20), from) 
      mstore(0x40, add(m, 0x40))
      result := m
    }
    emit BytesToString(from, result);
  }

  function bytesToStringABI() external returns (string memory result) {
    bytes32 from = unicode"ABC강😆";
    result = string(abi.encodePacked(from));
    emit BytesToString(from, result);
  }

  function pureBytesToStringAssembly() public pure returns (string memory result) {
    bytes32 from = unicode"ABC강😆";
    assembly {
      let m := mload(0x40)
      mstore(m, 0x20)
      mstore(add(m, 0x20), from) 
      mstore(0x40, add(m, 0x40))
      result := m
    }
  }

  function pureBytesToStringABI() public pure returns (string memory result) {
    bytes32 from = unicode"ABC강😆";
    result = string(abi.encodePacked(from));
  }

  function pureUnicodeLength() public pure returns (uint256 result) {
    result = bytes(unicode"ABC강😆").length;
  }
}
