// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import { FHE, euint64, externalEuint64 } from "@fhevm/solidity/lib/FHE.sol";
import { SepoliaFHEVMConfig } from "@fhevm/solidity/config/FHEVMConfig.sol";
import { IERC7984Minimal } from "./interfaces/IERC7984Minimal.sol";

contract ShieldDropCampaign is SepoliaFHEVMConfig {
    struct RecipientState {
        euint64 allocation;
        bool registered;
        bool claimed;
    }

    address public immutable creator;
    address public immutable token;
    address public immutable tokenOpsOperator;
    uint64 public immutable claimStart;
    uint64 public immutable claimEnd;
    string public campaignUri;

    uint256 public recipientCount;
    uint256 public claimedCount;
    bool public paused;

    mapping(address => RecipientState) private recipients;
    address[] private recipientList;

    event RecipientRegistered(address indexed recipient, euint64 encryptedAllocation);
    event RecipientUpdated(address indexed recipient, euint64 encryptedAllocation);
    event AllocationClaimed(address indexed recipient, euint64 encryptedAllocation);
    event CampaignPaused(bool paused);
    event CampaignUriUpdated(string campaignUri);

    error NotCreator();
    error NotCampaignOperator();
    error InvalidRecipient();
    error InvalidClaimWindow();
    error ClaimingClosed();
    error CampaignIsPaused();
    error AlreadyClaimed();
    error NotEligible();
    error EmptyBatch();
    error LengthMismatch();

    modifier onlyCreator() {
        if (msg.sender != creator) revert NotCreator();
        _;
    }

    modifier onlyCampaignOperator() {
        if (msg.sender != creator && msg.sender != tokenOpsOperator) revert NotCampaignOperator();
        _;
    }

    constructor(
        address creator_,
        address token_,
        string memory campaignUri_,
        uint64 claimStart_,
        uint64 claimEnd_,
        address tokenOpsOperator_
    ) {
        if (claimEnd_ <= claimStart_) revert InvalidClaimWindow();
        creator = creator_;
        token = token_;
        campaignUri = campaignUri_;
        claimStart = claimStart_;
        claimEnd = claimEnd_;
        tokenOpsOperator = tokenOpsOperator_;
    }

    function addRecipient(address recipient, externalEuint64 encryptedAmount, bytes calldata inputProof)
        external
        onlyCampaignOperator
    {
        if (recipient == address(0)) revert InvalidRecipient();
        euint64 allocation = FHE.fromExternal(encryptedAmount, inputProof);
        _setAllocation(recipient, allocation);
    }

    function addRecipients(
        address[] calldata recipientAddresses,
        externalEuint64[] calldata encryptedAmounts,
        bytes calldata inputProof
    ) external onlyCampaignOperator {
        uint256 length = recipientAddresses.length;
        if (length == 0) revert EmptyBatch();
        if (length != encryptedAmounts.length) revert LengthMismatch();

        for (uint256 i; i < length; ++i) {
            address recipient = recipientAddresses[i];
            if (recipient == address(0)) revert InvalidRecipient();
            euint64 allocation = FHE.fromExternal(encryptedAmounts[i], inputProof);
            _setAllocation(recipient, allocation);
        }
    }

    function claim() external {
        if (paused) revert CampaignIsPaused();
        if (block.timestamp < claimStart || block.timestamp > claimEnd) revert ClaimingClosed();

        RecipientState storage state = recipients[msg.sender];
        if (!state.registered) revert NotEligible();
        if (state.claimed) revert AlreadyClaimed();

        state.claimed = true;
        claimedCount += 1;

        // TokenOps or the creator must pre-fund this campaign. The token contract only needs transient
        // access for this transfer; recipients keep persistent access for user decryption.
        FHE.allowTransient(state.allocation, token);
        IERC7984Minimal(token).confidentialTransfer(msg.sender, state.allocation);
        emit AllocationClaimed(msg.sender, state.allocation);
    }

    function allocationOf(address recipient) external view returns (euint64) {
        return recipients[recipient].allocation;
    }

    function recipientAt(uint256 index) external view returns (address) {
        return recipientList[index];
    }

    function recipientStatus(address recipient)
        external
        view
        returns (bool registered, bool claimed, euint64 allocation)
    {
        RecipientState storage state = recipients[recipient];
        return (state.registered, state.claimed, state.allocation);
    }

    function campaignSummary()
        external
        view
        returns (
            address creator_,
            address token_,
            uint64 claimStart_,
            uint64 claimEnd_,
            uint256 recipientCount_,
            uint256 claimedCount_,
            bool isPaused,
            string memory uri
        )
    {
        return (creator, token, claimStart, claimEnd, recipientCount, claimedCount, paused, campaignUri);
    }

    function setPaused(bool paused_) external onlyCreator {
        paused = paused_;
        emit CampaignPaused(paused_);
    }

    function setCampaignUri(string calldata campaignUri_) external onlyCreator {
        campaignUri = campaignUri_;
        emit CampaignUriUpdated(campaignUri_);
    }

    function _setAllocation(address recipient, euint64 allocation) private {
        RecipientState storage state = recipients[recipient];
        if (!state.registered) {
            state.registered = true;
            recipientList.push(recipient);
            recipientCount += 1;
            emit RecipientRegistered(recipient, allocation);
        } else {
            emit RecipientUpdated(recipient, allocation);
        }

        state.allocation = allocation;

        // Recipient can run EIP-712 user decryption; the contract can later transfer the value.
        FHE.allow(state.allocation, recipient);
        FHE.allowThis(state.allocation);
    }
}
