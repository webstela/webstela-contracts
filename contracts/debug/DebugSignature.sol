// SPDX-License-Identifier: MIT

pragma solidity ^0.8.21;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract DebugSignature {
  function signerOf(
    address to,
    bytes32 hashed,
    bytes32 on,
    address creator,
    uint256 price,
    uint256 discount,
    uint256 timeout,
    bytes calldata signature
  ) public pure returns (address) {
    bytes32 challenge = sha256(abi.encodePacked(hashed, on, creator, to, price, discount, timeout));
    return ECDSA.recover(
        keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", challenge)
        ),
        signature
    );
  }
}
