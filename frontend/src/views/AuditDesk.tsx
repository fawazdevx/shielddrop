import { AlertCircle, Check, Download, ExternalLink, FileClock, Shield } from "lucide-react";
import { auditTrail } from "../lib/constants";
import { compactAddress, sepoliaTxUrl } from "../lib/format";
import type { TokenOpsDistributionResult, TokenOpsReadiness } from "../lib/tokenops";
import type { Campaign } from "../lib/types";
import { Button, Panel, cn } from "../components/ui";

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
  const stageTxHash = tokenOpsResult?.runtime === "live" ? tokenOpsResult.txHash : campaign.stageTxHash;
  const setupTxHash = tokenOpsResult?.runtime === "live" ? tokenOpsResult.setupTxHash : undefined;
  const stageTxHref = sepoliaTxUrl(stageTxHash);
  const setupTxHref = sepoliaTxUrl(setupTxHash);
  const claimProofs = campaign.recipients
    .map((recipient) => ({
      id: recipient.id,
      label: recipient.label,
      hash: recipient.claimTxHash,
      href: sepoliaTxUrl(recipient.claimTxHash)
    }))
    .filter((proof) => proof.href);
  const invalidRows = campaign.recipients.filter((recipient) => recipient.risk !== "clear").length;
  const checks = [
    {
      label: "Recipients validated before launch",
      done: campaign.recipients.length > 0 && invalidRows === 0,
      detail: `${campaign.recipients.length} recipients · ${invalidRows} issues`
    },
    {
      label: "TokenOps route is ready",
      done: tokenOpsReadiness.ready,
      detail: `${tokenOpsReadiness.mode} · ${tokenOpsReadiness.runtime}`
    },
    {
      label: "Live Sepolia staging transaction captured",
      done: Boolean(stageTxHref),
      detail: stageTxHash ? compactAddress(stageTxHash, 6) : "Stage live on Sepolia"
    },
    {
      label: "Recipient claim packets generated",
      done: Boolean(tokenOpsResult?.claimPackets.length),
      detail: tokenOpsResult ? `${tokenOpsResult.claimPackets.length} packets` : "Not staged"
    },
    {
      label: "At least one recipient claim transaction captured",
      done: claimProofs.length > 0,
      detail: claimProofs.length ? `${claimProofs.length} claim tx` : "Claim from recipient wallet"
    }
  ];
  const evidence = [
    { label: "Distribution route", value: tokenOpsReadiness.mode === "confidential-airdrop" ? "Private airdrop" : "Bulk payout" },
    { label: "Network", value: "Sepolia" },
    { label: "Runtime", value: tokenOpsResult?.runtime ?? tokenOpsReadiness.runtime },
    { label: "Registry token", value: campaign.tokenSymbol },
    { label: "Recipients", value: String(campaign.recipients.length) },
    { label: "Claim packets", value: tokenOpsResult ? String(tokenOpsResult.claimPackets.length) : "not staged" },
    { label: "Stage tx", value: stageTxHash ? compactAddress(stageTxHash, 6) : "not captured" },
    { label: "Claim txs", value: String(claimProofs.length) },
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

        <ProofLinks
          stageTxHref={stageTxHref}
          setupTxHref={setupTxHref}
          claimProofs={claimProofs}
        />
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
          {checks.map((check) => (
            <li
              key={check.label}
              className={cn(
                "flex items-center gap-3 rounded-[12px] border px-4 py-3",
                check.done ? "border-mint/20 bg-mint/[0.05]" : "border-amber/25 bg-amber/[0.06]"
              )}
            >
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                  check.done ? "bg-mint/15 text-mint-bright" : "bg-amber/10 text-amber"
                )}
              >
                {check.done ? <Check size={14} /> : <AlertCircle size={14} />}
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] text-ink-2">{check.label}</span>
                <span className="block truncate text-[11.5px] text-ink-muted">{check.detail}</span>
              </span>
            </li>
          ))}
        </ul>

        <p className="mt-5 text-[12.5px] leading-relaxed text-ink-muted">
          Record the demo when the live staging and at least one recipient claim item are green.
          Confidentiality is enforced by the protocol, not by policy — amounts stay encrypted while
          the submission still has verifiable public transaction evidence.
        </p>
      </Panel>
    </div>
  );
}

function ProofLinks({
  stageTxHref,
  setupTxHref,
  claimProofs
}: {
  stageTxHref?: string;
  setupTxHref?: string;
  claimProofs: Array<{ id: string; label: string; hash?: string; href?: string }>;
}) {
  return (
    <div className="mt-5 rounded-[14px] border border-hairline bg-obsidian-2/50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="font-mono text-[11px] uppercase tracking-wider text-purple-bright">
            Sepolia proof links
          </span>
          <h3 className="mt-1 text-[15px] font-semibold text-ink">Submission evidence</h3>
        </div>
        <span
          className={cn(
            "rounded-full border px-2.5 py-1 text-[11px] font-medium",
            stageTxHref ? "border-mint/30 bg-mint/10 text-mint-bright" : "border-amber/30 bg-amber/10 text-amber"
          )}
        >
          {stageTxHref ? "Live proof" : "No live tx"}
        </span>
      </div>

      <div className="mt-3 grid gap-2">
        <AuditTxLink label="Operator approval" href={setupTxHref} fallback="Not required or not captured" />
        <AuditTxLink label="Stage distribution" href={stageTxHref} fallback="Stage live on Sepolia to capture this" />
        {claimProofs.length ? (
          claimProofs.map((proof) => (
            <AuditTxLink key={proof.id} label={`${proof.label} claim`} href={proof.href} fallback={compactAddress(proof.hash ?? "")} />
          ))
        ) : (
          <AuditTxLink label="Recipient claim" fallback="Decrypt and claim from a recipient wallet" />
        )}
      </div>
    </div>
  );
}

function AuditTxLink({ label, href, fallback }: { label: string; href?: string; fallback: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[10px] border border-hairline bg-white/[0.02] px-3 py-2.5">
      <span className="min-w-0">
        <span className="block text-[12.5px] font-medium text-ink-2">{label}</span>
        <span className="block truncate font-mono text-[11px] text-ink-faint">
          {href ? href.slice(href.lastIndexOf("/") + 1) : fallback}
        </span>
      </span>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-[8px] border border-mint/30 bg-mint/10 px-2.5 py-1.5 text-[11.5px] font-medium text-mint-bright transition-colors hover:bg-mint/15"
        >
          Etherscan
          <ExternalLink size={12} />
        </a>
      ) : null}
    </div>
  );
}
