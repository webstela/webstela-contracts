// SPDX-License-Identifier: MIT

pragma solidity ^0.8.21;

contract DebugLogic {
  string public name = "foo";
  string _name = "impl";

  function setName(string calldata newName) public {
    name = newName;
  }

  function myName() public view returns (string memory) {
    return _name;
  }
}

contract DebugProxy {
  string public name = "bar";
  string _name = "proxy";
  address _impl;

  constructor(address logic) {
    _impl = logic;
  }

  function myName() public view returns (string memory) {
    return _name;
  }

  function setNameByImpl() public {
    (bool ok, bytes memory res) = _impl.delegatecall(abi.encodePacked(this.myName.selector));
    require(ok);
    name = abi.decode(res, (string));
  }

  function setName(string calldata newName) public {
    require(bytes(newName).length != 0);
    address implementation = _impl;

    assembly {
      // (1) copy incoming call data
      calldatacopy(0, 0, calldatasize())

      // (2) forward call to logic contract
      let result := delegatecall(gas(), implementation, 0, calldatasize(), 0, 0)

      // (3) retrieve return data
      returndatacopy(0, 0, returndatasize())

      // (4) forward return data back to caller
      switch result
      case 0 {
          revert(0, returndatasize())
      }
      default {
          return(0, returndatasize())
      }
    }
  }
}