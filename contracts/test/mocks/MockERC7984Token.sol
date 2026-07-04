// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";

/// @notice Mock ERC-7984 confidential token for testing claim transfers.
contract MockERC7984Token {
    uint8 public decimals = 6;

    mapping(address => mapping(address => bool)) private _operators;
    mapping(address => uint256) public transferCount;

    event ConfidentialTransfer(address indexed to, bytes32 encryptedAmount);

    function confidentialTransfer(address to, euint64 encryptedAmount)
        external
        returns (euint64)
    {
        transferCount[to] += 1;
        emit ConfidentialTransfer(to, euint64.unwrap(encryptedAmount));
        return encryptedAmount;
    }

    function confidentialTransfer(address to, externalEuint64 encryptedAmount, bytes calldata)
        external
        returns (euint64)
    {
        transferCount[to] += 1;
        euint64 result = euint64.wrap(externalEuint64.unwrap(encryptedAmount));
        emit ConfidentialTransfer(to, euint64.unwrap(result));
        return result;
    }

    function confidentialTransferFrom(address, address to, euint64 encryptedAmount)
        external
        returns (euint64)
    {
        transferCount[to] += 1;
        return encryptedAmount;
    }

    function confidentialTransferFrom(
        address,
        address to,
        externalEuint64 encryptedAmount,
        bytes calldata
    ) external returns (euint64) {
        transferCount[to] += 1;
        return euint64.wrap(externalEuint64.unwrap(encryptedAmount));
    }

    function setOperator(address operator, uint48) external returns (bool) {
        _operators[msg.sender][operator] = true;
        return true;
    }

    function isOperator(address holder, address spender) external view returns (bool) {
        return _operators[holder][spender];
    }
}
