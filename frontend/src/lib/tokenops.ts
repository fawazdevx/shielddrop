import {
  getFheAirdropFactoryAddress,
  getFheDisperseSingletonAddress
} from "@tokenops/sdk";
import {
  createConfidentialAirdropClient,
  createConfidentialAirdropFactoryClient,
  encryptUint64,
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
    if (readiness.runtime === "live") {
      return this.createLiveAirdrop(draft, readiness);
    }

    await wait(500);
    const campaignId = `tokenops-${draft.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    const claimPackets = buildDemoClaimPackets(draft, this.config.baseClaimUrl);

    return {
      campaignId,
      operator: AIRDROP_FACTORY ?? "0x742d35Cc6634C0532925a3b8D8d8E4C9B4c5D2B1",
      encryptedBatchId: `tokenops-airdrop-${draft.recipients.length}-${Date.now().toString(16)}`,
      mode: "confidential-airdrop",
      sdkVersion: SDK_VERSION,
      runtime: "demo",
      airdropFactory: AIRDROP_FACTORY ?? "unresolved",
      disperseSingleton: DISPERSE_SINGLETON ?? "unresolved",
      airdropAddress: fakeHex(`${campaignId}:airdrop`, 20),
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
    const now = Math.floor(Date.now() / 1000);
    const userSalt = fakeHex(`${draft.name}:${admin}:${Date.now()}`, 32);
    const { hash, airdrop } = await factory.createConfidentialAirdrop({
      params: {
        token: draft.tokenAddress as ViemAddress,
        startTimestamp: now + 60,
        endTimestamp: now + 30 * 86400,
        canExtendClaimWindow: false,
        admin
      },
      userSalt
    });

    const claimPackets: TokenOpsClaimPacket[] = [];
    for (const recipient of draft.recipients.filter((item) => item.risk === "clear")) {
      const encryptedInput = await encryptUint64({
        encryptor,
        contractAddress: airdrop,
        userAddress: recipient.address as ViemAddress,
        value: recipient.amount
      });
      const signature = await signClaimAuthorization({
        walletClient,
        airdropAddress: airdrop,
        recipient: recipient.address as ViemAddress,
        encryptedAmountHandle: encryptedInput.handle
      });
      claimPackets.push(toClaimPacket(recipient, encryptedInput, signature, this.config.baseClaimUrl));
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
      txHash: hash,
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

function buildDemoClaimPackets(draft: TokenOpsCampaignDraft, baseClaimUrl?: string) {
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
        baseClaimUrl
      );
    });
}

function toClaimPacket(
  recipient: Recipient,
  encryptedInput: EncryptedInput,
  signature: Hex,
  baseClaimUrl = window.location.origin
): TokenOpsClaimPacket {
  const claimParams = new URLSearchParams({
    recipient: recipient.address,
    handle: encryptedInput.handle,
    sig: signature.slice(0, 18)
  });

  return {
    recipientId: recipient.id,
    label: recipient.label,
    recipient: recipient.address,
    encryptedInput,
    signature,
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
