// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import { IWrapperRegistry } from "./interfaces/IWrapperRegistry.sol";
import { ShieldDropCampaign } from "./ShieldDropCampaign.sol";

contract ShieldDropFactory {
    bytes32 private constant IMPLEMENTATION_SLOT =
        0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;

    IWrapperRegistry public registry;
    address public owner;
    bool private initialized;

    address[] private campaigns;
    mapping(address => address[]) private campaignsByCreator;

    event CampaignCreated(
        address indexed creator,
        address indexed campaign,
        address indexed token,
        string campaignUri
    );
    event Upgraded(address indexed implementation);

    error InvalidRegistry();
    error AlreadyInitialized();
    error NotOwner();
    error InvalidOwner();
    error InvalidImplementation();
    error UpgradeCallFailed();
    error UnsupportedImplementation();
    error InvalidConfidentialToken();
    error InvalidClaimWindow();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address registry_) {
        _initialize(registry_, msg.sender);
    }

    function initialize(address registry_, address owner_) external {
        _initialize(registry_, owner_);
    }

    function createCampaign(
        address token,
        string calldata campaignUri,
        uint64 claimStart,
        uint64 claimEnd,
        address tokenOpsOperator
    ) external returns (address campaign) {
        if (claimEnd <= claimStart) revert InvalidClaimWindow();
        if (!registry.isConfidentialTokenValid(token)) revert InvalidConfidentialToken();

        campaign = address(
            new ShieldDropCampaign(
                msg.sender,
                token,
                campaignUri,
                claimStart,
                claimEnd,
                tokenOpsOperator
            )
        );

        campaigns.push(campaign);
        campaignsByCreator[msg.sender].push(campaign);
        emit CampaignCreated(msg.sender, campaign, token, campaignUri);
    }

    function allCampaignsLength() external view returns (uint256) {
        return campaigns.length;
    }

    function allCampaigns(uint256 index) external view returns (address) {
        return campaigns[index];
    }

    function creatorCampaignsLength(address creator) external view returns (uint256) {
        return campaignsByCreator[creator].length;
    }

    function creatorCampaign(address creator, uint256 index) external view returns (address) {
        return campaignsByCreator[creator][index];
    }

    function proxiableUUID() external pure returns (bytes32) {
        return IMPLEMENTATION_SLOT;
    }

    function upgradeTo(address newImplementation) external onlyOwner {
        _upgradeTo(newImplementation);
    }

    function upgradeToAndCall(address newImplementation, bytes calldata data)
        external
        payable
        onlyOwner
    {
        _upgradeTo(newImplementation);
        (bool ok,) = newImplementation.delegatecall(data);
        if (!ok) revert UpgradeCallFailed();
    }

    function _authorizeUpgrade(address) internal view {
        if (msg.sender != owner) revert NotOwner();
    }

    function _initialize(address registry_, address owner_) private {
        if (initialized) revert AlreadyInitialized();
        if (registry_ == address(0)) revert InvalidRegistry();
        if (owner_ == address(0)) revert InvalidOwner();

        initialized = true;
        registry = IWrapperRegistry(registry_);
        owner = owner_;
    }

    function _upgradeTo(address newImplementation) private {
        _authorizeUpgrade(newImplementation);
        if (newImplementation.code.length == 0) revert InvalidImplementation();
        try ShieldDropFactory(newImplementation).proxiableUUID() returns (bytes32 slot_) {
            if (slot_ != IMPLEMENTATION_SLOT) revert UnsupportedImplementation();
        } catch {
            revert UnsupportedImplementation();
        }

        bytes32 slot = IMPLEMENTATION_SLOT;
        assembly {
            sstore(slot, newImplementation)
        }
        emit Upgraded(newImplementation);
    }
}
