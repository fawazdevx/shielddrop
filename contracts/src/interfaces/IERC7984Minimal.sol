// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { euint64, externalEuint64 } from "@fhevm/solidity/lib/FHE.sol";

interface IERC7984Minimal {
    function confidentialTransfer(address to, euint64 encryptedAmount) external returns (euint64 transferred);

    function confidentialTransfer(address to, externalEuint64 encryptedAmount, bytes calldata inputProof)
        external
        returns (euint64 transferred);

    function confidentialTransferFrom(address from, address to, euint64 encryptedAmount)
        external
        returns (euint64 transferred);

    function confidentialTransferFrom(address from, address to, externalEuint64 encryptedAmount, bytes calldata inputProof)
        external
        returns (euint64 transferred);

    function setOperator(address operator, uint48 until) external returns (bool);

    function isOperator(address holder, address spender) external view returns (bool);

    function decimals() external view returns (uint8);
}
