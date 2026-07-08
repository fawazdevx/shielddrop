import {
  getFheAirdropFactoryAddress,
  getFheDisperseSingletonAddress
} from "@tokenops/sdk";
import {
  createConfidentialAirdropClient,
  createConfidentialAirdropFactoryClient,
  encryptUint64,
  erc7984OperatorAbi,
  signClaimAuthorization,
  type Encryptor,
  type EncryptedInput
} from "@tokenops/sdk/fhe-airdrop";
import { createConfidentialDisperseClient, type DisperseMode } from "@tokenops/sdk/fhe-disperse";
import type { Address as ViemAddress, Hex, PublicClient, WalletClient } from "viem";
import { ZAMA_SEPOLIA } from "../../../shared/sepolia";
import packageJson from "../../package.json";
import type { Campaign, Recipient } from "./types";

export type TokenOpsCampaignDraft = {
  name: string;
  tokenAddress: string;
  tokenSymbol: string;
  recipients: Recipient[];
  onProgress?: (message: string) => void;
};

export type TokenOpsMode = "confidential-airdrop" | "confidential-disperse";

export type TokenOpsReadinessItem = {
  label: string;
  ok: boolean;
  detail: string;
};

export type TokenOpsReadiness = {
  ready: boolean;
  runtime: "demo" | "live";
  sdkVersion: string;
  mode: TokenOpsMode;
  airdropFactory: string;
  disperseSingleton: string;
  items: TokenOpsReadinessItem[];
  blockers: string[];
};

export type TokenOpsClaimPacket = {
  recipientId: string;
  label: string;
  recipient: string;
  encryptedInput: EncryptedInput;
  signature: Hex;
  airdropAddress?: string;
  deliveryUrl: string;
  status: "ready" | "needs-review";
};

export type TokenOpsDistributionResult = {
  campaignId: string;
  operator: string;
  encryptedBatchId: string;
  mode: TokenOpsMode;
  sdkVersion: string;
  runtime: "demo" | "live";
  airdropFactory: string;
  disperseSingleton: string;
  airdropAddress?: string;
  setupTxHash?: Hex;
  txHash?: Hex;
  claimPackets: TokenOpsClaimPacket[];
  readiness: TokenOpsReadiness;
};

export interface TokenOpsAdapter {
  getReadiness(draft: TokenOpsCampaignDraft): TokenOpsReadiness;
  createDistribution(draft: TokenOpsCampaignDraft): Promise<TokenOpsDistributionResult>;
  syncCampaign(campaign: Campaign): Promise<{ ok: boolean; syncedAt: string }>;
}

export type TokenOpsAdapterConfig = {
  publicClient?: PublicClient;
  walletClient?: WalletClient;
  encryptor?: Encryptor;
  account?: ViemAddress;
  baseClaimUrl?: string;
  mode?: TokenOpsMode;
};

const TOKENOPS_CHAIN_ID = ZAMA_SEPOLIA.chainId;
const AIRDROP_FACTORY = getFheAirdropFactoryAddress(TOKENOPS_CHAIN_ID);
const DISPERSE_SINGLETON = getFheDisperseSingletonAddress(TOKENOPS_CHAIN_ID);
const SDK_VERSION = packageJson.dependencies["@tokenops/sdk"].replace(/^[^\d]*/, "");
const AIRDROP_START_DELAY_SECONDS = 2 * 60;
const AIRDROP_DURATION_SECONDS = 30 * 86400;
const OPERATOR_DEADLINE_SECONDS = 24 * 60 * 60;

export const tokenOpsSdkEvidence = {
  package: "@tokenops/sdk",
  version: SDK_VERSION,
  subpaths: ["@tokenops/sdk/fhe-airdrop", "@tokenops/sdk/fhe-disperse"],
  sepoliaAirdropFactory: AIRDROP_FACTORY,
  sepoliaDisperseSingleton: DISPERSE_SINGLETON,
  bindingsLoaded:
    typeof createConfidentialAirdropFactoryClient === "function" &&
    typeof createConfidentialAirdropClient === "function" &&
    typeof createConfidentialDisperseClient === "function" &&
    typeof encryptUint64 === "function" &&
    typeof signClaimAuthorization === "function"
};

export class TokenOpsSdkAdapter implements TokenOpsAdapter {
  private readonly config: TokenOpsAdapterConfig;

  constructor(config: TokenOpsAdapterConfig = {}) {
    this.config = config;
  }

