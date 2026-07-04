// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {FHEVMConfigStruct} from "@fhevm/solidity/lib/Impl.sol";
import {FHE} from "@fhevm/solidity/lib/FHE.sol";

import {MockFHEVMExecutor} from "./mocks/MockFHEVMExecutor.sol";
import {MockACL} from "./mocks/MockACL.sol";
import {MockERC7984Token} from "./mocks/MockERC7984Token.sol";
import {MockWrapperRegistry} from "./mocks/MockWrapperRegistry.sol";

/// @notice Base test contract that deploys and wires mock FHE infrastructure.
///         Inherits this to get a fully functional FHE test environment.
abstract contract FHEVMTestHelper is Test {
    // Zama Sepolia precompile addresses (must match FHEVMConfig.getSepoliaConfig)
    address internal constant ACL_ADDR = 0xFee8407e2f5e3Ee68ad77cAE98c434e637f516e5;
    address internal constant FHEVM_EXECUTOR_ADDR = 0x687408aB54661ba0b4aeF3a44156c616c6955E07;
    address internal constant KMS_VERIFIER_ADDR = 0x9D6891A6240D6130c54ae243d8005063D05fE14b;
    address internal constant INPUT_VERIFIER_ADDR = 0x3a2DA6f1daE9eF988B48d9CF27523FA31a8eBE50;

    MockFHEVMExecutor internal mockExecutor;
    MockACL internal mockACL;
    MockERC7984Token internal mockToken;
    MockWrapperRegistry internal mockRegistry;

    // Test accounts
    address internal creator;
    address internal operator;
    address internal recipient1;
    address internal recipient2;
    address internal stranger;

    function setUp() public virtual {
        // Deploy mocks
        mockExecutor = new MockFHEVMExecutor();
        mockACL = new MockACL();
        mockToken = new MockERC7984Token();
        mockRegistry = new MockWrapperRegistry();

        // Etch mock bytecode at the Sepolia precompile addresses
        vm.etch(ACL_ADDR, address(mockACL).code);
        vm.etch(FHEVM_EXECUTOR_ADDR, address(mockExecutor).code);
        vm.etch(INPUT_VERIFIER_ADDR, address(mockACL).code); // InputVerifier shares cleanTransientStorage

        // Label for trace readability
        vm.label(ACL_ADDR, "ACL");
        vm.label(FHEVM_EXECUTOR_ADDR, "FHEVMExecutor");
        vm.label(INPUT_VERIFIER_ADDR, "InputVerifier");
        vm.label(address(mockToken), "MockERC7984Token");
        vm.label(address(mockRegistry), "MockWrapperRegistry");

        // Register the mock token as valid in the registry
        mockRegistry.setTokenValid(address(mockToken), true);

        // Create test accounts
        creator = makeAddr("creator");
        operator = makeAddr("operator");
        recipient1 = makeAddr("recipient1");
        recipient2 = makeAddr("recipient2");
        stranger = makeAddr("stranger");

        // Fund test accounts
        vm.deal(creator, 100 ether);
        vm.deal(operator, 100 ether);
        vm.deal(recipient1, 100 ether);
        vm.deal(recipient2, 100 ether);
        vm.deal(stranger, 100 ether);
    }

    /// @notice Generates a fake external euint64 handle (mimics encrypted input from the SDK)
    function _fakeExternalHandle(uint256 seed) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("external-handle", seed));
    }

    /// @notice Generates fake input proof bytes (mimics the SDK's inputProof)
    function _fakeInputProof() internal pure returns (bytes memory) {
        return abi.encodePacked(bytes32(uint256(0xdeadbeef)));
    }

    /// @notice Returns claim timestamps: start = now, end = now + 30 days
    function _claimWindow() internal view returns (uint64 start, uint64 end_) {
        start = uint64(block.timestamp);
        end_ = start + 30 days;
    }
}
