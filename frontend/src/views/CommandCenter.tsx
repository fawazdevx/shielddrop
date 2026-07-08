import {
  AlertCircle,
  Check,
  Copy,
  Download,
  ExternalLink,
  FileLock2,
  KeyRound,
  Lock,
  Network,
  Pause,
  Plus,
  Send,
  Upload,
  Upload as UploadIcon,
  WalletCards,
  type LucideIcon
} from "lucide-react";
import { campaignTotal, compactAddress, formatUnits, sepoliaTxUrl } from "../lib/format";
import type {
  TokenOpsDistributionResult,
  TokenOpsMode,
  TokenOpsReadiness
} from "../lib/tokenops";
import type { Campaign, CampaignStatus, WrapperPair } from "../lib/types";
import {
  Button,
  EncryptedValue,
  Field,
  Panel,
  StatusBadge,
  cn,
  inputClass,
  type StatusTone
} from "../components/ui";

/* map campaign lifecycle → StatusBadge tone */
function statusTone(status: CampaignStatus): StatusTone {
  switch (status) {
    case "live":
      return "live";
    case "encrypting":
    case "funding":
      return "encrypted";
    case "closed":
      return "paused";
    default:
      return "ready";
  }
}

export function CommandCenter({
  campaign,
  selectedWrapper,
  csvInput,
  invalidRows,
  busyAction,
  tokenOpsReadiness,
  tokenOpsResult,
  distributionMode,
  liveStagingReady,
  liveStagingHint,
  onCsvChange,
  onParseCsv,
  onEncrypt,
  onTokenOpsSync,
  onPreviewTokenOps,
  onDownloadTemplate,
  onCopyClaimLink,
  onNewCampaign,
  onStatusChange,
  onNameChange,
  onModeChange
}: {
  campaign: Campaign;
  selectedWrapper: WrapperPair;
  csvInput: string;
  invalidRows: number;
  busyAction: string | null;
  tokenOpsReadiness: TokenOpsReadiness;
  tokenOpsResult: TokenOpsDistributionResult | null;
  distributionMode: TokenOpsMode;
  liveStagingReady: boolean;
  liveStagingHint: string;
  onCsvChange: (value: string) => void;
  onParseCsv: () => void;
  onEncrypt: () => void;
  onTokenOpsSync: () => void;
  onPreviewTokenOps: () => void;
  onDownloadTemplate: () => void;
  onCopyClaimLink: (url: string, label: string) => void;
  onNewCampaign: () => void;
  onStatusChange: (status: CampaignStatus) => void;
  onNameChange: (name: string) => void;
  onModeChange: (mode: TokenOpsMode) => void;
}) {
  const total = campaignTotal(campaign);
  const hasRecipients = campaign.recipients.length > 0;
  const encrypting = busyAction === "encrypt";
  const liveStaging = busyAction === "tokenops-live";
  const previewing = busyAction === "tokenops-preview";
  const hasLiveEvidence = tokenOpsResult?.runtime === "live" || Boolean(campaign.stageTxHash);

  const steps = [
    {
      icon: WalletCards,
      title: "Choose registry token",
      detail: `${selectedWrapper.symbol} · ${compactAddress(selectedWrapper.confidentialToken)}`,
      done: true,
      active: false
    },
    {
      icon: Upload,
      title: "Load recipients",
      detail: hasRecipients
        ? `${campaign.recipients.length} rows · ${invalidRows} need review`
        : "Import a CSV of wallet, label, amount",
      done: hasRecipients,
      active: false
    },
    {
      icon: FileLock2,
      title: "Encrypt allocations",
      detail: "FHE handles + per-recipient ACL",
      done: campaign.status !== "draft",
      active: campaign.status === "encrypting"
    },
    {
      icon: Send,
      title: "Launch with TokenOps",
      detail: "Operator, funding, claim window",
      done: campaign.status === "live",
      active: campaign.status === "funding"
    }
  ];

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      {/* ---------------- left: workflow + config ---------------- */}
      <Panel className="p-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <span className="font-mono text-[11px] uppercase tracking-wider text-purple-bright">
              Creator workflow
            </span>
            <h2 className="mt-1 text-xl font-semibold text-ink">Distribution command center</h2>
          </div>
          <Button variant="secondary" size="sm" icon={Plus} onClick={onNewCampaign}>
            New campaign
          </Button>
        </header>

        {/* pipeline */}
        <ol className="mt-6 grid gap-2.5">
          {steps.map((s, i) => (
            <WorkflowStep key={s.title} index={i + 1} {...s} />
          ))}
        </ol>

        {/* config */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Field label="Campaign name">
            <input
              className={inputClass}
              value={campaign.name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="My private distribution"
            />
          </Field>
          <Field label="Claim window">
            <input
              className={cn(inputClass, "text-ink-muted")}
              value={`${campaign.claimStart.replace("T", " ")} → ${campaign.claimEnd.replace("T", " ")}`}
              readOnly
            />
          </Field>
          <Field label="Privacy mode" hint="fixed">
            <div className={cn(inputClass, "flex items-center gap-2 text-ink-2")}>
              <Lock size={14} className="text-purple-bright" />
              amounts-and-list-private
            </div>
          </Field>
          <Field label="Launch operator">
            <input className={cn(inputClass, "font-mono text-ink-muted")} value={compactAddress(campaign.tokenOpsOperator)} readOnly />
          </Field>
        </div>

        {/* airdrop / disperse */}
        <div className="mt-5">
          <span className="mb-2 block text-[13px] font-medium text-ink-2">Distribution route</span>
          <div className="grid grid-cols-2 gap-2 rounded-[12px] border border-hairline bg-obsidian-2/50 p-1.5">
            <ModeButton
              icon={Send}
              label="Airdrop"
              sub="Recipients pull"
              active={distributionMode === "confidential-airdrop"}
              onClick={() => onModeChange("confidential-airdrop")}
            />
            <ModeButton
              icon={Network}
              label="Disperse"
              sub="Sender pushes"
              active={distributionMode === "confidential-disperse"}
              onClick={() => onModeChange("confidential-disperse")}
            />
          </div>
        </div>

        <Preflight readiness={tokenOpsReadiness} />

        {/* actions */}
        <div className="mt-6 flex flex-wrap gap-2.5">
          {campaign.status === "live" ? (
            <Button variant="secondary" icon={Pause} onClick={() => onStatusChange("closed")}>
              Close
            </Button>
          ) : null}
          <Button variant="secondary" icon={FileLock2} loading={encrypting} disabled={!hasRecipients} onClick={onEncrypt}>
            {encrypting ? "Encrypting" : "Encrypt batch"}
          </Button>
          <Button
            variant="secondary"
            icon={KeyRound}
            loading={previewing}
            disabled={!hasRecipients || liveStaging || hasLiveEvidence}
            onClick={onPreviewTokenOps}
          >
            {previewing ? "Previewing" : "Preview demo packets"}
          </Button>
          <Button
            icon={Send}
            loading={liveStaging}
            disabled={!hasRecipients || !liveStagingReady || previewing}
            title={liveStagingHint}
            onClick={onTokenOpsSync}
            className="ml-auto"
          >
            {liveStaging ? "Opening wallet" : "Stage live on Sepolia"}
          </Button>
        </div>
        <p className={cn("mt-3 text-[12px]", liveStagingReady ? "text-mint-bright" : "text-amber")}>
          {liveStagingReady
            ? "Live staging is ready. The next click should open wallet prompts for TokenOps transactions."
            : liveStagingHint}
        </p>
        <LiveLaunchProof
          ready={liveStagingReady}
          hint={liveStagingHint}
          result={tokenOpsResult}
          stageTxHash={campaign.stageTxHash}
          claimTxHash={campaign.lastClaimTxHash}
        />
      </Panel>

      {/* ---------------- right: batch + packets ---------------- */}
      <Panel className="p-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <span className="font-mono text-[11px] uppercase tracking-wider text-purple-bright">
              CSV importer
            </span>
            <h2 className="mt-1 text-xl font-semibold text-ink">Private allocation batch</h2>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-purple/10 px-3 py-1.5 font-mono text-[12px] text-purple-bright">
            <Lock size={13} />
            {formatUnits(total)} {campaign.tokenSymbol}
          </span>
        </header>

        <div className="mt-4 flex justify-end">
          <Button variant="ghost" size="sm" icon={Download} onClick={onDownloadTemplate}>
            Download template
          </Button>
        </div>

        <textarea
          className={cn(inputClass, "mt-2 h-40 resize-y font-mono text-[12.5px] leading-relaxed")}
          value={csvInput}
          onChange={(e) => onCsvChange(e.target.value)}
          spellCheck={false}
          aria-label="Recipient CSV"
        />

        <div className="mt-3 flex flex-wrap gap-2.5">
          <Button variant="secondary" icon={UploadIcon} onClick={onParseCsv}>
            Validate CSV
          </Button>
          <Button variant="secondary" icon={KeyRound} loading={encrypting} disabled={!hasRecipients} onClick={onEncrypt}>
            {encrypting ? "Encrypting" : "Encrypt allocations"}
          </Button>
        </div>

        {hasRecipients ? (
          <>
            <RecipientTable campaign={campaign} />
            <BatchProgress campaign={campaign} />
          </>
        ) : (
          <EmptyBatch />
        )}

        <ClaimPackets result={tokenOpsResult} onCopyLink={onCopyClaimLink} />
      </Panel>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function WorkflowStep({
  index,
  icon: Icon,
  title,
  detail,
  done,
  active
}: {
  index: number;
  icon: LucideIcon;
  title: string;
  detail: string;
  done?: boolean;
  active?: boolean;
}) {
  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-[12px] border px-4 py-3 transition-colors",
        done
          ? "border-mint/25 bg-mint/[0.06]"
          : active
            ? "border-purple/40 bg-purple/[0.07]"
            : "border-hairline bg-white/[0.02]"
      )}
    >
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border",
          done
            ? "border-mint/30 bg-mint/10 text-mint-bright"
            : active
              ? "border-purple/40 bg-purple/10 text-purple-bright"
              : "border-hairline bg-white/[0.03] text-ink-muted"
        )}
      >
        {done ? <Check size={17} /> : <Icon size={17} />}
      </span>
      <div className="min-w-0">
        <strong className="flex items-center gap-2 text-[14px] font-medium text-ink">
          <em className="font-mono text-[11px] not-italic text-ink-faint">{String(index).padStart(2, "0")}</em>
          {title}
        </strong>
        <span className="block truncate text-[12px] text-ink-muted">{detail}</span>
      </div>
    </li>
  );
}

