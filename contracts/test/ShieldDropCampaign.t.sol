// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHEVMTestHelper} from "./FHEVMTestHelper.sol";
import {ShieldDropCampaign} from "../src/ShieldDropCampaign.sol";
import {euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";

contract ShieldDropCampaignTest is FHEVMTestHelper {
    ShieldDropCampaign internal campaign;

    uint64 internal claimStart;
    uint64 internal claimEnd;

    function setUp() public virtual override {
        super.setUp();

        (claimStart, claimEnd) = _claimWindow();

        // Deploy campaign as the creator
        vm.prank(creator);
        campaign = new ShieldDropCampaign(
            creator,
            address(mockToken),
            "ipfs://test-campaign",
            claimStart,
            claimEnd,
            operator
        );

        vm.label(address(campaign), "ShieldDropCampaign");
    }

    // ──────────────────────────────────────────────────
    //  Construction & initialization
    // ──────────────────────────────────────────────────

    function test_constructorSetsImmutables() public view {
        assertEq(campaign.creator(), creator);
        assertEq(campaign.token(), address(mockToken));
        assertEq(campaign.claimStart(), claimStart);
        assertEq(campaign.claimEnd(), claimEnd);
    }

    function test_constructorRevertsOnInvalidClaimWindow() public {
        vm.expectRevert(ShieldDropCampaign.InvalidClaimWindow.selector);
        new ShieldDropCampaign(creator, address(mockToken), "", claimEnd, claimStart, operator);
    }

    function test_constructorRevertsWhenEndEqualsStart() public {
        vm.expectRevert(ShieldDropCampaign.InvalidClaimWindow.selector);
        new ShieldDropCampaign(creator, address(mockToken), "", claimStart, claimStart, operator);
    }

    // ──────────────────────────────────────────────────
    //  addRecipient
    // ──────────────────────────────────────────────────

    function test_addRecipient_byCreator() public {
        bytes32 handle = _fakeExternalHandle(1);
        bytes memory proof = _fakeInputProof();

        vm.prank(creator);
        campaign.addRecipient(recipient1, externalEuint64.wrap(handle), proof);

        assertEq(campaign.recipientCount(), 1);
        (bool registered, bool claimed, ) = campaign.recipientStatus(recipient1);
        assertTrue(registered);
        assertFalse(claimed);
    }

    function test_addRecipient_byOperator() public {
        bytes32 handle = _fakeExternalHandle(2);
        bytes memory proof = _fakeInputProof();

        vm.prank(operator);
        campaign.addRecipient(recipient1, externalEuint64.wrap(handle), proof);

        assertEq(campaign.recipientCount(), 1);
    }

    function test_addRecipient_emitsEvent() public {
        bytes32 handle = _fakeExternalHandle(3);
        bytes memory proof = _fakeInputProof();

        vm.prank(creator);
        vm.expectEmit(true, false, false, false);
        emit ShieldDropCampaign.RecipientRegistered(recipient1, euint64.wrap(bytes32(0)));
        // We can't predict the exact handle from the mock, so just check the indexed param
        campaign.addRecipient(recipient1, externalEuint64.wrap(handle), proof);
    }

    function test_addRecipient_revertsForStranger() public {
        bytes32 handle = _fakeExternalHandle(4);
        bytes memory proof = _fakeInputProof();

        vm.prank(stranger);
        vm.expectRevert(ShieldDropCampaign.NotCampaignOperator.selector);
        campaign.addRecipient(recipient1, externalEuint64.wrap(handle), proof);
    }

    function test_addRecipient_revertsForZeroAddress() public {
        bytes32 handle = _fakeExternalHandle(5);
        bytes memory proof = _fakeInputProof();

        vm.prank(creator);
        vm.expectRevert(ShieldDropCampaign.InvalidRecipient.selector);
        campaign.addRecipient(address(0), externalEuint64.wrap(handle), proof);
    }

    function test_addRecipient_updateExisting() public {
        bytes32 handle1 = _fakeExternalHandle(6);
        bytes32 handle2 = _fakeExternalHandle(7);
        bytes memory proof = _fakeInputProof();

        vm.startPrank(creator);
        campaign.addRecipient(recipient1, externalEuint64.wrap(handle1), proof);
        campaign.addRecipient(recipient1, externalEuint64.wrap(handle2), proof);
        vm.stopPrank();

        // Count should still be 1 — update, not duplicate
        assertEq(campaign.recipientCount(), 1);
    }

    // ──────────────────────────────────────────────────
    //  addRecipients (batch)
    // ──────────────────────────────────────────────────

    function test_addRecipients_batch() public {
        address[] memory addresses = new address[](2);
        addresses[0] = recipient1;
        addresses[1] = recipient2;

        externalEuint64[] memory handles = new externalEuint64[](2);
        handles[0] = externalEuint64.wrap(_fakeExternalHandle(10));
        handles[1] = externalEuint64.wrap(_fakeExternalHandle(11));

        bytes memory proof = _fakeInputProof();

        vm.prank(creator);
        campaign.addRecipients(addresses, handles, proof);

        assertEq(campaign.recipientCount(), 2);
    }

    function test_addRecipients_revertsOnEmptyBatch() public {
        address[] memory addresses = new address[](0);
        externalEuint64[] memory handles = new externalEuint64[](0);
        bytes memory proof = _fakeInputProof();

        vm.prank(creator);
        vm.expectRevert(ShieldDropCampaign.EmptyBatch.selector);
        campaign.addRecipients(addresses, handles, proof);
    }

    function test_addRecipients_revertsOnLengthMismatch() public {
        address[] memory addresses = new address[](2);
        addresses[0] = recipient1;
        addresses[1] = recipient2;

        externalEuint64[] memory handles = new externalEuint64[](1);
        handles[0] = externalEuint64.wrap(_fakeExternalHandle(12));

        bytes memory proof = _fakeInputProof();

        vm.prank(creator);
        vm.expectRevert(ShieldDropCampaign.LengthMismatch.selector);
        campaign.addRecipients(addresses, handles, proof);
    }

    function test_addRecipients_revertsIfAnyZeroAddress() public {
        address[] memory addresses = new address[](2);
        addresses[0] = recipient1;
        addresses[1] = address(0);

        externalEuint64[] memory handles = new externalEuint64[](2);
        handles[0] = externalEuint64.wrap(_fakeExternalHandle(13));
        handles[1] = externalEuint64.wrap(_fakeExternalHandle(14));

        bytes memory proof = _fakeInputProof();

        vm.prank(creator);
        vm.expectRevert(ShieldDropCampaign.InvalidRecipient.selector);
        campaign.addRecipients(addresses, handles, proof);
    }

    // ──────────────────────────────────────────────────
    //  claim
    // ──────────────────────────────────────────────────

    function _registerRecipient(address who, uint256 seed) internal {
        bytes32 handle = _fakeExternalHandle(seed);
        bytes memory proof = _fakeInputProof();
        vm.prank(creator);
        campaign.addRecipient(who, externalEuint64.wrap(handle), proof);
    }

    function test_claim_happyPath() public {
        _registerRecipient(recipient1, 20);

        vm.prank(recipient1);
        campaign.claim();

        (, bool claimed, ) = campaign.recipientStatus(recipient1);
        assertTrue(claimed);
        assertEq(campaign.claimedCount(), 1);
        assertEq(mockToken.transferCount(recipient1), 1);
    }

    function test_claim_multipleRecipients() public {
        _registerRecipient(recipient1, 30);
        _registerRecipient(recipient2, 31);

        vm.prank(recipient1);
        campaign.claim();

        vm.prank(recipient2);
        campaign.claim();

        assertEq(campaign.claimedCount(), 2);
    }

    function test_claim_revertsIfNotEligible() public {
        vm.prank(stranger);
        vm.expectRevert(ShieldDropCampaign.NotEligible.selector);
        campaign.claim();
    }

    function test_claim_revertsOnDoubleClaim() public {
        _registerRecipient(recipient1, 40);

        vm.prank(recipient1);
        campaign.claim();

        vm.prank(recipient1);
        vm.expectRevert(ShieldDropCampaign.AlreadyClaimed.selector);
        campaign.claim();
    }

    function test_claim_revertsWhenPaused() public {
        _registerRecipient(recipient1, 50);

        vm.prank(creator);
        campaign.setPaused(true);

        vm.prank(recipient1);
        vm.expectRevert(ShieldDropCampaign.CampaignIsPaused.selector);
        campaign.claim();
    }

    function test_claim_revertsBeforeClaimStart() public {
        // Warp to before the claim window
        vm.warp(claimStart - 1);

        _registerRecipient(recipient1, 60);

        vm.prank(recipient1);
        vm.expectRevert(ShieldDropCampaign.ClaimingClosed.selector);
        campaign.claim();
    }

    function test_claim_revertsAfterClaimEnd() public {
        _registerRecipient(recipient1, 70);

        vm.warp(claimEnd + 1);

        vm.prank(recipient1);
        vm.expectRevert(ShieldDropCampaign.ClaimingClosed.selector);
        campaign.claim();
    }

    function test_claim_emitsEvent() public {
        _registerRecipient(recipient1, 80);

        vm.prank(recipient1);
        vm.expectEmit(true, false, false, false);
        emit ShieldDropCampaign.AllocationClaimed(recipient1, euint64.wrap(bytes32(0)));
        campaign.claim();
    }

    // ──────────────────────────────────────────────────
    //  Pause / unpause
    // ──────────────────────────────────────────────────

    function test_setPaused_onlyCreator() public {
        vm.prank(stranger);
        vm.expectRevert(ShieldDropCampaign.NotCreator.selector);
        campaign.setPaused(true);
    }

    function test_setPaused_toggle() public {
        vm.prank(creator);
        campaign.setPaused(true);
        assertTrue(campaign.paused());

        vm.prank(creator);
        campaign.setPaused(false);
        assertFalse(campaign.paused());
    }

    // ──────────────────────────────────────────────────
    //  Read functions
    // ──────────────────────────────────────────────────

    function test_recipientAt() public {
        _registerRecipient(recipient1, 90);
        _registerRecipient(recipient2, 91);

        assertEq(campaign.recipientAt(0), recipient1);
        assertEq(campaign.recipientAt(1), recipient2);
    }

    function test_campaignSummary() public {
        _registerRecipient(recipient1, 100);

        (
            address creator_,
            address token_,
            uint64 claimStart_,
            uint64 claimEnd_,
            uint256 recipientCount_,
            uint256 claimedCount_,
            bool isPaused,
            string memory uri
        ) = campaign.campaignSummary();

        assertEq(creator_, creator);
        assertEq(token_, address(mockToken));
        assertEq(claimStart_, claimStart);
        assertEq(claimEnd_, claimEnd);
        assertEq(recipientCount_, 1);
        assertEq(claimedCount_, 0);
        assertFalse(isPaused);
        assertEq(uri, "ipfs://test-campaign");
    }

    // ──────────────────────────────────────────────────
    //  campaignUri
    // ──────────────────────────────────────────────────

    function test_setCampaignUri_onlyCreator() public {
        vm.prank(stranger);
        vm.expectRevert(ShieldDropCampaign.NotCreator.selector);
        campaign.setCampaignUri("ipfs://new");
    }

    function test_setCampaignUri_updates() public {
        vm.prank(creator);
        campaign.setCampaignUri("ipfs://updated");
        assertEq(campaign.campaignUri(), "ipfs://updated");
    }
}
