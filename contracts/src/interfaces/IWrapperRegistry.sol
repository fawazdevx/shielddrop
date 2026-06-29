// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IWrapperRegistry {
    struct TokenWrapperPair {
        address tokenAddress;
        address confidentialTokenAddress;
        bool isValid;
    }

    function getConfidentialTokenAddress(address tokenAddress)
        external
        view
        returns (bool isValid, address confidentialToken);

    function getTokenAddress(address confidentialWrapperAddress)
        external
        view
        returns (bool isValid, address token);

    function isConfidentialTokenValid(address confidentialWrapperAddress) external view returns (bool);

    function getTokenConfidentialTokenPairsLength() external view returns (uint256);

    function getTokenConfidentialTokenPair(uint256 index) external view returns (TokenWrapperPair memory);
}
