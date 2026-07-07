import { Check, ChevronDown, Eye, KeyRound, Lock, Send, Wallet } from "lucide-react";
import { useMemo } from "react";
import { claimRate, compactAddress } from "../lib/format";
import type { Address, Campaign, Recipient } from "../lib/types";
import { Button, EncryptedValue, Panel, StatusBadge, cn } from "../components/ui";

type StepStatus = "done" | "active" | "pending";

export function ClaimDesk({
  campaign,
  recipient,
  busyAction,
  connectedAccount,
  runtime,
  onRecipientSelect,
  onDecrypt,
  onClaim
}: {
  campaign: Campaign;
  recipient: Recipient;
  busyAction: string | null;
  connectedAccount?: Address;
  runtime: "demo" | "live";
  onRecipientSelect: (id: string) => void;
  onDecrypt: (recipient: Recipient) => void;
  onClaim: (recipient: Recipient) => void;
}) {
  // With a wallet connected, the recipient is locked to that address — nobody
  // can view another person's allocation. Without a wallet the demo stays
  // explorable via the dropdown.
  const matched = connectedAccount
    ? campaign.recipients.find((item) => item.address.toLowerCase() === connectedAccount.toLowerCase())
    : recipient;
  const gated = Boolean(connectedAccount);
  const active = matched ?? recipient;

  const steps = useMemo(
    () =>
      [
        { id: "connect", label: connectedAccount ? "Wallet connected" : "Connect wallet", status: (connectedAccount ? "done" : "active") as StepStatus },
        { id: "verify", label: "Eligibility verified", status: (matched ? "done" : gated ? "pending" : "done") as StepStatus },
        { id: "decrypt", label: "EIP-712 decrypt", status: (active?.decrypted ? "done" : "active") as StepStatus },
        { id: "claim", label: "Confidential claim", status: (active?.claimed ? "done" : active?.decrypted ? "active" : "pending") as StepStatus }
      ],
    [active, matched, gated, connectedAccount]
  );

  const decrypting = busyAction === `decrypt-${active?.id}`;
  const claiming = busyAction === `claim-${active?.id}`;

  /* wallet connected but not a recipient */
  if (gated && !matched) {
    return (
      <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <Panel className="p-6">
          <ClaimHeader />
          <div className="mt-8 flex flex-col items-center gap-3 rounded-[14px] border border-dashed border-hairline bg-white/[0.015] px-6 py-12 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full border border-hairline bg-white/[0.03] text-ink-muted">
              <Lock size={22} />
            </span>
            <strong className="text-[15px] font-semibold text-ink">
              No allocation for {compactAddress(connectedAccount!)}
            </strong>
            <span className="max-w-sm text-[13px] leading-relaxed text-ink-muted">
              This wallet is not a recipient in this campaign. Only eligible wallets can decrypt an
              allocation — that's the point.
            </span>
          </div>
        </Panel>
        <PublicStatus campaign={campaign} />
      </div>
    );
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
      {/* ---------------- recipient panel ---------------- */}
      <Panel className="p-6">
        <div className="flex items-start justify-between gap-4">
          <ClaimHeader />
          {gated ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-white/[0.03] px-3 py-1.5 font-mono text-[12px] text-ink-2">
              <Wallet size={13} className="text-purple-bright" />
              {compactAddress(connectedAccount!)}
            </span>
          ) : (
            <div className="relative">
              <select
                value={active?.id}
                onChange={(e) => onRecipientSelect(e.target.value)}
                className="appearance-none rounded-[10px] border border-hairline bg-obsidian-2/70 py-2 pl-3.5 pr-9 text-[13px] text-ink outline-none transition-colors focus:border-purple/50"
                aria-label="Select recipient (demo)"
              >
                {campaign.recipients.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint" />
            </div>
          )}
        </div>

        {/* the reveal — only you can see this */}
        <div
          className={cn(
            "mt-6 rounded-[16px] border p-6 transition-colors duration-500",
            active?.decrypted
              ? "border-mint/30 bg-mint/[0.05]"
              : "border-purple/25 bg-[radial-gradient(120%_120%_at_50%_-20%,rgba(157,92,255,0.12),transparent_70%)]"
          )}
        >
          <span className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-ink-muted">
            <Eye size={13} className={active?.decrypted ? "text-mint-bright" : "text-purple-bright"} />
            Private allocation · only you can see this
          </span>
          <div className="mt-5 flex min-h-[76px] items-center">
            <EncryptedValue
              revealed={!!active?.decrypted}
              amount={active?.amount ?? 0n}
              symbol={campaign.tokenSymbol}
              size="hero"
            />
          </div>
          <div className="mt-4 font-mono text-[11px] text-ink-faint">{active?.encryptedHandle}</div>
        </div>

        {/* step tracker */}
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {steps.map((s) => (
            <StepPill key={s.id} label={s.label} status={s.status} />
          ))}
        </div>

        {/* actions */}
        <div className="mt-6 flex flex-wrap gap-2.5">
          <Button
            variant="secondary"
            icon={active?.decrypted ? Check : Eye}
            loading={decrypting}
            disabled={!active || active.decrypted || decrypting}
            onClick={() => onDecrypt(active)}
          >
            {decrypting ? "Decrypting" : active?.decrypted ? "Decrypted" : runtime === "live" ? "Decrypt onchain" : "Decrypt my allocation"}
          </Button>
          <Button
            icon={active?.claimed ? Check : Send}
            loading={claiming}
            disabled={!active || active.claimed || !active.decrypted || claiming}
            onClick={() => onClaim(active)}
            className="ml-auto"
          >
            {active?.claimed ? "Claimed" : claiming ? "Claiming" : "Claim confidentially"}
          </Button>
        </div>
        {!active?.decrypted && (
          <p className="mt-3 flex items-center gap-1.5 text-[12px] text-ink-faint">
            <KeyRound size={12} />
            Decrypt first — your amount never leaves your wallet in plaintext.
          </p>
        )}
      </Panel>

      {/* ---------------- public-safe status ---------------- */}
      <PublicStatus campaign={campaign} withTable />
    </div>
  );
}

