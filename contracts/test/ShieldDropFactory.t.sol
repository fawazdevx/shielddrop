// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHEVMTestHelper} from "./FHEVMTestHelper.sol";
import {ShieldDropFactory} from "../src/ShieldDropFactory.sol";
import {ShieldDropCampaign} from "../src/ShieldDropCampaign.sol";

contract ShieldDropFactoryTest is FHEVMTestHelper {
    ShieldDropFactory internal factory;
    address internal owner;

    function setUp() public override {
        super.setUp();
        owner = makeAddr("factoryOwner");

        factory = new ShieldDropFactory(address(mockRegistry));
        // Transfer ownership if needed (constructor sets msg.sender as owner)
        vm.label(address(factory), "ShieldDropFactory");
    }

    // ──────────────────────────────────────────────────
    //  Initialization
    // ──────────────────────────────────────────────────

    function test_constructor_setsOwnerAndRegistry() public view {
        assertEq(factory.owner(), address(this)); // msg.sender in test
        assertEq(address(factory.registry()), address(mockRegistry));
    }

    function test_initialize_revertsOnDoubleInit() public {
        vm.expectRevert(ShieldDropFactory.AlreadyInitialized.selector);
        factory.initialize(address(mockRegistry), owner);
    }

    // ──────────────────────────────────────────────────
    //  createCampaign
    // ──────────────────────────────────────────────────

    function test_createCampaign_happyPath() public {
        (uint64 start, uint64 end_) = _claimWindow();

        vm.prank(creator);
        address campaign = factory.createCampaign(
            address(mockToken),
            "ipfs://test",
            start,
            end_,
            operator
        );

        assertTrue(campaign != address(0));
        assertEq(factory.allCampaignsLength(), 1);
        assertEq(factory.allCampaigns(0), campaign);
        assertEq(factory.creatorCampaignsLength(creator), 1);
        assertEq(factory.creatorCampaign(creator, 0), campaign);
    }

    function test_createCampaign_emitsEvent() public {
        (uint64 start, uint64 end_) = _claimWindow();

        vm.prank(creator);
        vm.expectEmit(true, false, true, true);
        emit ShieldDropFactory.CampaignCreated(creator, address(0), address(mockToken), "ipfs://test");
        factory.createCampaign(address(mockToken), "ipfs://test", start, end_, operator);
    }

    function test_createCampaign_revertsOnInvalidToken() public {
        address invalidToken = makeAddr("invalidToken");
        // Not registered in mockRegistry, so isConfidentialTokenValid returns false

        (uint64 start, uint64 end_) = _claimWindow();

        vm.prank(creator);
        vm.expectRevert(ShieldDropFactory.InvalidConfidentialToken.selector);
        factory.createCampaign(invalidToken, "ipfs://test", start, end_, operator);
    }

    function test_createCampaign_revertsOnInvalidClaimWindow() public {
        vm.prank(creator);
        vm.expectRevert(ShieldDropFactory.InvalidClaimWindow.selector);
        factory.createCampaign(address(mockToken), "ipfs://test", 100, 50, operator);
    }

    function test_createCampaign_multiple() public {
        (uint64 start, uint64 end_) = _claimWindow();

        vm.prank(creator);
        factory.createCampaign(address(mockToken), "ipfs://1", start, end_, operator);

        vm.prank(creator);
        factory.createCampaign(address(mockToken), "ipfs://2", start, end_, operator);

        vm.prank(stranger);
        factory.createCampaign(address(mockToken), "ipfs://3", start, end_, operator);

        assertEq(factory.allCampaignsLength(), 3);
        assertEq(factory.creatorCampaignsLength(creator), 2);
        assertEq(factory.creatorCampaignsLength(stranger), 1);
    }

    // ──────────────────────────────────────────────────
    //  Campaign reads
    // ──────────────────────────────────────────────────

    function test_campaignReads_returnCorrectData() public {
        (uint64 start, uint64 end_) = _claimWindow();

        vm.prank(creator);
        address campaign1 = factory.createCampaign(address(mockToken), "ipfs://a", start, end_, operator);

        vm.prank(stranger);
        address campaign2 = factory.createCampaign(address(mockToken), "ipfs://b", start, end_, operator);

        assertEq(factory.allCampaigns(0), campaign1);
        assertEq(factory.allCampaigns(1), campaign2);
        assertEq(factory.creatorCampaign(creator, 0), campaign1);
        assertEq(factory.creatorCampaign(stranger, 0), campaign2);
    }

    // ──────────────────────────────────────────────────
    //  UUPS upgrade
    // ──────────────────────────────────────────────────

    function test_proxiableUUID_returnsERC1967Slot() public view {
        bytes32 expectedSlot = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;
        assertEq(factory.proxiableUUID(), expectedSlot);
    }

    function test_upgradeTo_revertsForNonOwner() public {
        address newImpl = makeAddr("newImpl");
        vm.etch(newImpl, address(factory).code); // Give it code

        vm.prank(stranger);
        vm.expectRevert(ShieldDropFactory.NotOwner.selector);
        factory.upgradeTo(newImpl);
    }

    function test_upgradeTo_revertsForEOA() public {
        address eoa = makeAddr("eoaImpl");

        vm.prank(address(this));
        vm.expectRevert(ShieldDropFactory.InvalidImplementation.selector);
        factory.upgradeTo(eoa);
    }
}
