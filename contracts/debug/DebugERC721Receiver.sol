// SPDX-License-Identifier: MIT

pragma solidity ^0.8.21;

import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

contract DebugERC721Receiver is IERC721Receiver {
    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata data
    ) external override pure returns (bytes4) {
        require(data.length < 2, "DebugERC721Receiver: reverted");
        return data.length == 0 ? this.onERC721Received.selector : bytes4("xxxx");
    }
}