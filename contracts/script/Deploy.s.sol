// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Script } from "forge-std/Script.sol";
import { ShieldDropFactory } from "../src/ShieldDropFactory.sol";
import { ShieldDropFactoryProxy } from "../src/ShieldDropFactoryProxy.sol";

contract DeployShieldDrop is Script {
    address internal constant ZAMA_SEPOLIA_WRAPPERS_REGISTRY =
        0x2f0750Bbb0A246059d80e94c454586a7F27a128e;

    function run() external returns (ShieldDropFactory factory) {
        vm.startBroadcast();
        factory = new ShieldDropFactory(ZAMA_SEPOLIA_WRAPPERS_REGISTRY);
        vm.stopBroadcast();
    }
}

contract DeployShieldDropProxy is Script {
    address internal constant ZAMA_SEPOLIA_WRAPPERS_REGISTRY =
        0x2f0750Bbb0A246059d80e94c454586a7F27a128e;

    function run() external returns (ShieldDropFactory implementation, ShieldDropFactory proxy) {
        address owner = vm.envAddress("OWNER_ADDRESS");
        vm.startBroadcast();

        implementation = new ShieldDropFactory(ZAMA_SEPOLIA_WRAPPERS_REGISTRY);
        bytes memory initData = abi.encodeCall(
            ShieldDropFactory.initialize,
            (ZAMA_SEPOLIA_WRAPPERS_REGISTRY, owner)
        );
        ShieldDropFactoryProxy proxyContract =
            new ShieldDropFactoryProxy(address(implementation), initData);
        proxy = ShieldDropFactory(address(proxyContract));

        vm.stopBroadcast();
    }
}
