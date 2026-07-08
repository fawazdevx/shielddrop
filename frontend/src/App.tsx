import {
  BadgeCheck,
  ClipboardCheck,
  KeyRound,
  Lock,
  Network,
  RefreshCw,
  Wallet,
  WalletCards
} from "lucide-react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Hex } from "viem";
import { Landing } from "./components/Landing";
import {
  IconButton,
  Spinner,
  Stat,
  StatusBadge as ToneBadge,
  Surface,
  ToastStack,
  cn,
  type StatusTone,
  type Toast,
  type ToastTone
} from "./components/ui";
import { auditTrail, csvTemplate, initialCampaign, metrics, sampleCsv, wrapperPairs, ZERO_ADDRESS } from "./lib/constants";
import { buildAuditExport, campaignTotal, claimRate, compactAddress, downloadText, formatUnits, isAddress, parseRecipientsCsv } from "./lib/format";
import {
  TokenOpsSdkAdapter,
  type TokenOpsAdapter,
  type TokenOpsDistributionResult,
  type TokenOpsMode,
  type TokenOpsReadiness
} from "./lib/tokenops";
import type { Address, Campaign, CampaignStatus, Recipient, WrapperPair } from "./lib/types";
import { useDistributionRuntime, type ClaimContext, type RuntimeStatus } from "./lib/useDistributionRuntime";
import { createZamaClient } from "./lib/zama";
import { CommandCenter } from "./views/CommandCenter";
import { ClaimDesk } from "./views/ClaimDesk";
import { RegistryDesk } from "./views/RegistryDesk";
import { AuditDesk } from "./views/AuditDesk";

const zama = createZamaClient();
const CLAIM_SESSION_STORAGE_KEY = "shielddrop:last-claim-session";

type StoredRecipient = Omit<Recipient, "amount"> & { amount: string };
type StoredCampaign = Omit<Campaign, "recipients"> & { recipients: StoredRecipient[] };
type StoredClaimSession = {
  campaign: StoredCampaign;
  tokenOpsResult: TokenOpsDistributionResult;
  savedAt: string;
};

