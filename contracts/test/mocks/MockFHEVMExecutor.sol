// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FheType} from "@fhevm/solidity/lib/FheType.sol";

/// @notice Mock FHEVMExecutor that returns deterministic handles for FHE operations.
///         Used in Foundry tests to bypass the real Zama coprocessor.
contract MockFHEVMExecutor {
    uint256 private _handleCounter;

    function verifyCiphertext(
        bytes32 inputHandle,
        address, /* callerAddress */
        bytes memory, /* inputProof */
        FheType /* inputType */
    ) external returns (bytes32 result) {
        // Return a deterministic non-zero handle derived from the input
        result = keccak256(abi.encodePacked(inputHandle, ++_handleCounter));
    }

    function trivialEncrypt(uint256, /* ct */ FheType /* toType */ ) external returns (bytes32 result) {
        result = keccak256(abi.encodePacked("encrypt", ++_handleCounter));
    }

    function trivialEncrypt(bytes memory, /* ct */ FheType /* toType */ ) external returns (bytes32 result) {
        result = keccak256(abi.encodePacked("encrypt-bytes", ++_handleCounter));
    }

    // Stubs for other IFHEVMExecutor functions (unused by ShieldDrop but needed for interface)
    function fheAdd(bytes32 lhs, bytes32, bytes1) external pure returns (bytes32) { return lhs; }
    function fheSub(bytes32 lhs, bytes32, bytes1) external pure returns (bytes32) { return lhs; }
    function fheMul(bytes32 lhs, bytes32, bytes1) external pure returns (bytes32) { return lhs; }
    function fheDiv(bytes32 lhs, bytes32, bytes1) external pure returns (bytes32) { return lhs; }
    function fheRem(bytes32 lhs, bytes32, bytes1) external pure returns (bytes32) { return lhs; }
    function fheBitAnd(bytes32 lhs, bytes32, bytes1) external pure returns (bytes32) { return lhs; }
    function fheBitOr(bytes32 lhs, bytes32, bytes1) external pure returns (bytes32) { return lhs; }
    function fheBitXor(bytes32 lhs, bytes32, bytes1) external pure returns (bytes32) { return lhs; }
    function fheShl(bytes32 lhs, bytes32, bytes1) external pure returns (bytes32) { return lhs; }
    function fheShr(bytes32 lhs, bytes32, bytes1) external pure returns (bytes32) { return lhs; }
    function fheRotl(bytes32 lhs, bytes32, bytes1) external pure returns (bytes32) { return lhs; }
    function fheRotr(bytes32 lhs, bytes32, bytes1) external pure returns (bytes32) { return lhs; }
    function fheEq(bytes32 lhs, bytes32, bytes1) external pure returns (bytes32) { return lhs; }
    function fheEq(bytes32 lhs, bytes memory, bytes1) external pure returns (bytes32) { return lhs; }
    function fheNe(bytes32 lhs, bytes32, bytes1) external pure returns (bytes32) { return lhs; }
    function fheNe(bytes32 lhs, bytes memory, bytes1) external pure returns (bytes32) { return lhs; }
    function fheGe(bytes32 lhs, bytes32, bytes1) external pure returns (bytes32) { return lhs; }
    function fheGt(bytes32 lhs, bytes32, bytes1) external pure returns (bytes32) { return lhs; }
    function fheLe(bytes32 lhs, bytes32, bytes1) external pure returns (bytes32) { return lhs; }
    function fheLt(bytes32 lhs, bytes32, bytes1) external pure returns (bytes32) { return lhs; }
    function fheMin(bytes32 lhs, bytes32, bytes1) external pure returns (bytes32) { return lhs; }
    function fheMax(bytes32 lhs, bytes32, bytes1) external pure returns (bytes32) { return lhs; }
    function fheNeg(bytes32 ct) external pure returns (bytes32) { return ct; }
    function fheNot(bytes32 ct) external pure returns (bytes32) { return ct; }
    function fheIfThenElse(bytes32, bytes32 ifTrue, bytes32) external pure returns (bytes32) { return ifTrue; }
    function fheRand(FheType) external returns (bytes32) { return keccak256(abi.encodePacked("rand", ++_handleCounter)); }
    function fheRandBounded(uint256, FheType) external returns (bytes32) { return keccak256(abi.encodePacked("rand-b", ++_handleCounter)); }
    function cast(bytes32 ct, FheType) external pure returns (bytes32) { return ct; }
}