  getReadiness(draft: TokenOpsCampaignDraft): TokenOpsReadiness {
    const clearRecipients = draft.recipients.filter((recipient) => recipient.risk === "clear");
    const runtime = this.hasLiveClients() ? "live" : "demo";
    const items: TokenOpsReadinessItem[] = [
      {
        label: "Private distribution route",
        ok: tokenOpsSdkEvidence.bindingsLoaded,
        detail: "Confidential airdrop and disperse routes are available"
      },
      {
        label: "Airdrop route",
        ok: Boolean(AIRDROP_FACTORY),
        detail: AIRDROP_FACTORY ? "Ready on Sepolia" : "Sepolia route is unavailable"
      },
      {
        label: "Bulk payout route",
        ok: Boolean(DISPERSE_SINGLETON),
        detail: DISPERSE_SINGLETON ? "Ready on Sepolia" : "Bulk payout route is unavailable"
      },
      {
        label: "Recipient batch",
        ok: draft.recipients.length > 0 && clearRecipients.length === draft.recipients.length,
        detail: `${clearRecipients.length}/${draft.recipients.length} rows pass address and duplicate checks`
      },
      {
        label: "Wallet connection",
        ok: runtime === "live",
        detail:
          runtime === "live"
            ? "Wallet and encryption services are connected"
            : "Connect a wallet to move from preview to live launch"
      },
      {
        label: "Sepolia start buffer",
        ok: true,
        detail: "Airdrops start a few minutes after staging to avoid stale timestamp reverts"
      }
    ];
    const blockers = items.filter((item) => !item.ok && item.label !== "Execution clients").map((item) => item.label);

    return {
      ready: blockers.length === 0,
      runtime,
      sdkVersion: SDK_VERSION,
      mode: this.config.mode ?? "confidential-airdrop",
      airdropFactory: AIRDROP_FACTORY ?? "unresolved",
      disperseSingleton: DISPERSE_SINGLETON ?? "unresolved",
      items,
      blockers
    };
  }

