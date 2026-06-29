// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract ShieldDropFactoryProxy {
    bytes32 private constant IMPLEMENTATION_SLOT =
        0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;

    error InvalidImplementation();
    error InitializationFailed();

    constructor(address implementation, bytes memory data) payable {
        if (implementation.code.length == 0) revert InvalidImplementation();

        bytes32 slot = IMPLEMENTATION_SLOT;
        assembly {
            sstore(slot, implementation)
        }

        if (data.length > 0) {
            (bool ok,) = implementation.delegatecall(data);
            if (!ok) revert InitializationFailed();
        }
    }

    fallback() external payable {
        _delegate();
    }

    receive() external payable {
        _delegate();
    }

    function _delegate() private {
        bytes32 slot = IMPLEMENTATION_SLOT;
        assembly {
            let implementation := sload(slot)
            calldatacopy(0, 0, calldatasize())
            let result := delegatecall(gas(), implementation, 0, calldatasize(), 0, 0)
            returndatacopy(0, 0, returndatasize())
            switch result
            case 0 { revert(0, returndatasize()) }
            default { return(0, returndatasize()) }
        }
    }
}
