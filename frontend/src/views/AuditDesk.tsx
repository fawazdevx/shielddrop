import { Check, Download, FileClock, Shield } from "lucide-react";
import { auditTrail } from "../lib/constants";
import { compactAddress } from "../lib/format";
import type { TokenOpsDistributionResult, TokenOpsReadiness } from "../lib/tokenops";
import type { Campaign } from "../lib/types";
import { Button, Panel } from "../components/ui";

const CHECKS = [
  "Recipients validated before launch",
  "Amounts encrypted before distribution",
  "Each claim packet is recipient-specific",
  "Recipients decrypt only their own allocation",
  "Public-safe audit export"
];

export function AuditDesk({
  campaign,
  tokenOpsReadiness,
  tokenOpsResult,
  onExport
}: {
  campaign: Campaign;
  tokenOpsReadiness: TokenOpsReadiness;
  tokenOpsResult: TokenOpsDistributionResult | null;
  onExport: () => void;
}) {
  const evidence = [
    { label: "Distribution route", value: tokenOpsReadiness.mode === "confidential-airdrop" ? "Private airdrop" : "Bulk payout" },
    { label: "Network", value: "Sepolia" },
    { label: "Registry token", value: campaign.tokenSymbol },
    { label: "Recipients", value: String(campaign.recipients.length) },
    { label: "Claim packets", value: tokenOpsResult ? String(tokenOpsResult.claimPackets.length) : "not staged" },
    { label: "Encrypted batch", value: tokenOpsResult ? compactAddress(tokenOpsResult.encryptedBatchId, 6) : "not staged" }
  ];

  return (
    <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
      {/* ---------------- event trail + evidence ---------------- */}
      <Panel className="p-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <span className="font-mono text-[11px] uppercase tracking-wider text-purple-bright">
              Audit report
            </span>
            <h2 className="mt-1 text-xl font-semibold text-ink">Event trail</h2>
          </div>
          <Button icon={Download} onClick={onExport}>
            Export
          </Button>
        </header>

        {/* timeline */}
        <ol className="mt-6 relative border-l border-hairline pl-6">
          {auditTrail.map((event, i) => (
            <li key={event.id} className={i === auditTrail.length - 1 ? "" : "pb-5"}>
              <span className="absolute -left-[7px] mt-1 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-obsidian bg-purple" />
              <div className="flex items-baseline justify-between gap-3">
                <strong className="text-[14px] font-medium text-ink">{event.action}</strong>
                <time className="shrink-0 font-mono text-[11px] text-ink-faint">{event.at}</time>
              </div>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-muted">
                <span className="text-ink-2">{event.actor}</span> · {event.detail}
              </p>
            </li>
          ))}
        </ol>

        {/* evidence grid */}
        <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {evidence.map((e) => (
            <div key={e.label} className="rounded-[12px] border border-hairline bg-white/[0.02] px-3.5 py-3">
              <span className="block text-[11px] uppercase tracking-wide text-ink-faint">{e.label}</span>
              <strong className="mt-1 block truncate font-mono text-[13px] font-medium text-ink">{e.value}</strong>
            </div>
          ))}
        </div>

        <p className="mt-4 flex items-center gap-1.5 text-[12px] text-ink-faint">
          <FileClock size={13} />
          Export contains public-safe metadata only — no plaintext amounts or recipient allocations.
        </p>
      </Panel>

      {/* ---------------- launch checklist ---------------- */}
      <Panel className="p-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <span className="font-mono text-[11px] uppercase tracking-wider text-purple-bright">
              Privacy checks
            </span>
            <h2 className="mt-1 text-xl font-semibold text-ink">Launch checklist</h2>
          </div>
          <span className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-mint/25 bg-mint/10 text-mint-bright">
            <Shield size={18} />
          </span>
        </header>

        <ul className="mt-6 grid gap-2.5">
          {CHECKS.map((label) => (
            <li
              key={label}
              className="flex items-center gap-3 rounded-[12px] border border-mint/20 bg-mint/[0.05] px-4 py-3"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-mint/15 text-mint-bright">
                <Check size={14} />
              </span>
              <span className="text-[13px] text-ink-2">{label}</span>
            </li>
          ))}
        </ul>

        <p className="mt-5 text-[12.5px] leading-relaxed text-ink-muted">
          Every distribution passes these checks before launch. Confidentiality is enforced by the
          protocol, not by policy — amounts and the recipient list are encrypted onchain end to end.
        </p>
      </Panel>
    </div>
  );
}