  async createDistribution(draft: TokenOpsCampaignDraft): Promise<TokenOpsDistributionResult> {
    const readiness = this.getReadiness(draft);
    const mode = this.config.mode ?? "confidential-airdrop";
    if (readiness.runtime === "live") {
      return mode === "confidential-disperse"
        ? this.createLiveDisperse(draft, readiness)
        : this.createLiveAirdrop(draft, readiness);
    }

    draft.onProgress?.("Preparing demo claim packets.");
    await wait(500);
    const campaignId = `tokenops-${draft.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    const airdropAddress = fakeHex(`${campaignId}:airdrop`, 20);
    const claimPackets = buildDemoClaimPackets(draft, this.config.baseClaimUrl, airdropAddress);

    return {
      campaignId,
      operator: mode === "confidential-disperse"
        ? (DISPERSE_SINGLETON ?? "0x742d35Cc6634C0532925a3b8D8d8E4C9B4c5D2B1")
        : (AIRDROP_FACTORY ?? "0x742d35Cc6634C0532925a3b8D8d8E4C9B4c5D2B1"),
      encryptedBatchId: `tokenops-${mode === "confidential-disperse" ? "disperse" : "airdrop"}-${draft.recipients.length}-${Date.now().toString(16)}`,
      mode,
      sdkVersion: SDK_VERSION,
      runtime: "demo",
      airdropFactory: AIRDROP_FACTORY ?? "unresolved",
      disperseSingleton: DISPERSE_SINGLETON ?? "unresolved",
      airdropAddress,
      txHash: fakeHex(`${campaignId}:stage:${Date.now()}`, 32),
      claimPackets,
      readiness
    };
  }

  async syncCampaign(): Promise<{ ok: boolean; syncedAt: string }> {
    await wait(350);
    return { ok: true, syncedAt: new Date().toISOString() };
  }

  private hasLiveClients() {
    return Boolean(this.config.publicClient && this.config.walletClient && this.config.encryptor);
  }

  private async createLiveAirdrop(
    draft: TokenOpsCampaignDraft,
    readiness: TokenOpsReadiness
  ): Promise<TokenOpsDistributionResult> {
    const { publicClient, walletClient, encryptor } = this.config;
    if (!publicClient || !walletClient || !encryptor) {
      throw new Error("TokenOps live mode requires publicClient, walletClient, and encryptor.");
    }

    const admin = this.config.account ?? walletClient.account?.address;
    if (!admin) {
      throw new Error("TokenOps live mode requires a connected wallet account.");
    }

    const factory = createConfidentialAirdropFactoryClient({ publicClient, walletClient, encryptor });
    const userSalt = fakeHex(`${draft.name}:${admin}:${Date.now()}`, 32);

    const clearRecipients = draft.recipients.filter((item) => item.risk === "clear");
    const fundingTotal = clearRecipients.reduce((sum, item) => sum + item.amount, 0n);
    if (fundingTotal <= 0n) {
      throw new Error("Add at least one positive recipient allocation before staging privately.");
    }

    // Fund the clone in the same tx so recipients can actually claim tokens.
    // Prerequisite: the factory must be an operator on the confidential token.
    draft.onProgress?.("Checking TokenOps operator approval.");
    let setupTxHash: Hex | undefined;
    const factoryIsOperator = await publicClient.readContract({
      address: draft.tokenAddress as ViemAddress,
      abi: erc7984OperatorAbi,
      functionName: "isOperator",
      args: [admin, AIRDROP_FACTORY as ViemAddress]
    });
    if (!factoryIsOperator) {
      draft.onProgress?.("Open your wallet to approve the TokenOps operator.");
      const operatorDeadline = Math.floor(Date.now() / 1000) + OPERATOR_DEADLINE_SECONDS;
      const setOperatorHash = await walletClient.writeContract({
        account: admin,
        chain: walletClient.chain,
        address: draft.tokenAddress as ViemAddress,
        abi: erc7984OperatorAbi,
        functionName: "setOperator",
        args: [AIRDROP_FACTORY as ViemAddress, operatorDeadline]
      });
      setupTxHash = setOperatorHash;
      draft.onProgress?.("Waiting for operator approval to confirm.");
      await publicClient.waitForTransactionReceipt({ hash: setOperatorHash });
    }

    draft.onProgress?.("Encrypting funding input with the Zama relayer. The stage transaction prompt comes after this.");
    const fundingInput = await encryptUint64({
      encryptor,
      contractAddress: AIRDROP_FACTORY as ViemAddress,
      userAddress: admin,
      value: fundingTotal
    });
    const { startTimestamp, endTimestamp } = await safeAirdropWindow(publicClient);

    draft.onProgress?.("Open your wallet to create and fund the confidential airdrop.");
    const { hash, airdrop } = await factory.createAndFundConfidentialAirdrop({
      params: {
        token: draft.tokenAddress as ViemAddress,
        startTimestamp,
        endTimestamp,
        canExtendClaimWindow: false,
        admin
      },
      userSalt,
      encryptedInput: fundingInput
    });
    draft.onProgress?.("Waiting for the stage transaction to confirm.");

    const claimPackets: TokenOpsClaimPacket[] = [];
    for (const [index, recipient] of clearRecipients.entries()) {
      draft.onProgress?.(`Encrypting claim packet ${index + 1}/${clearRecipients.length} with the Zama relayer.`);
      const encryptedInput = await encryptUint64({
        encryptor,
        contractAddress: airdrop,
        userAddress: recipient.address as ViemAddress,
        value: recipient.amount
      });
      draft.onProgress?.(`Sign claim authorization ${index + 1}/${clearRecipients.length}.`);
      const signature = await signClaimAuthorization({
        walletClient,
        airdropAddress: airdrop,
        recipient: recipient.address as ViemAddress,
        encryptedAmountHandle: encryptedInput.handle
      });
      claimPackets.push(toClaimPacket(recipient, encryptedInput, signature, this.config.baseClaimUrl, airdrop));
    }

    return {
      campaignId: `tokenops-${draft.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      operator: readiness.airdropFactory,
      encryptedBatchId: `tokenops-airdrop-${claimPackets.length}-${hash.slice(2, 10)}`,
      mode: "confidential-airdrop",
      sdkVersion: SDK_VERSION,
      runtime: "live",
      airdropFactory: readiness.airdropFactory,
      disperseSingleton: readiness.disperseSingleton,
      airdropAddress: airdrop,
      setupTxHash,
      txHash: hash,
      claimPackets,
      readiness
    };
  }

