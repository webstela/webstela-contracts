// SPDX-License-Identifier: MIT

pragma solidity ^0.8.21;

import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

contract DebugCallable {
    address private _addr;

    event Called(string fn, address sender, uint256 value, bytes data);

    function addr() public view returns (address) {
      return _addr;
    }

    function pay(address arg) public payable returns (address) {
        emit Called("pay", msg.sender, msg.value, msg.data);

        _addr = arg;
        return _addr;
    }

    fallback() external payable {
        emit Called("fallback", msg.sender, msg.value, msg.data);
    }
    receive() external payable {
        emit Called("receive", msg.sender, msg.value, "");
    }
}