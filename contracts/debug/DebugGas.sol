// SPDX-License-Identifier: MIT

pragma solidity ^0.8.21;

import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

contract DebugGas {
    uint256 private _s;

    // 21221 22149
    function run() public payable {
      // payable(msg.sender).call{value: msg.value}(""); // 30788 9567
      // payable(msg.sender).transfer(msg.value);        // 30589 9368

      // _s = 2;                                         // 46273 22149
      // _s = 3;                                         // 43370 1358
      // _s = 4;                                         // 45728 156
      // delete _s;                                      // 45884 389
    }
}