function App() {
  const [entered, setEntered] = useState(false);
  const [campaign, setCampaign] = useState<Campaign>(initialCampaign);
  const [activeView, setActiveView] = useState<"command" | "claim" | "registry" | "audit">("command");
  const [selectedWrapper, setSelectedWrapper] = useState<WrapperPair>(wrapperPairs[1]);
  const [csvInput, setCsvInput] = useState(sampleCsv);
  const [selectedRecipientId, setSelectedRecipientId] = useState(campaign.recipients[1]?.id ?? "");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [tokenOpsResult, setTokenOpsResult] = useState<TokenOpsDistributionResult | null>(null);
  const [distributionMode, setDistributionMode] = useState<TokenOpsMode>("confidential-airdrop");
  const [claimLinkContext, setClaimLinkContext] = useState<{ recipient: Address; context: ClaimContext } | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastSeq = useRef(0);
  const greeted = useRef(false);
  const runtime = useDistributionRuntime(distributionMode);
  const tokenOps = runtime.tokenOps;

  /** Build the live decrypt/claim context for a recipient from the staged packets. */
  function claimContextFor(recipient: Recipient): ClaimContext | undefined {
    if (tokenOpsResult?.airdropAddress) {
      const packet = tokenOpsResult.claimPackets.find((item) => item.recipientId === recipient.id);
      if (packet) return {
        airdropAddress: (packet.airdropAddress ?? tokenOpsResult.airdropAddress) as Address,
        encryptedInput: packet.encryptedInput,
        signature: packet.signature
      };
    }
    if (claimLinkContext?.recipient.toLowerCase() === recipient.address.toLowerCase()) {
      return claimLinkContext.context;
    }
    return undefined;
  }

  function pushToast(message: string, tone: ToastTone = "info") {
    const id = toastSeq.current++;
    setToasts((current) => [...current, { id, message, tone }]);
    window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 4600);
  }

  function dismissToast(id: number) {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }

  useEffect(() => {
    if (entered && !greeted.current) {
      greeted.current = true;
      pushToast("Connect a Sepolia wallet to launch or claim a private distribution.", "info");
    }
  }, [entered]);

  // Parse claim URL params so copied delivery links work after reload.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const recipientAddr = params.get("recipient");
    if (!recipientAddr || !isAddress(recipientAddr)) return;

    const handle = params.get("handle");
    const inputProof = params.get("proof") ?? params.get("inputProof");
    const signature = params.get("sig") ?? params.get("signature");
    const airdropAddress = params.get("airdrop") ?? params.get("airdropAddress");
    const fullPacket =
      isAddress(airdropAddress ?? "") &&
      isHexString(handle) &&
      isHexString(inputProof) &&
      isHexString(signature) &&
      signature.length >= 130;

    const syntheticId = `claim-${recipientAddr.toLowerCase()}`;
    const storedSession = loadClaimSession();
    const sourceCampaign = storedSession?.campaign ?? campaign;
    const existing = sourceCampaign.recipients.find((item) => item.address.toLowerCase() === recipientAddr.toLowerCase());

    setEntered(true);
    setActiveView("claim");
    setSelectedRecipientId(existing?.id ?? syntheticId);

    if (storedSession) {
      setCampaign(sourceCampaign);
      setTokenOpsResult(storedSession.tokenOpsResult);
    } else if (!existing) {
      setCampaign((current) => ({
        ...current,
        recipients: [
          {
            id: syntheticId,
            address: recipientAddr,
            label: "Claim link recipient",
            amount: 0n,
            encryptedHandle: handle ?? "claim-link",
            claimed: false,
            decrypted: false,
            risk: "clear"
          },
          ...current.recipients
        ]
      }));
    }

    if (fullPacket) {
      setClaimLinkContext({
        recipient: recipientAddr,
        context: {
          airdropAddress: airdropAddress as Address,
          encryptedInput: {
            handle: handle as Hex,
            inputProof: inputProof as Hex
          },
          signature: signature as Hex
        }
      });
      pushToast(`Claim link loaded for ${existing?.label ?? compactAddress(recipientAddr)}.`, "private");
    } else if (storedSession && existing) {
      pushToast(`Claim link restored for ${existing.label}.`, "private");
    } else {
      pushToast("Claim link opened, but it does not contain a complete encrypted claim packet.", "warn");
    }

    window.history.replaceState({}, "", window.location.pathname);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedRecipient = campaign.recipients.find((recipient) => recipient.id === selectedRecipientId) ?? campaign.recipients[0];
  const total = campaignTotal(campaign);
  const claimed = campaign.recipients.filter((recipient) => recipient.claimed).length;
  const invalidRows = campaign.recipients.filter((recipient) => recipient.risk !== "clear").length;
  const tokenOpsReadiness = useMemo(
    () =>
      tokenOps.getReadiness({
        name: campaign.name,
        tokenAddress: campaign.tokenAddress,
        tokenSymbol: campaign.tokenSymbol,
        recipients: campaign.recipients
      }),
    [campaign.name, campaign.tokenAddress, campaign.tokenSymbol, campaign.recipients, tokenOps]
  );
  const liveStagingReady = runtime.runtime === "live" && tokenOpsReadiness.runtime === "live" && tokenOpsReadiness.ready;
  const liveStagingHint =
    tokenOpsReadiness.runtime === "live" && !tokenOpsReadiness.ready
      ? `Resolve readiness blockers first: ${tokenOpsReadiness.blockers.join(", ")}.`
      : runtime.status === "live"
        ? "Ready to open your wallet and stage a live Sepolia distribution."
        : runtime.status === "initializing"
          ? "Wait for the Zama relayer to finish initializing, then stage live."
          : runtime.status === "error"
            ? "The Zama relayer failed to initialize. Fix relayer/RPC setup before staging live."
            : "Connect a Sepolia wallet to stage a live TokenOps transaction.";

  async function handleParseCsv() {
    const recipients = parseRecipientsCsv(csvInput);
    setCampaign((current) => ({ ...current, recipients, status: "draft" }));
    setTokenOpsResult(null);
    setSelectedRecipientId(recipients[0]?.id ?? "");
    const issues = recipients.filter((recipient) => recipient.risk !== "clear").length;
    pushToast(`${recipients.length} recipients loaded · ${issues} need review.`, issues ? "info" : "success");
  }

  async function handleEncrypt() {
    setBusyAction("encrypt");
    setCampaign((current) => ({ ...current, status: "encrypting" }));
    const encrypted = await zama.encryptAllocations(campaign.contractAddress ?? ZERO_ADDRESS, campaign.recipients);
    setCampaign((current) => ({ ...current, recipients: encrypted, status: "funding" }));
    pushToast("Allocations encrypted and ACL-ready for recipient decryption.", "private");
    setBusyAction(null);
  }

  async function stageDistribution(
    adapter: TokenOpsAdapter,
    busyKey: "tokenops-live" | "tokenops-preview",
    expectedRuntime: "live" | "demo"
  ) {
    setBusyAction(busyKey);
    try {
      const result = await adapter.createDistribution({
        name: campaign.name,
        tokenAddress: campaign.tokenAddress,
        tokenSymbol: campaign.tokenSymbol,
        recipients: campaign.recipients
      });
      if (result.runtime !== expectedRuntime) {
        throw new Error(
          expectedRuntime === "live"
            ? "Live staging was not ready. Connect Sepolia wallet and wait for Live · Sepolia."
            : "Demo preview unexpectedly entered live mode."
        );
      }
      const packetsByRecipient = new Map(result.claimPackets.map((packet) => [packet.recipientId, packet]));
      const stagedRecipients = campaign.recipients.map((recipient) => {
        const packet = packetsByRecipient.get(recipient.id);
        return {
          ...recipient,
          encryptedHandle: packet?.encryptedInput.handle ?? recipient.encryptedHandle,
          claimed: result.runtime === "live" ? false : recipient.claimed,
          decrypted: result.runtime === "live" ? false : recipient.decrypted,
          claimTxHash: result.runtime === "live" ? undefined : recipient.claimTxHash
        };
      });
      const launchedCampaign: Campaign = {
        ...campaign,
        tokenOpsOperator: result.operator as Address,
        status: result.runtime === "live" ? "live" : "funding",
        contractAddress: (result.airdropAddress ?? campaign.contractAddress) as Address,
        recipients: stagedRecipients,
        stageTxHash: result.runtime === "live" ? result.txHash : undefined,
        lastClaimTxHash: undefined,
        txHash: result.runtime === "live" ? result.txHash : undefined
      };
      setTokenOpsResult(result);
      setCampaign(launchedCampaign);
      saveClaimSession(launchedCampaign, result);
      const where = result.runtime === "live" ? "onchain on Sepolia" : "as demo preview packets";
      pushToast(
        `Private ${result.mode.replace("confidential-", "")} staged ${where} · ${result.claimPackets.length} claim packets.`,
        "success"
      );
    } catch (error) {
      pushToast(decodeError(error, "Staging was cancelled or failed."), "warn");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleTokenOpsSync() {
    if (!liveStagingReady) {
      pushToast(liveStagingHint, "warn");
      return;
    }
    await stageDistribution(tokenOps, "tokenops-live", "live");
  }

  async function handlePreviewTokenOpsSync() {
    if (campaign.status === "live") {
      pushToast("This campaign already has live Sepolia evidence. Start a new campaign to preview demo packets.", "warn");
      return;
    }
    const demoTokenOps = new TokenOpsSdkAdapter({ mode: distributionMode });
    await stageDistribution(demoTokenOps, "tokenops-preview", "demo");
  }

  async function handleDecrypt(recipient: Recipient) {
    setBusyAction(`decrypt-${recipient.id}`);
    try {
      const amount = await runtime.revealAllocation(recipient, claimContextFor(recipient));
      setCampaign((current) => ({
        ...current,
        recipients: current.recipients.map((item) =>
          item.id === recipient.id ? { ...item, decrypted: true, amount } : item
        )
      }));
      const suffix = runtime.runtime === "live" ? " · onchain" : "";
      pushToast(
        `Decrypted for ${compactAddress(recipient.address)} · ${formatUnits(amount)} ${campaign.tokenSymbol}${suffix}.`,
        "private"
      );
    } catch (error) {
      pushToast(decodeError(error, "Decryption was cancelled or failed."), "warn");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleClaim(recipient: Recipient) {
    setBusyAction(`claim-${recipient.id}`);
    try {
      const hash = await runtime.submitClaim(claimContextFor(recipient));
      setCampaign((current) => ({
        ...current,
        recipients: current.recipients.map((item) =>
          item.id === recipient.id
            ? {
                ...item,
                claimed: true,
                decrypted: true,
                claimTxHash: runtime.runtime === "live" ? hash : item.claimTxHash
              }
            : item
        ),
        lastClaimTxHash: runtime.runtime === "live" ? hash : current.lastClaimTxHash,
        txHash: runtime.runtime === "live" ? hash : current.txHash
      }));
      if (runtime.runtime === "live") {
        pushToast(`Claim submitted onchain · ${compactAddress(hash, 8)} — no plaintext amount is visible.`, "success");
      } else {
        pushToast(`${compactAddress(recipient.address)} claimed confidentially — public observers see nothing.`, "success");
      }
    } catch (error) {
      pushToast(decodeError(error, "Claim was cancelled or failed."), "warn");
    } finally {
      setBusyAction(null);
    }
  }

  function handleWrapperSelect(wrapper: WrapperPair) {
    setSelectedWrapper(wrapper);
    setTokenOpsResult(null);
    setCampaign((current) => ({
      ...current,
      tokenSymbol: wrapper.symbol,
      tokenAddress: wrapper.confidentialToken,
      underlyingAddress: wrapper.underlyingToken,
      wrapperName: wrapper.name,
      status: "draft"
    }));
    pushToast(`${wrapper.symbol} selected from the official Zama Sepolia registry.`, "success");
  }

  function handleNewCampaign() {
    setTokenOpsResult(null);
    setClaimLinkContext(null);
    setCsvInput(csvTemplate);
    setSelectedRecipientId("");
    setCampaign({
      ...initialCampaign,
      id: `shielddrop-${Date.now().toString(16)}`,
      name: "Untitled Private Distribution",
      description: "Private token distribution prepared from a fresh recipient CSV.",
      tokenSymbol: selectedWrapper.symbol,
      tokenAddress: selectedWrapper.confidentialToken,
      underlyingAddress: selectedWrapper.underlyingToken,
      wrapperName: selectedWrapper.name,
      status: "draft",
      recipients: [],
      contractAddress: undefined,
      stageTxHash: undefined,
      lastClaimTxHash: undefined,
      txHash: undefined
    });
    pushToast("New campaign draft started.", "info");
  }

  function handleModeChange(mode: TokenOpsMode) {
    setDistributionMode(mode);
    setTokenOpsResult(null);
    pushToast(`${mode === "confidential-airdrop" ? "Airdrop" : "Disperse"} route selected.`, "info");
  }

  function handleExport() {
    downloadText("shielddrop-audit.csv", buildAuditExport(campaign, tokenOpsReadiness, tokenOpsResult));
    pushToast("Audit export generated with public-safe metadata.", "success");
  }

  function handleDownloadTemplate() {
    downloadText("shielddrop-template.csv", csvTemplate);
    pushToast("CSV template downloaded — fill in wallet, label, and amount columns.", "info");
  }

  function handleCopyClaimLink(url: string, label: string) {
    navigator.clipboard.writeText(url).then(
      () => pushToast(`Claim link copied for ${label} — share privately.`, "private"),
      () => pushToast("Clipboard access denied. Copy the link manually.", "warn")
    );
  }

  if (!entered) {
    return <Landing onLaunch={() => setEntered(true)} />;
  }

  const view = {
    command: (
      <CommandCenter
        campaign={campaign}
        selectedWrapper={selectedWrapper}
        csvInput={csvInput}
        invalidRows={invalidRows}
        busyAction={busyAction}
        tokenOpsReadiness={tokenOpsReadiness}
        tokenOpsResult={tokenOpsResult}
        distributionMode={distributionMode}
        liveStagingReady={liveStagingReady}
        liveStagingHint={liveStagingHint}
        onCsvChange={setCsvInput}
        onParseCsv={handleParseCsv}
        onEncrypt={handleEncrypt}
        onTokenOpsSync={handleTokenOpsSync}
        onPreviewTokenOps={handlePreviewTokenOpsSync}
        onDownloadTemplate={handleDownloadTemplate}
        onCopyClaimLink={handleCopyClaimLink}
        onNewCampaign={handleNewCampaign}
        onStatusChange={(status) => setCampaign((current) => ({ ...current, status }))}
        onNameChange={(name) => setCampaign((current) => ({ ...current, name }))}
        onModeChange={handleModeChange}
      />
    ),
    claim: (
      <ClaimDesk
        campaign={campaign}
        recipient={selectedRecipient}
        busyAction={busyAction}
        connectedAccount={runtime.account}
        runtime={runtime.runtime}
        onRecipientSelect={setSelectedRecipientId}
        onDecrypt={handleDecrypt}
        onClaim={handleClaim}
      />
    ),
    registry: <RegistryDesk selectedWrapper={selectedWrapper} onSelect={handleWrapperSelect} />,
    audit: <AuditDesk campaign={campaign} tokenOpsReadiness={tokenOpsReadiness} tokenOpsResult={tokenOpsResult} onExport={handleExport} />
  }[activeView];

  return (
    <Surface>
      <div className="mx-auto flex min-h-screen max-w-[1500px]">
        {/* ---------------- sidebar ---------------- */}
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-6 border-r border-hairline bg-obsidian-2/40 px-4 py-6 md:flex">
          <button
            onClick={() => setEntered(false)}
            title="Back to landing"
            className="flex items-center gap-3 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-white/[0.04]"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-hairline bg-elevated/70 p-1.5">
              <img src="/shield.png" alt="" className="h-full w-full rounded-[8px] object-contain" aria-hidden="true" />
            </span>
            <span className="leading-tight">
              <strong className="block text-[15px] font-semibold text-ink">ShieldDrop</strong>
              <span className="font-mono text-[10.5px] text-ink-faint">confidential.distribution.os</span>
            </span>
          </button>

          <nav className="grid gap-1" aria-label="Primary">
            {NAV.map((item) => (
              <NavButton
                key={item.id}
                icon={item.icon}
                label={item.label}
                active={activeView === item.id}
                onClick={() => setActiveView(item.id)}
              />
            ))}
          </nav>

          <div className="mt-auto rounded-[14px] border border-hairline bg-white/[0.02] p-4">
            <span className="font-mono text-[10.5px] uppercase tracking-wider text-purple-bright">
              Privacy guarantee
            </span>
            <p className="mt-2 text-[12px] leading-relaxed text-ink-muted">
              Amounts stay encrypted onchain. Only the recipient can decrypt their allocation.
            </p>
            <div className="mt-3 grid gap-2 text-[12px] text-ink-2">
              <span className="flex items-center gap-2">
                <Lock size={14} className="text-purple-bright" /> FHEVM encrypted ledger
              </span>
              <span className="flex items-center gap-2">
                <KeyRound size={14} className="text-purple-bright" /> EIP-712 user decryption
              </span>
              <span className="flex items-center gap-2">
                <BadgeCheck size={14} className="text-purple-bright" /> Sepolia registry-first
              </span>
            </div>
          </div>
        </aside>

        {/* ---------------- workspace ---------------- */}
        <section className="min-w-0 flex-1 px-5 py-6 md:px-8">
          {/* mobile nav */}
          <nav className="mb-5 flex gap-1.5 overflow-x-auto md:hidden" aria-label="Primary">
            {NAV.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] font-medium transition-colors",
                  activeView === item.id
                    ? "border-purple/40 bg-purple/10 text-purple-bright"
                    : "border-hairline text-ink-muted hover:text-ink"
                )}
              >
                <item.icon size={15} />
                {item.label}
              </button>
            ))}
          </nav>

          <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 flex-col gap-1.5">
              <p className="font-mono text-[11px] uppercase leading-none tracking-wider text-purple-bright">
                Private payouts, grants, airdrops &amp; unlocks
              </p>
              <h1 className="truncate text-2xl font-semibold leading-tight tracking-tight text-ink">{campaign.name}</h1>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <RuntimeBadge status={runtime.status} runtime={runtime.runtime} />
              <CampaignBadge status={campaign.status} />
              <IconButton icon={RefreshCw} label="Refresh campaign" onClick={() => pushToast("Campaign state refreshed.", "info")} />
              <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false} />
            </div>
          </header>

          <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Campaign metrics">
            {metrics.map((metric) => (
              <Stat
                key={metric.label}
                icon={metric.icon}
                label={metric.label}
                value={
                  metric.label === "Recipients"
                    ? campaign.recipients.length
                    : metric.label === "Confidential volume"
                      ? `${formatUnits(total)} ${campaign.tokenSymbol}`
                      : metric.value
                }
                sub={metric.label === "Recipients" ? `${claimed} claimed · ${claimRate(campaign)}% complete` : metric.delta}
              />
            ))}
          </section>

          <div key={activeView} className="mt-6" style={{ animation: "view-fade 0.34s cubic-bezier(0.22,1,0.36,1) both" }}>
            {view}
          </div>
        </section>
      </div>

      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </Surface>
  );
}

