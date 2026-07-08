export type Address = `0x${string}`;

export type CampaignStatus = "draft" | "encrypting" | "funding" | "live" | "closed";

export type Recipient = {
  id: string;
  address: Address;
  label: string;
  amount: bigint;
  encryptedHandle: string;
  claimed: boolean;
  decrypted: boolean;
  claimTxHash?: string;
  risk: "clear" | "duplicate" | "invalid";
};

export type Campaign = {
  id: string;
  name: string;
  description: string;
  creator: Address;
  tokenSymbol: string;
  tokenAddress: Address;
  underlyingAddress: Address;
  wrapperName: string;
  status: CampaignStatus;
  claimStart: string;
  claimEnd: string;
  tokenOpsOperator: Address;
  privacyMode: "amounts-private" | "amounts-and-list-private";
  recipients: Recipient[];
  contractAddress?: Address;
  stageTxHash?: string;
  lastClaimTxHash?: string;
  txHash?: string;
};

export type WrapperPair = {
  name: string;
  symbol: string;
  confidentialToken: Address;
  underlyingToken: Address;
  publicMint: boolean;
  decimals: number;
  valid: boolean;
};

export type AuditEvent = {
  id: string;
  at: string;
  actor: string;
  action: string;
  detail: string;
};

export type ClaimStep = {
  id: "connect" | "verify" | "decrypt" | "claim";
  label: string;
  status: "done" | "active" | "pending";
};
