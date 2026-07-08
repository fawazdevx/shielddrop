import type { TokenOpsDistributionResult, TokenOpsReadiness } from "./tokenops";
import type { Address, Campaign, Recipient } from "./types";

export const SEPOLIA_TX_BASE_URL = "https://sepolia.etherscan.io/tx";

export function compactAddress(address: string, chars = 4) {
  if (!address.startsWith("0x") || address.length < 12) return address;
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

export function sepoliaTxUrl(hash?: string | null) {
  return hash && /^0x[a-fA-F0-9]{64}$/.test(hash) ? `${SEPOLIA_TX_BASE_URL}/${hash}` : undefined;
}

export function formatUnits(value: bigint, decimals = 6) {
  const base = 10n ** BigInt(decimals);
  const whole = value / base;
  const fraction = value % base;
  const padded = fraction.toString().padStart(decimals, "0").replace(/0+$/, "");
  return padded ? `${whole.toLocaleString()}.${padded}` : whole.toLocaleString();
}

export function parseAmount(value: string, decimals = 6) {
  const normalized = value.trim().replaceAll(",", "");
  if (!normalized || Number.isNaN(Number(normalized))) return 0n;
  const [whole, fraction = ""] = normalized.split(".");
  const safeFraction = fraction.slice(0, decimals).padEnd(decimals, "0");
  return BigInt(whole || "0") * 10n ** BigInt(decimals) + BigInt(safeFraction || "0");
}

export function isAddress(value: string): value is Address {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

export function campaignTotal(campaign: Campaign) {
  return campaign.recipients.reduce((sum, recipient) => sum + recipient.amount, 0n);
}

export function claimRate(campaign: Campaign) {
  if (campaign.recipients.length === 0) return 0;
  return Math.round((campaign.recipients.filter((recipient) => recipient.claimed).length / campaign.recipients.length) * 100);
}

export function parseRecipientsCsv(csv: string): Recipient[] {
  const [, ...rows] = csv.trim().split(/\r?\n/);
  const seen = new Set<string>();

  return rows
    .map((row, index) => {
      const [wallet = "", label = `Recipient ${index + 1}`, amount = "0"] = row.split(",").map((cell) => cell.trim());
      const normalized = wallet as Address;
      const duplicate = seen.has(wallet.toLowerCase());
      seen.add(wallet.toLowerCase());

      return {
        id: `csv-${index + 1}`,
        address: normalized,
        label,
        amount: parseAmount(amount),
        encryptedHandle: "pending",
        claimed: false,
        decrypted: false,
        risk: !isAddress(wallet) ? "invalid" : duplicate ? "duplicate" : "clear"
      } satisfies Recipient;
    })
    .filter((recipient) => recipient.address || recipient.label || recipient.amount > 0n);
}

export function buildAuditExport(
  campaign: Campaign,
  tokenOpsReadiness?: TokenOpsReadiness,
  tokenOpsResult?: TokenOpsDistributionResult | null
) {
  const stageTxHash = tokenOpsResult?.runtime === "live" ? tokenOpsResult.txHash : campaign.stageTxHash;
  const setupTxHash = tokenOpsResult?.runtime === "live" ? tokenOpsResult.setupTxHash : undefined;
  const claimTxHashes = campaign.recipients.flatMap((recipient) => recipient.claimTxHash ?? []);
  const rows = [
    ["campaign", campaign.name],
    ["token", campaign.tokenSymbol],
    ["contract", campaign.contractAddress ?? "not deployed"],
    ["recipients", campaign.recipients.length.toString()],
    ["claimed", campaign.recipients.filter((recipient) => recipient.claimed).length.toString()],
    ["encrypted_total", `${formatUnits(campaignTotal(campaign))} ${campaign.tokenSymbol}`],
    ["privacy_mode", campaign.privacyMode],
    ["registry_wrapper", campaign.tokenAddress],
    ["distribution_route", tokenOpsReadiness?.mode ?? "not checked"],
    ["launch_runtime", tokenOpsReadiness?.runtime ?? "not checked"],
    ["staged_runtime", tokenOpsResult?.runtime ?? "not staged"],
    ["operator_setup_tx", setupTxHash ?? "not required or not captured"],
    ["operator_setup_tx_url", sepoliaTxUrl(setupTxHash) ?? ""],
    ["stage_tx", stageTxHash ?? "not captured"],
    ["stage_tx_url", sepoliaTxUrl(stageTxHash) ?? ""],
    ["claim_tx_count", String(claimTxHashes.length)],
    ["claim_tx_hashes", claimTxHashes.join(" ") || "not captured"],
    ["claim_packets", tokenOpsResult ? tokenOpsResult.claimPackets.length.toString() : "not staged"],
    ["encrypted_batch_id", tokenOpsResult?.encryptedBatchId ?? "not staged"]
  ];

  return rows.map((row) => row.join(",")).join("\n");
}

export function downloadText(filename: string, contents: string) {
  const blob = new Blob([contents], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
