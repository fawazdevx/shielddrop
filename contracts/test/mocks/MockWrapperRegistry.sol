// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IWrapperRegistry} from "../../src/interfaces/IWrapperRegistry.sol";

/// @notice Mock wrapper registry that validates a configurable set of tokens.
contract MockWrapperRegistry is IWrapperRegistry {
    mapping(address => bool) private _validTokens;
    TokenWrapperPair[] private _pairs;

    function setTokenValid(address confidentialToken, bool valid) external {
        _validTokens[confidentialToken] = valid;
    }

    function addPair(address token, address confidentialToken, bool valid) external {
        _pairs.push(TokenWrapperPair({
            tokenAddress: token,
            confidentialTokenAddress: confidentialToken,
            isValid: valid
        }));
        _validTokens[confidentialToken] = valid;
    }

    function getConfidentialTokenAddress(address tokenAddress)
        external
        view
        returns (bool isValid, address confidentialToken)
    {
        for (uint256 i; i < _pairs.length; ++i) {
            if (_pairs[i].tokenAddress == tokenAddress) {
                return (_pairs[i].isValid, _pairs[i].confidentialTokenAddress);
            }
        }
        return (false, address(0));
    }

    function getTokenAddress(address confidentialWrapperAddress)
        external
        view
        returns (bool isValid, address token)
    {
        for (uint256 i; i < _pairs.length; ++i) {
            if (_pairs[i].confidentialTokenAddress == confidentialWrapperAddress) {
                return (_pairs[i].isValid, _pairs[i].tokenAddress);
            }
        }
        return (false, address(0));
    }

    function isConfidentialTokenValid(address confidentialWrapperAddress)
        external
        view
        returns (bool)
    {
        return _validTokens[confidentialWrapperAddress];
    }

    function getTokenConfidentialTokenPairsLength() external view returns (uint256) {
        return _pairs.length;
    }

    function getTokenConfidentialTokenPair(uint256 index)
        external
        view
        returns (TokenWrapperPair memory)
    {
        return _pairs[index];
    }
}
