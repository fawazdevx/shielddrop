import { ShieldCheck, type LucideIcon, Send, Users, WalletCards } from "lucide-react";
import { ZAMA_SEPOLIA } from "../../../shared/sepolia";
import type { AuditEvent, Campaign, Recipient, WrapperPair } from "./types";

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

export const wrapperPairs: WrapperPair[] = ZAMA_SEPOLIA.wrappers.map((wrapper) => ({
  ...wrapper,
  valid: true
}));

export const defaultCreator = "0x8f12BfE824aD9A72F64F5A6F51d8f27D1f0D4b91";
export const defaultTokenOpsOperator = "0x742d35Cc6634C0532925a3b8D8d8E4C9B4c5D2B1";

export const sampleCsv = `wallet,label,amount
0x5B38Da6a701c568545dCfcB03FcB875f56beddC4,Core contributor,12500
0xAb8483F64d9C6d1EcF9b849Ae677dD3315835cb2,Design partner,8400
0x4B20993Bc481177ec7E8f571ceCaE8A9e22C02db,Early user cohort,3200
0x78731D3Ca6b7E34aC0F824c42a7cC18A495cabaB,Security reviewer,1500`;

export const demoRecipients: Recipient[] = [
  {
    id: "rec-1",
    address: "0x5B38Da6a701c568545dCfcB03FcB875f56beddC4",
    label: "Core contributor",
    amount: 12500n * 1_000_000n,
    encryptedHandle: "0x8b8d...1f29",
    claimed: true,
    decrypted: true,
    risk: "clear"
  },
  {
    id: "rec-2",
    address: "0xAb8483F64d9C6d1EcF9b849Ae677dD3315835cb2",
    label: "Design partner",
    amount: 8400n * 1_000_000n,
    encryptedHandle: "0x4c12...aa02",
    claimed: false,
    decrypted: false,
    risk: "clear"
  },
  {
    id: "rec-3",
    address: "0x4B20993Bc481177ec7E8f571ceCaE8A9e22C02db",
    label: "Early user cohort",
    amount: 3200n * 1_000_000n,
    encryptedHandle: "0xe661...90df",
    claimed: false,
    decrypted: true,
    risk: "clear"
  },
  {
    id: "rec-4",
    address: "0x78731D3Ca6b7E34aC0F824c42a7cC18A495cabaB",
    label: "Security reviewer",
    amount: 1500n * 1_000_000n,
    encryptedHandle: "0x229a...0c74",
    claimed: false,
    decrypted: false,
    risk: "clear"
  }
];

export const initialCampaign: Campaign = {
  id: "shielddrop-season3",
  name: "Season 3 Builder Rewards",
  description: "Private cUSDT rewards for contributors, reviewers, and early ecosystem partners.",
  creator: defaultCreator,
  tokenSymbol: "cUSDTMock",
  tokenAddress: "0x4E7B06D78965594eB5EF5414c357ca21E1554491",
  underlyingAddress: "0xa7dA08FafDC9097Cc0E7D4f113A61e31d7e8e9b0",
  wrapperName: "Confidential USDT (Mock)",
  status: "live",
  claimStart: "2026-06-20T09:00",
  claimEnd: "2026-07-07T23:59",
  tokenOpsOperator: defaultTokenOpsOperator,
  privacyMode: "amounts-and-list-private",
  recipients: demoRecipients,
  contractAddress: "0x91b7CafE9B1C2f0f7e8845d6b13dFe9D31E93281",
  txHash: "0x6cf3f2a1b6b9d4d2a6a8a3890e1f7122d7d80a7b2abecf316b2a9c5f71dbb401"
};

export const auditTrail: AuditEvent[] = [
  {
    id: "event-1",
    at: "09:14",
    actor: "Creator",
    action: "Campaign created",
    detail: "Factory validated cUSDTMock through the official Zama wrappers registry."
  },
  {
    id: "event-2",
    at: "09:18",
    actor: "TokenOps",
    action: "Recipients encrypted",
    detail: "4 allocation handles registered with campaign ACL access."
  },
  {
    id: "event-3",
    at: "09:22",
    actor: "Creator",
    action: "Campaign funded",
    detail: "Confidential funding transferred to ShieldDrop campaign escrow."
  },
  {
    id: "event-4",
    at: "09:31",
    actor: "Recipient",
    action: "Claim completed",
    detail: "Allocation claimed without public amount disclosure."
  }
];

export const metrics: Array<{
  label: string;
  value: string;
  delta: string;
  icon: LucideIcon;
}> = [
  { label: "Confidential volume", value: "25,600 cUSDT", delta: "6-decimal ERC-7984", icon: ShieldCheck },
  { label: "Recipients", value: "4", delta: "1 claimed", icon: Users },
  { label: "Registry token", value: "cUSDTMock", delta: "valid Sepolia pair", icon: WalletCards },
  { label: "Distribution mode", value: "Private", delta: "TokenOps ready", icon: Send }
];
