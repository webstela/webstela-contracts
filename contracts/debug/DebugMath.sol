// SPDX-License-Identifier: MIT

pragma solidity ^0.8.21;

contract DebugMath {
  uint8 public max = 255;
  uint8 public min = 0;

  function underflow() public {
    min = min - 1;
  }

  function overflowByAdd() public {
    max = max + 1;
  }

  function overflowByMul() public {
    max = max * 2;
  }

  function divideByZero() public {
    max = max / min;
  }
}