function ModeButton({
  icon: Icon,
  label,
  sub,
  active,
  onClick
}: {
  icon: LucideIcon;
  label: string;
  sub: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex items-center gap-2.5 rounded-[9px] px-3.5 py-2.5 text-left transition-colors",
        active ? "bg-purple/15 text-ink ring-1 ring-purple/40" : "text-ink-muted hover:bg-white/[0.04] hover:text-ink"
      )}
    >
      <Icon size={16} className={active ? "text-purple-bright" : ""} />
      <span className="leading-tight">
        <span className="block text-[13px] font-medium">{label}</span>
        <span className="block text-[11px] text-ink-faint">{sub}</span>
      </span>
    </button>
  );
}

function Preflight({ readiness }: { readiness: TokenOpsReadiness }) {
  return (
    <div className="mt-5 rounded-[14px] border border-hairline bg-obsidian-2/50 p-4">
      <div className="flex items-center justify-between">
        <div>
          <span className="font-mono text-[11px] uppercase tracking-wider text-ink-faint">
            Distribution readiness
          </span>
          <strong className="block text-[14px] font-medium text-ink">
            {readiness.mode === "confidential-airdrop" ? "Confidential airdrop" : "Confidential disperse"}
          </strong>
        </div>
        <StatusBadge tone={readiness.runtime === "live" ? "live" : "ready"}>
          {readiness.runtime}
        </StatusBadge>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {readiness.items.map((item) => (
          <div
            key={item.label}
            className={cn(
              "flex items-start gap-2 rounded-[10px] border px-3 py-2",
              item.ok ? "border-mint/20 bg-mint/[0.05]" : "border-amber/25 bg-amber/[0.06]"
            )}
          >
            <span className={cn("mt-0.5 shrink-0", item.ok ? "text-mint-bright" : "text-amber")}>
              {item.ok ? <Check size={14} /> : <AlertCircle size={14} />}
            </span>
            <div className="min-w-0">
              <strong className="block text-[12.5px] font-medium text-ink">{item.label}</strong>
              <span className="block text-[11.5px] text-ink-muted">{item.detail}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LiveLaunchProof({
  ready,
  hint,
  result,
  stageTxHash,
  claimTxHash
}: {
  ready: boolean;
  hint: string;
  result: TokenOpsDistributionResult | null;
  stageTxHash?: string;
  claimTxHash?: string;
}) {
  const setupHref = result?.runtime === "live" ? sepoliaTxUrl(result.setupTxHash) : undefined;
  const stageHref = result?.runtime === "live" ? sepoliaTxUrl(result.txHash ?? stageTxHash) : undefined;
  const claimHref = sepoliaTxUrl(claimTxHash);
  return (
    <div className="mt-4 rounded-[14px] border border-hairline bg-obsidian-2/50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="font-mono text-[11px] uppercase tracking-wider text-ink-faint">
            Judge-visible proof
          </span>
          <strong className="mt-1 block text-[14px] font-medium text-ink">
            {stageHref ? "Live Sepolia transaction captured" : ready ? "Ready for live transaction" : "Live staging blocked"}
          </strong>
        </div>
        <span
          className={cn(
            "rounded-full border px-2.5 py-1 text-[11px] font-medium",
            stageHref
              ? "border-mint/30 bg-mint/10 text-mint-bright"
              : ready
                ? "border-purple/30 bg-purple/10 text-purple-bright"
                : "border-amber/30 bg-amber/10 text-amber"
          )}
        >
          {stageHref ? "Recorded" : ready ? "Wallet next" : "Needs setup"}
        </span>
      </div>
      <p className="mt-2 text-[12px] leading-relaxed text-ink-muted">
        {stageHref
          ? "Use these links in the demo recording and audit export. Demo previews never create this proof."
          : hint}
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <ProofLink label="Operator approval" href={setupHref} fallback={result?.runtime === "live" ? "Not required" : "Waiting"} />
        <ProofLink label="Stage tx" href={stageHref} fallback={ready ? "Click live stage" : "Waiting"} strong />
        <ProofLink label="Latest claim" href={claimHref} fallback="After recipient claim" />
      </div>
    </div>
  );
}

function ProofLink({
  label,
  href,
  fallback,
  strong = false
}: {
  label: string;
  href?: string;
  fallback: string;
  strong?: boolean;
}) {
  return (
    <div className="rounded-[10px] border border-hairline bg-white/[0.02] px-3 py-2.5">
      <span className="block text-[10.5px] uppercase tracking-wide text-ink-faint">{label}</span>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className={cn(
            "mt-1 inline-flex items-center gap-1.5 font-mono text-[11.5px] transition-colors hover:text-mint-bright",
            strong ? "text-mint-bright" : "text-ink-2"
          )}
        >
          View tx
          <ExternalLink size={12} />
        </a>
      ) : (
        <span className="mt-1 block truncate text-[11.5px] text-ink-muted">{fallback}</span>
      )}
    </div>
  );
}

function RecipientTable({ campaign }: { campaign: Campaign }) {
  return (
    <div className="mt-5 overflow-hidden rounded-[12px] border border-hairline">
      <table className="w-full text-left text-[13px]">
        <thead>
          <tr className="border-b border-hairline bg-white/[0.02] text-[11px] uppercase tracking-wide text-ink-faint">
            <th className="px-3.5 py-2.5 font-medium">Recipient</th>
            <th className="px-3.5 py-2.5 font-medium">Allocation</th>
            <th className="hidden px-3.5 py-2.5 font-medium sm:table-cell">Handle</th>
            <th className="px-3.5 py-2.5 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {campaign.recipients.map((r) => (
            <tr key={r.id} className="border-b border-hairline/60 last:border-0">
              <td className="px-3.5 py-3">
                <strong className="block font-medium text-ink">{r.label}</strong>
                <span className="font-mono text-[11px] text-ink-faint">{compactAddress(r.address)}</span>
              </td>
              <td className="px-3.5 py-3">
                <EncryptedValue revealed={r.decrypted} amount={r.amount} symbol={campaign.tokenSymbol} />
              </td>
              <td className="hidden px-3.5 py-3 font-mono text-[11px] text-ink-muted sm:table-cell">
                {r.encryptedHandle}
              </td>
              <td className="px-3.5 py-3">
                <RowStatus claimed={r.claimed} risk={r.risk} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RowStatus({ claimed, risk }: { claimed: boolean; risk: string }) {
  if (claimed) return <StatusBadge tone="claimed" />;
  if (risk !== "clear")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber/30 bg-amber/10 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-amber">
        <AlertCircle size={11} />
        {risk}
      </span>
    );
  return <StatusBadge tone="ready" />;
}

function BatchProgress({ campaign }: { campaign: Campaign }) {
  const total = campaign.recipients.length;
  const claimed = campaign.recipients.filter((r) => r.claimed).length;
  const decrypted = campaign.recipients.filter((r) => r.decrypted).length;
  const rate = total ? Math.round((claimed / total) * 100) : 0;

  return (
    <div className="mt-5">
      <div className="flex items-center justify-between text-[12px]">
        <span className="font-mono uppercase tracking-wider text-ink-faint">Claim progress</span>
        <span className="font-mono text-ink-2">
          {claimed}/{total} claimed
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,#7c3aed,#c084fc)] transition-[width] duration-500"
          style={{ width: `${rate}%` }}
        />
      </div>
      <div className="mt-2 flex justify-between text-[11.5px] text-ink-muted">
        <span>{decrypted} decrypted</span>
        <span>{total - claimed} pending</span>
      </div>
    </div>
  );
}

function EmptyBatch() {
  return (
    <div className="mt-5 flex flex-col items-center gap-2 rounded-[12px] border border-dashed border-hairline bg-white/[0.015] px-4 py-8 text-center">
      <Upload size={20} className="text-ink-faint" />
      <strong className="text-[14px] font-medium text-ink-2">No recipients loaded yet</strong>
      <span className="max-w-xs text-[12.5px] text-ink-muted">
        Paste or edit the CSV above, then <span className="text-ink-2">Validate CSV</span> to stage the batch.
      </span>
    </div>
  );
}

function ClaimPackets({
  result,
  onCopyLink
}: {
  result: TokenOpsDistributionResult | null;
  onCopyLink: (url: string, label: string) => void;
}) {
  if (!result) {
    return (
      <div className="mt-5 flex items-center gap-2.5 rounded-[12px] border border-hairline bg-white/[0.02] px-4 py-3.5 text-[12.5px] text-ink-muted">
        <KeyRound size={16} className="text-ink-faint" />
        Preview demo packets, or connect Sepolia and stage live to generate wallet-backed claim packets.
      </div>
    );
  }

  const txHref = result.runtime === "live" ? sepoliaTxUrl(result.txHash) : undefined;

  return (
    <div className="mt-5 rounded-[14px] border border-purple/25 bg-purple/[0.05] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div>
          <span className="font-mono text-[11px] uppercase tracking-wider text-purple-bright">
            Recipient delivery
          </span>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-purple/30 bg-purple/10 px-2.5 py-1 text-[11px] font-medium text-purple-bright">
              {result.claimPackets.length} packets
            </span>
            <span
              className={cn(
                "rounded-full border px-2.5 py-1 text-[11px] font-medium",
                result.runtime === "live"
                  ? "border-mint/30 bg-mint/10 text-mint-bright"
                  : "border-amber/30 bg-amber/10 text-amber"
              )}
            >
              {result.runtime === "live" ? "Live Sepolia" : "Demo preview"}
            </span>
          </div>
        </div>
        {txHref ? (
          <a
            href={txHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-[9px] border border-mint/30 bg-mint/10 px-3 py-2 text-[12px] font-medium text-mint-bright transition-colors hover:bg-mint/15"
          >
            View Sepolia tx
            <ExternalLink size={13} />
          </a>
        ) : result.txHash ? (
          <span className="font-mono text-[11px] text-ink-faint">demo id {compactAddress(result.txHash, 6)}</span>
        ) : null}
      </div>
      <div className="mt-3 grid gap-2">
        {result.claimPackets.map((p) => (
          <div
            key={p.recipientId}
            className="flex items-center justify-between gap-3 rounded-[10px] border border-hairline bg-obsidian-2/40 px-3.5 py-2.5"
          >
            <div className="min-w-0">
              <strong className="block truncate text-[13px] font-medium text-ink">{p.label}</strong>
              <span className="font-mono text-[11px] text-ink-faint">{compactAddress(p.recipient)}</span>
            </div>
            <Button variant="ghost" size="sm" icon={Copy} onClick={() => onCopyLink(p.deliveryUrl, p.label)}>
              Copy link
            </Button>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11.5px] leading-relaxed text-ink-muted">
        Share each link privately with its recipient. The URL carries only the encrypted handle — no plaintext amount is visible.
      </p>
    </div>
  );
}
