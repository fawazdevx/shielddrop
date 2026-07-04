import {
  AlertCircle,
  ArrowRight,
  BadgeCheck,
  Check,
  ChevronDown,
  ClipboardCheck,
  Copy,
  Download,
  Eye,
  FileLock2,
  KeyRound,
  Lock,
  Network,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Search,
  Send,
  Shield,
  ShieldCheck,
  Upload,
  Wallet,
  WalletCards
} from "lucide-react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Hex } from "viem";
import { Landing } from "./components/Landing";
import { EncryptedValue, Spinner, ToastStack, type Toast, type ToastTone } from "./components/primitives";
import { auditTrail, csvTemplate, initialCampaign, metrics, sampleCsv, wrapperPairs, ZERO_ADDRESS } from "./lib/constants";
import { buildAuditExport, campaignTotal, claimRate, compactAddress, downloadText, formatUnits, isAddress, parseRecipientsCsv } from "./lib/format";
import {
  type TokenOpsDistributionResult,
  type TokenOpsMode,
  type TokenOpsReadiness
} from "./lib/tokenops";
import type { Address, Campaign, CampaignStatus, Recipient, WrapperPair } from "./lib/types";
import { useDistributionRuntime, type ClaimContext, type RuntimeStatus } from "./lib/useDistributionRuntime";
import { createZamaClient } from "./lib/zama";

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

  async function handleTokenOpsSync() {
    setBusyAction("tokenops");
    try {
      const result = await tokenOps.createDistribution({
        name: campaign.name,
        tokenAddress: campaign.tokenAddress,
        tokenSymbol: campaign.tokenSymbol,
        recipients: campaign.recipients
      });
      const launchedCampaign: Campaign = {
        ...campaign,
        tokenOpsOperator: result.operator as Address,
        status: "live",
        contractAddress: (result.airdropAddress ?? campaign.contractAddress) as Address,
        txHash: result.txHash ?? `0x${result.encryptedBatchId.replace(/[^a-f0-9]/g, "").padEnd(64, "0").slice(0, 64)}`
      };
      setTokenOpsResult(result);
      setCampaign(launchedCampaign);
      saveClaimSession(launchedCampaign, result);
      const where = result.runtime === "live" ? "onchain on Sepolia" : "in demo preview";
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
          item.id === recipient.id ? { ...item, claimed: true, decrypted: true } : item
        ),
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
        onCsvChange={setCsvInput}
        onParseCsv={handleParseCsv}
        onEncrypt={handleEncrypt}
        onTokenOpsSync={handleTokenOpsSync}
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
    <main className="app-shell">
      <div className="grid-bg fixed" aria-hidden="true" />
      <div className="app-glow" aria-hidden="true" />
      <aside className="sidebar">
        <button className="brand brand-button" onClick={() => setEntered(false)} title="Back to landing">
          <span className="brand-mark">
            <ShieldCheck size={22} />
          </span>
          <div>
            <strong>ShieldDrop</strong>
            <span className="mono">confidential.distribution.os</span>
          </div>
        </button>

        <nav className="nav-list" aria-label="Primary">
          <NavButton icon={Network} label="Command" active={activeView === "command"} onClick={() => setActiveView("command")} />
          <NavButton icon={Wallet} label="Claim Desk" active={activeView === "claim"} onClick={() => setActiveView("claim")} />
          <NavButton icon={WalletCards} label="Registry" active={activeView === "registry"} onClick={() => setActiveView("registry")} />
          <NavButton icon={ClipboardCheck} label="Audit" active={activeView === "audit"} onClick={() => setActiveView("audit")} />
        </nav>

        <div className="sidebar-panel">
          <span className="panel-kicker">Privacy guarantee</span>
          <p className="sidebar-blurb">Amounts stay encrypted onchain. Only the recipient can decrypt their allocation.</p>
          <div className="fit-row">
            <Lock size={15} />
            <span>FHEVM encrypted ledger</span>
          </div>
          <div className="fit-row">
            <KeyRound size={15} />
            <span>EIP-712 user decryption</span>
          </div>
          <div className="fit-row">
            <BadgeCheck size={15} />
            <span>Sepolia registry-first</span>
          </div>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Private payouts, grants, airdrops & unlocks</p>
            <h1>{campaign.name}</h1>
          </div>
          <div className="topbar-actions">
            <RuntimeBadge status={runtime.status} runtime={runtime.runtime} />
            <StatusBadge status={campaign.status} />
            <button className="icon-button" title="Refresh campaign" onClick={() => pushToast("Campaign state refreshed.", "info")}>
              <RefreshCw size={18} />
            </button>
            <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false} />
          </div>
        </header>

        <section className="metric-grid" aria-label="Campaign metrics">
          {metrics.map((metric, index) => (
            <div className="metric-card reveal-up" style={{ animationDelay: `${index * 60}ms` }} key={metric.label}>
              <div className="metric-icon">
                <metric.icon size={18} />
              </div>
              <span>{metric.label}</span>
              <strong>
                {metric.label === "Recipients"
                  ? campaign.recipients.length
                  : metric.label === "Confidential volume"
                    ? `${formatUnits(total)} ${campaign.tokenSymbol}`
                    : metric.value}
              </strong>
              <small>{metric.label === "Recipients" ? `${claimed} claimed · ${claimRate(campaign)}% complete` : metric.delta}</small>
            </div>
          ))}
        </section>

        <div className="view-fade" key={activeView}>
          {view}
        </div>
      </section>

      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </main>
  );
}

