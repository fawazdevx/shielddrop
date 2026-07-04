// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Mock ACL contract that permits all handle operations unconditionally.
///         In production, Zama's ACL enforces access control on encrypted handles.
contract MockACL {
    mapping(bytes32 => mapping(address => bool)) private _allowed;

    function allowTransient(bytes32, address) external pure {
        // Always permitted in tests
    }

    function allow(bytes32 handle, address account) external {
        _allowed[handle][account] = true;
    }

    function cleanTransientStorage() external pure {}

    function isAllowed(bytes32 handle, address account) external view returns (bool) {
        return _allowed[handle][account];
    }

    function allowForDecryption(bytes32[] memory) external pure {}

    function isAllowedForDecryption(bytes32) external pure returns (bool) {
        return true;
    }
}