const NAV = [
  { id: "command", icon: Network, label: "Command" },
  { id: "claim", icon: Wallet, label: "Claim Desk" },
  { id: "registry", icon: WalletCards, label: "Registry" },
  { id: "audit", icon: ClipboardCheck, label: "Audit" }
] as const;

type IconType = typeof Network;

function NavButton({ icon: Icon, label, active, onClick }: { icon: IconType; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-[14px] font-medium transition-colors",
        active ? "bg-purple/12 text-ink ring-1 ring-purple/30" : "text-ink-muted hover:bg-white/[0.04] hover:text-ink"
      )}
    >
      <Icon size={18} className={active ? "text-purple-bright" : ""} />
      <span>{label}</span>
    </button>
  );
}

const CAMPAIGN_BADGE: Record<CampaignStatus, { tone: StatusTone; label: string }> = {
  draft: { tone: "ready", label: "Draft" },
  encrypting: { tone: "encrypted", label: "Encrypting" },
  funding: { tone: "encrypted", label: "Funding" },
  live: { tone: "live", label: "Live" },
  closed: { tone: "paused", label: "Closed" }
};

function CampaignBadge({ status }: { status: CampaignStatus }) {
  const { tone, label } = CAMPAIGN_BADGE[status];
  return (
    <ToneBadge tone={tone} pulse={status === "live"}>
      {label}
    </ToneBadge>
  );
}