function ClaimHeader() {
  return (
    <div>
      <span className="font-mono text-[11px] uppercase tracking-wider text-purple-bright">
        Recipient experience
      </span>
      <h2 className="mt-1 text-xl font-semibold text-ink">Claim confidential allocation</h2>
    </div>
  );
}

function StepPill({ label, status }: { label: string; status: StepStatus }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-[10px] border px-3 py-2.5 text-[12px] font-medium",
        status === "done"
          ? "border-mint/25 bg-mint/[0.06] text-mint-bright"
          : status === "active"
            ? "border-purple/40 bg-purple/[0.08] text-purple-bright"
            : "border-hairline bg-white/[0.02] text-ink-faint"
      )}
    >
      <span className="shrink-0">
        {status === "done" ? <Check size={14} /> : <Lock size={14} />}
      </span>
      <span className="leading-tight">{label}</span>
    </div>
  );
}

function PublicStatus({ campaign, withTable = false }: { campaign: Campaign; withTable?: boolean }) {
  const rate = claimRate(campaign);
  return (
    <Panel className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="font-mono text-[11px] uppercase tracking-wider text-purple-bright">
            Public-safe status
          </span>
          <h2 className="mt-1 text-xl font-semibold text-ink">Campaign progress</h2>
        </div>
        <span className="rounded-full border border-hairline bg-white/[0.03] px-3 py-1.5 font-mono text-[12px] text-ink-2">
          {rate}%
        </span>
      </div>

      <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,#7c3aed,#c084fc)] transition-[width] duration-500"
          style={{ width: `${rate}%` }}
        />
      </div>
      <p className="mt-3 text-[12.5px] leading-relaxed text-ink-muted">
        Observers see only the claim rate and event trail — never the encrypted amounts.
      </p>

      {withTable && <PublicRecipientTable campaign={campaign} />}
    </Panel>
  );
}

/** Public view: every amount stays masked unless that row was decrypted by its owner. */
function PublicRecipientTable({ campaign }: { campaign: Campaign }) {
  return (
    <div className="mt-5 overflow-hidden rounded-[12px] border border-hairline">
      <table className="w-full text-left text-[13px]">
        <thead>
          <tr className="border-b border-hairline bg-white/[0.02] text-[11px] uppercase tracking-wide text-ink-faint">
            <th className="px-3.5 py-2.5 font-medium">Recipient</th>
            <th className="px-3.5 py-2.5 font-medium">Allocation</th>
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
              <td className="px-3.5 py-3">
                <StatusBadge tone={r.claimed ? "claimed" : "ready"} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