type IconType = typeof Network;

function NavButton({ icon: Icon, label, active, onClick }: { icon: IconType; label: string; active: boolean; onClick: () => void }) {
  return (
    <button className={`nav-button ${active ? "active" : ""}`} onClick={onClick}>
      <Icon size={18} />
      <span>{label}</span>
    </button>
  );
}

function StatusBadge({ status }: { status: CampaignStatus }) {
  const labels: Record<CampaignStatus, string> = {
    draft: "Draft",
    encrypting: "Encrypting",
    funding: "Funding",
    live: "Live",
    closed: "Closed"
  };
  return (
    <span className={`status status-${status}`}>
      <span className="status-dot" />
      {labels[status]}
    </span>
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
  const tone = runtime === "live" ? "live" : status === "initializing" ? "init" : status === "error" ? "warn" : "demo";
  const title =
    runtime === "live"
      ? "Connected to Sepolia with the Zama FHE relayer — actions are real onchain transactions."
      : "Connect a Sepolia wallet to run the real confidential airdrop path. Until then, the app shows demo data.";
  return (
    <span className={`runtime-badge runtime-badge-${tone}`} title={title}>
      {status === "initializing" ? <Spinner size={12} /> : <span className="runtime-badge-dot" />}
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

function CommandCenter({
  campaign,
  selectedWrapper,
  csvInput,
  invalidRows,
  busyAction,
  tokenOpsReadiness,
  tokenOpsResult,
  distributionMode,
  onCsvChange,
  onParseCsv,
  onEncrypt,
  onTokenOpsSync,
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
  onCsvChange: (value: string) => void;
  onParseCsv: () => void;
  onEncrypt: () => void;
  onTokenOpsSync: () => void;
  onDownloadTemplate: () => void;
  onCopyClaimLink: (url: string, label: string) => void;
  onNewCampaign: () => void;
  onStatusChange: (status: CampaignStatus) => void;
  onNameChange: (name: string) => void;
  onModeChange: (mode: TokenOpsMode) => void;
}) {
  const total = campaignTotal(campaign);

  return (
    <div className="two-column">
      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="panel-kicker">Creator workflow</span>
            <h2>Distribution command center</h2>
          </div>
          <button className="secondary-button" onClick={onNewCampaign}>
            <Plus size={17} />
            New campaign
          </button>
        </div>

        <div className="workflow">
          <WorkflowStep
            index={1}
            icon={WalletCards}
            title="Choose registry token"
            detail={`${selectedWrapper.symbol} · ${compactAddress(selectedWrapper.confidentialToken)}`}
            done
          />
          <WorkflowStep
            index={2}
            icon={Upload}
            title="Load recipients"
            detail={`${campaign.recipients.length} rows · ${invalidRows} issues`}
            done={campaign.recipients.length > 0}
          />
          <WorkflowStep
            index={3}
            icon={FileLock2}
            title="Encrypt allocations"
            detail="FHE handles + recipient ACL"
            done={campaign.status !== "draft"}
            active={campaign.status === "encrypting"}
          />
          <WorkflowStep
            index={4}
            icon={Send}
            title="Launch with TokenOps"
            detail="Operator, funding, claim window"
            done={campaign.status === "live"}
            active={campaign.status === "funding"}
          />
        </div>

        <div className="form-grid">
          <label>
            Campaign name
            <input value={campaign.name} onChange={(e) => onNameChange(e.target.value)} placeholder="My private distribution" />
          </label>
          <label>
            Claim window
            <input value={`${campaign.claimStart.replace("T", " ")} -> ${campaign.claimEnd.replace("T", " ")}`} readOnly />
          </label>
          <label>
            Privacy mode
            <select value={campaign.privacyMode} disabled>
              <option>amounts-and-list-private</option>
              <option>amounts-private</option>
            </select>
          </label>
          <label>
            Launch operator
            <input value={compactAddress(campaign.tokenOpsOperator)} readOnly />
          </label>
        </div>

        <div className="mode-toggle">
          <button
            className={`mode-toggle-btn ${distributionMode === "confidential-airdrop" ? "active" : ""}`}
            onClick={() => onModeChange("confidential-airdrop")}
          >
            <Send size={15} />
            Airdrop
          </button>
          <button
            className={`mode-toggle-btn ${distributionMode === "confidential-disperse" ? "active" : ""}`}
            onClick={() => onModeChange("confidential-disperse")}
          >
            <Network size={15} />
            Disperse
          </button>
        </div>

        <TokenOpsPreflight readiness={tokenOpsReadiness} />

        <div className="action-row">
          <button className="secondary-button" onClick={() => onStatusChange(campaign.status === "live" ? "closed" : "live")}>
            {campaign.status === "live" ? <Pause size={17} /> : <Play size={17} />}
            {campaign.status === "live" ? "Close" : "Open"}
          </button>
          <button className="secondary-button" onClick={onEncrypt} disabled={busyAction === "encrypt"}>
            {busyAction === "encrypt" ? <Spinner /> : <FileLock2 size={17} />}
            {busyAction === "encrypt" ? "Encrypting" : "Encrypt batch"}
          </button>
          <button className="primary-button" onClick={onTokenOpsSync} disabled={busyAction === "tokenops"}>
            {busyAction === "tokenops" ? <Spinner /> : <Send size={17} />}
            {busyAction === "tokenops" ? "Staging" : "Stage privately"}
          </button>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="panel-kicker">CSV importer</span>
            <h2>Private allocation batch</h2>
          </div>
          <span className="mini-badge">
            <Lock size={13} /> {formatUnits(total)} {campaign.tokenSymbol}
          </span>
        </div>
        <div className="csv-toolbar">
          <button className="ghost-button" onClick={onDownloadTemplate}>
            <Download size={15} />
            Download template
          </button>
        </div>
        <textarea className="csv-box" value={csvInput} onChange={(event) => onCsvChange(event.target.value)} spellCheck={false} />
        <div className="action-row">
          <button className="secondary-button" onClick={onParseCsv}>
            <Upload size={17} />
            Validate CSV
          </button>
          <button className="secondary-button" onClick={onEncrypt} disabled={busyAction === "encrypt" || campaign.recipients.length === 0}>
            {busyAction === "encrypt" ? <Spinner /> : <KeyRound size={17} />}
            {busyAction === "encrypt" ? "Encrypting" : "Encrypt allocations"}
          </button>
        </div>
        <RecipientTable campaign={campaign} compact />
        <BatchClaimProgress campaign={campaign} />
        <ClaimPacketPreview result={tokenOpsResult} onCopyLink={onCopyClaimLink} />
      </section>
    </div>
  );
}

function TokenOpsPreflight({ readiness }: { readiness: TokenOpsReadiness }) {
  return (
    <div className="tokenops-card">
      <div className="tokenops-card-head">
        <div>
          <span className="panel-kicker">Distribution readiness</span>
          <strong>{readiness.mode === "confidential-airdrop" ? "Confidential airdrop" : "Confidential disperse"}</strong>
        </div>
        <span className={`runtime-pill ${readiness.runtime}`}>{readiness.runtime}</span>
      </div>
      <div className="preflight-grid">
        {readiness.items.map((item) => (
          <div className={`preflight-item ${item.ok ? "ok" : "warn"}`} key={item.label}>
            {item.ok ? <Check size={15} /> : <AlertCircle size={15} />}
            <div>
              <strong>{item.label}</strong>
              <span>{item.detail}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ClaimPacketPreview({ result, onCopyLink }: { result: TokenOpsDistributionResult | null; onCopyLink: (url: string, label: string) => void }) {
  if (!result) {
    return (
      <div className="claim-packet-empty">
        <KeyRound size={16} />
        <span>Stage the distribution to generate recipient claim packets.</span>
      </div>
    );
  }

  return (
    <div className="claim-packet-panel">
      <div className="packet-head">
        <span className="panel-kicker">Recipient delivery</span>
        <span className="mini-badge">{result.claimPackets.length} packets</span>
      </div>
      <div className="packet-list">
        {result.claimPackets.map((packet) => (
          <div className="packet-row" key={packet.recipientId}>
            <div>
              <strong>{packet.label}</strong>
              <span className="mono">{compactAddress(packet.recipient)}</span>
            </div>
            <button
              className="ghost-button packet-copy-btn"
              onClick={() => onCopyLink(packet.deliveryUrl, packet.label)}
              title="Copy claim link"
            >
              <Copy size={14} />
              Copy link
            </button>
          </div>
        ))}
      </div>
      <p className="muted-note">
        Share each link privately with its recipient. The URL contains only the encrypted handle — no plaintext amount is visible.
      </p>
    </div>
  );
}

function BatchClaimProgress({ campaign }: { campaign: Campaign }) {
  const total = campaign.recipients.length;
  if (total === 0) return null;

  const claimed = campaign.recipients.filter((r) => r.claimed).length;
  const decrypted = campaign.recipients.filter((r) => r.decrypted).length;
  const rate = Math.round((claimed / total) * 100);

  return (
    <div className="batch-progress">
      <div className="batch-progress-head">
        <span className="panel-kicker">Claim progress</span>
        <span className="mono">{claimed}/{total} claimed</span>
      </div>
      <div className="progress-bar">
        <span style={{ width: `${rate}%` }} />
      </div>
      <div className="batch-progress-stats">
        <span>{decrypted} decrypted</span>
        <span>{total - claimed} pending</span>
      </div>
    </div>
  );
}

function WorkflowStep({
  index,
  icon: Icon,
  title,
  detail,
  done,
  active
}: {
  index: number;
  icon: IconType;
  title: string;
  detail: string;
  done?: boolean;
  active?: boolean;
}) {
  return (
    <div className={`workflow-step ${done ? "done" : ""} ${active ? "active" : ""}`}>
      <span className="workflow-icon">{done ? <Check size={18} /> : <Icon size={18} />}</span>
      <div>
        <strong>
          <em>{String(index).padStart(2, "0")}</em>
          {title}
        </strong>
        <small>{detail}</small>
      </div>
    </div>
  );
}

function RecipientTable({ campaign, compact = false }: { campaign: Campaign; compact?: boolean }) {
  return (
    <div className={`table-wrap ${compact ? "compact" : ""}`}>
      <table>
        <thead>
          <tr>
            <th>Recipient</th>
            <th>Allocation</th>
            <th>Handle</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {campaign.recipients.map((recipient) => (
            <tr key={recipient.id}>
              <td>
                <strong>{recipient.label}</strong>
                <span>{compactAddress(recipient.address)}</span>
              </td>
              <td>
                <EncryptedValue revealed={recipient.decrypted} amount={recipient.amount} symbol={campaign.tokenSymbol} />
              </td>
              <td className="mono">{recipient.encryptedHandle}</td>
              <td>
                <span className={`row-status ${recipient.claimed ? "claimed" : recipient.risk}`}>
                  {recipient.claimed ? "claimed" : recipient.risk === "clear" ? "ready" : recipient.risk}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ClaimDesk({
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
  // When a wallet is connected, the recipient is locked to that address —
  // nobody can view another person's allocation. Without a wallet the demo
  // stays explorable via the dropdown.
  const matched = connectedAccount
    ? campaign.recipients.find((item) => item.address.toLowerCase() === connectedAccount.toLowerCase())
    : recipient;
  const gated = Boolean(connectedAccount);
  const active = matched ?? recipient;

  const steps = useMemo(
    () => [
      { id: "connect", label: connectedAccount ? "Wallet connected" : "Connect wallet", status: connectedAccount ? "done" : "active" },
      { id: "verify", label: "Eligibility verified", status: matched ? "done" : gated ? "pending" : "done" },
      { id: "decrypt", label: "EIP-712 decrypt", status: active?.decrypted ? "done" : "active" },
      { id: "claim", label: "Confidential claim", status: active?.claimed ? "done" : active?.decrypted ? "active" : "pending" }
    ],
    [active, matched, gated, connectedAccount]
  );

  const decrypting = busyAction === `decrypt-${active?.id}`;
  const claiming = busyAction === `claim-${active?.id}`;

  if (gated && !matched) {
    return (
      <div className="two-column claim-layout">
        <section className="panel claim-panel">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">Recipient experience</span>
              <h2>Claim confidential allocation</h2>
            </div>
          </div>
          <div className="empty-state">
            <Lock size={22} />
            <strong>No allocation for {compactAddress(connectedAccount!)}</strong>
            <span>This wallet is not a recipient in this campaign. Only eligible wallets can decrypt an allocation.</span>
          </div>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">Public-safe status</span>
              <h2>Campaign progress</h2>
            </div>
            <span className="mini-badge">{claimRate(campaign)}%</span>
          </div>
          <div className="progress-bar">
            <span style={{ width: `${claimRate(campaign)}%` }} />
          </div>
          <p className="muted-note">Observers see only the claim rate and event trail — never the encrypted amounts.</p>
        </section>
      </div>
    );
  }

  return (
    <div className="two-column claim-layout">
      <section className="panel claim-panel">
        <div className="panel-heading">
          <div>
            <span className="panel-kicker">Recipient experience</span>
            <h2>Claim confidential allocation</h2>
          </div>
          {gated ? (
            <span className="mini-badge">
              <Wallet size={13} /> {compactAddress(connectedAccount!)}
            </span>
          ) : (
            <div className="select-wrap">
              <select value={active?.id} onChange={(event) => onRecipientSelect(event.target.value)}>
                {campaign.recipients.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} />
            </div>
          )}
        </div>

        <div className={`claim-amount ${active?.decrypted ? "is-open" : "is-locked"} ${decrypting ? "is-working" : ""}`}>
          <span className="claim-amount-label">
            <Eye size={14} /> Private allocation · only you can see this
          </span>
          <strong>
            <EncryptedValue revealed={!!active?.decrypted} amount={active?.amount ?? 0n} symbol={campaign.tokenSymbol} size="hero" />
          </strong>
          <small className="mono">{active?.encryptedHandle}</small>
        </div>

        <div className="claim-steps">
          {steps.map((step) => (
            <div className={`claim-step ${step.status}`} key={step.id}>
              <span>{step.status === "done" ? <Check size={15} /> : <Lock size={15} />}</span>
              {step.label}
            </div>
          ))}
        </div>

        <div className="action-row">
          <button className="secondary-button" onClick={() => onDecrypt(active)} disabled={!active || active.decrypted || decrypting}>
            {decrypting ? <Spinner /> : <Eye size={17} />}
            {decrypting ? "Decrypting" : active?.decrypted ? "Decrypted" : runtime === "live" ? "Decrypt onchain" : "Decrypt"}
          </button>
          <button
            className="primary-button"
            onClick={() => onClaim(active)}
            disabled={!active || active.claimed || !active.decrypted || claiming}
          >
            {claiming ? <Spinner /> : <Send size={17} />}
            {active?.claimed ? "Claimed" : claiming ? "Claiming" : "Claim"}
          </button>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="panel-kicker">Public-safe status</span>
            <h2>Campaign progress</h2>
          </div>
          <span className="mini-badge">{claimRate(campaign)}%</span>
        </div>
        <div className="progress-bar">
          <span style={{ width: `${claimRate(campaign)}%` }} />
        </div>
        <p className="muted-note">
          Observers see only the claim rate and event trail — never the encrypted amounts.
        </p>
        <RecipientTable campaign={campaign} />
      </section>
    </div>
  );
}

function RegistryDesk({ selectedWrapper, onSelect }: { selectedWrapper: WrapperPair; onSelect: (wrapper: WrapperPair) => void }) {
  const [query, setQuery] = useState("");
  const filtered = wrapperPairs.filter((wrapper) => `${wrapper.name} ${wrapper.symbol}`.toLowerCase().includes(query.toLowerCase()));

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <span className="panel-kicker">Official Zama registry</span>
          <h2>Sepolia wrapper pairs</h2>
        </div>
        <label className="search-box">
          <Search size={17} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search wrappers" />
        </label>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <Search size={22} />
          <strong>No wrappers match “{query}”</strong>
          <span>Try a different token name or symbol.</span>
        </div>
      ) : (
        <div className="registry-grid">
          {filtered.map((wrapper, index) => {
            const selected = wrapper.confidentialToken === selectedWrapper.confidentialToken;
            return (
              <button
                className={`registry-item reveal-up ${selected ? "selected" : ""}`}
                style={{ animationDelay: `${index * 50}ms` }}
                key={wrapper.confidentialToken}
                onClick={() => onSelect(wrapper)}
              >
                <div>
                  <strong>{wrapper.symbol}</strong>
                  <span>{wrapper.name}</span>
                </div>
                <div className="registry-meta">
                  <span className={`mint-tag ${wrapper.publicMint ? "open" : "restricted"}`}>
                    {wrapper.publicMint ? "Faucet mint" : "Restricted mint"}
                  </span>
                  <span className="mono">{compactAddress(wrapper.confidentialToken)}</span>
                </div>
                <BadgeCheck size={18} className={selected ? "registry-check selected" : "registry-check"} />
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

function AuditDesk({
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
  return (
    <div className="two-column">
      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="panel-kicker">Audit report</span>
            <h2>Event trail</h2>
          </div>
          <button className="primary-button" onClick={onExport}>
            <Download size={17} />
            Export
          </button>
        </div>
        <div className="audit-list">
          {auditTrail.map((event) => (
            <div className="audit-event" key={event.id}>
              <time>{event.at}</time>
              <div>
                <strong>{event.action}</strong>
                <span>
                  {event.actor} · {event.detail}
                </span>
              </div>
            </div>
          ))}
        </div>
        <div className="evidence-grid">
          <EvidenceTile label="Distribution route" value={tokenOpsReadiness.mode === "confidential-airdrop" ? "Private airdrop" : "Bulk payout"} />
          <EvidenceTile label="Network" value="Sepolia" />
          <EvidenceTile label="Claim packets" value={tokenOpsResult ? String(tokenOpsResult.claimPackets.length) : "not staged"} />
          <EvidenceTile label="Encrypted batch" value={tokenOpsResult ? compactAddress(tokenOpsResult.encryptedBatchId, 6) : "not staged"} />
        </div>
      </section>

      <section className="panel evidence-panel">
        <div className="panel-heading">
          <div>
            <span className="panel-kicker">Privacy checks</span>
            <h2>Launch checklist</h2>
          </div>
          <Shield size={19} />
        </div>
        <ChecklistItem label="Recipients validated before launch" />
        <ChecklistItem label="Amounts encrypted before distribution" />
        <ChecklistItem label="Each claim packet is recipient-specific" />
        <ChecklistItem label="Recipients decrypt only their own allocation" />
        <ChecklistItem label="Public-safe audit export" />
      </section>
    </div>
  );
}

function EvidenceTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="evidence-tile">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ChecklistItem({ label }: { label: string }) {
  return (
    <div className="checklist-item">
      <span className="checklist-mark">
        <Check size={14} />
      </span>
      <span>{label}</span>
      <ArrowRight size={15} />
    </div>
  );
}

export default App;