function RuntimeBadge({ status, runtime }: { status: RuntimeStatus; runtime: "demo" | "live" }) {
  const label =
    status === "live"
      ? "Live · Sepolia"
      : status === "initializing"
        ? "Starting relayer"
        : status === "error"
          ? "Demo · relayer offline"
          : "Demo data";
  const isLive = runtime === "live";
  const title = isLive
    ? "Connected to Sepolia with the FHE relayer — actions are real onchain transactions."
    : "Connect a Sepolia wallet to run the real confidential airdrop path. Until then, the app shows demo data.";
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] font-medium",
        isLive
          ? "border-mint/30 bg-mint/10 text-mint-bright"
          : status === "error"
            ? "border-amber/30 bg-amber/10 text-amber"
            : "border-hairline bg-white/[0.03] text-ink-muted"
      )}
    >
      {status === "initializing" ? (
        <Spinner size={12} />
      ) : (
        <span className={cn("h-1.5 w-1.5 rounded-full", isLive ? "bg-mint-bright" : status === "error" ? "bg-amber" : "bg-ink-faint")} />
      )}
      {label}
    </span>
  );
}

/** Turn a thrown wallet/SDK error into a short, human toast message. */
function decodeError(error: unknown, fallback: string): string {
  if (error && typeof error === "object") {
    const maybe = error as { shortMessage?: unknown; message?: unknown };
    const raw = typeof maybe.shortMessage === "string" ? maybe.shortMessage : typeof maybe.message === "string" ? maybe.message : "";
    if (/user rejected|denied|rejected the request/i.test(raw)) return "Signature request rejected.";
    if (/InvalidStartTime|start time/i.test(raw)) {
      return "Airdrop start time expired before the transaction landed. Retry staging with the refreshed buffer.";
    }
    if (/SenderNotAllowed|not allowed|operator/i.test(raw)) {
      return "Token funding was not authorized. Approve the TokenOps operator prompt, then retry staging.";
    }
    if (/insufficient|balance/i.test(raw)) {
      return "Wallet does not have enough Sepolia ETH or confidential token balance for this distribution.";
    }
    if (raw && raw.length <= 140) return raw;
  }
  return fallback;
}

function isHexString(value: string | null): value is Hex {
  return Boolean(value && /^0x[a-fA-F0-9]*$/.test(value));
}

function saveClaimSession(campaign: Campaign, tokenOpsResult: TokenOpsDistributionResult) {
  try {
    const storedCampaign: StoredCampaign = {
      ...campaign,
      recipients: campaign.recipients.map((recipient) => ({
        ...recipient,
        amount: recipient.amount.toString()
      }))
    };
    const session: StoredClaimSession = {
      campaign: storedCampaign,
      tokenOpsResult,
      savedAt: new Date().toISOString()
    };
    window.localStorage.setItem(CLAIM_SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Claim links still carry the encrypted packet for live claims.
  }
}

function loadClaimSession(): { campaign: Campaign; tokenOpsResult: TokenOpsDistributionResult } | null {
  try {
    const raw = window.localStorage.getItem(CLAIM_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredClaimSession;
    return {
      campaign: {
        ...parsed.campaign,
        recipients: parsed.campaign.recipients.map((recipient) => ({
          ...recipient,
          amount: BigInt(recipient.amount)
        }))
      },
      tokenOpsResult: parsed.tokenOpsResult
    };
  } catch {
    return null;
  }
}


export default App;