  private async createLiveDisperse(
    draft: TokenOpsCampaignDraft,
    readiness: TokenOpsReadiness
  ): Promise<TokenOpsDistributionResult> {
    const { publicClient, walletClient, encryptor } = this.config;
    if (!publicClient || !walletClient || !encryptor) {
      throw new Error("TokenOps live mode requires publicClient, walletClient, and encryptor.");
    }

    const admin = this.config.account ?? walletClient.account?.address;
    if (!admin) {
      throw new Error("TokenOps live mode requires a connected wallet account.");
    }

    const disperse = createConfidentialDisperseClient({ publicClient, walletClient, encryptor });
    const clearRecipients = draft.recipients.filter((item) => item.risk === "clear");

    // The SDK encrypts amounts internally — pass plaintext addresses + amounts.
    const addresses = clearRecipients.map((r) => r.address as ViemAddress);
    const amounts = clearRecipients.map((r) => r.amount);

    draft.onProgress?.("Open your wallet to submit the confidential disperse transaction.");
    const result = await disperse.disperse({
      token: draft.tokenAddress as ViemAddress,
      recipients: addresses,
      amounts,
      mode: tokenOpsModeToDisperseMode("confidential-disperse")
    });

    // Build claim packets with deterministic handles for delivery URLs.
    const claimPackets: TokenOpsClaimPacket[] = clearRecipients.map((recipient) => {
      const encryptedInput = {
        handle: fakeHex(`${draft.name}:${recipient.address}:disperse-handle`, 32),
        inputProof: fakeHex(`${draft.name}:${recipient.address}:disperse-proof`, 96)
      } satisfies EncryptedInput;
      return toClaimPacket(recipient, encryptedInput, "0x" as Hex, this.config.baseClaimUrl);
    });

    return {
      campaignId: `tokenops-${draft.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      operator: readiness.disperseSingleton,
      encryptedBatchId: `tokenops-disperse-${claimPackets.length}-${result.hash.slice(2, 10)}`,
      mode: "confidential-disperse",
      sdkVersion: SDK_VERSION,
      runtime: "live",
      airdropFactory: readiness.airdropFactory,
      disperseSingleton: readiness.disperseSingleton,
      txHash: result.hash,
      claimPackets,
      readiness
    };
  }
}

export function createTokenOpsAdapter(): TokenOpsAdapter {
  return new TokenOpsSdkAdapter();
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function safeAirdropWindow(publicClient: PublicClient) {
  const latestBlock = await publicClient.getBlock();
  const chainNow = Number(latestBlock.timestamp);
  const wallNow = Math.floor(Date.now() / 1000);
  const startTimestamp = Math.max(chainNow, wallNow) + AIRDROP_START_DELAY_SECONDS;
  const endTimestamp = startTimestamp + AIRDROP_DURATION_SECONDS;
  return { startTimestamp, endTimestamp };
}

function buildDemoClaimPackets(draft: TokenOpsCampaignDraft, baseClaimUrl?: string, airdropAddress?: string) {
  return draft.recipients
    .filter((recipient) => recipient.risk === "clear")
    .map((recipient) => {
      const encryptedInput = {
        handle: fakeHex(`${draft.name}:${recipient.address}:handle`, 32),
        inputProof: fakeHex(`${draft.name}:${recipient.address}:proof`, 96)
      } satisfies EncryptedInput;
      return toClaimPacket(
        recipient,
        encryptedInput,
        fakeHex(`${draft.name}:${recipient.address}:signature`, 65),
        baseClaimUrl,
        airdropAddress
      );
    });
}

function toClaimPacket(
  recipient: Recipient,
  encryptedInput: EncryptedInput,
  signature: Hex,
  baseClaimUrl = window.location.origin,
  airdropAddress?: string
): TokenOpsClaimPacket {
  const claimParams = new URLSearchParams({
    recipient: recipient.address,
    handle: encryptedInput.handle,
    proof: encryptedInput.inputProof,
    sig: signature
  });
  if (airdropAddress) claimParams.set("airdrop", airdropAddress);

  return {
    recipientId: recipient.id,
    label: recipient.label,
    recipient: recipient.address,
    encryptedInput,
    signature,
    airdropAddress,
    deliveryUrl: `${baseClaimUrl}/claim?${claimParams.toString()}`,
    status: recipient.risk === "clear" ? "ready" : "needs-review"
  };
}

function fakeHex(seed: string, bytes: 20 | 32 | 65 | 96): Hex {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  let hex = "";
  while (hex.length < bytes * 2) {
    hash ^= hex.length + seed.length;
    hash = Math.imul(hash, 16777619);
    hex += (hash >>> 0).toString(16).padStart(8, "0");
  }

  return `0x${hex.slice(0, bytes * 2)}` as Hex;
}

export function tokenOpsModeToDisperseMode(mode: TokenOpsMode): DisperseMode {
  return mode === "confidential-disperse" ? "wallet" : "direct";
}
