import {
  AlertCircle,
  ArrowRight,
  BadgeCheck,
  Check,
  ChevronDown,
  ClipboardCheck,
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
import { Landing } from "./components/Landing";
import { EncryptedValue, Spinner, ToastStack, type Toast, type ToastTone } from "./components/primitives";
import { auditTrail, initialCampaign, metrics, sampleCsv, wrapperPairs, ZERO_ADDRESS } from "./lib/constants";
import { buildAuditExport, campaignTotal, claimRate, compactAddress, downloadText, formatUnits, parseRecipientsCsv } from "./lib/format";
import {
  createTokenOpsAdapter,
  type TokenOpsDistributionResult,
  type TokenOpsReadiness
} from "./lib/tokenops";
import type { Address, Campaign, CampaignStatus, Recipient, WrapperPair } from "./lib/types";
import { createZamaClient } from "./lib/zama";

const tokenOps = createTokenOpsAdapter();
const zama = createZamaClient();

function App() {
  const [entered, setEntered] = useState(false);
  const [campaign, setCampaign] = useState<Campaign>(initialCampaign);
  const [activeView, setActiveView] = useState<"command" | "claim" | "registry" | "audit">("command");
  const [selectedWrapper, setSelectedWrapper] = useState<WrapperPair>(wrapperPairs[1]);
  const [csvInput, setCsvInput] = useState(sampleCsv);
  const [selectedRecipientId, setSelectedRecipientId] = useState(campaign.recipients[1]?.id ?? "");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [tokenOpsResult, setTokenOpsResult] = useState<TokenOpsDistributionResult | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastSeq = useRef(0);
  const greeted = useRef(false);

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
    [campaign.name, campaign.tokenAddress, campaign.tokenSymbol, campaign.recipients]
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
    const result = await tokenOps.createDistribution({
      name: campaign.name,
      tokenAddress: campaign.tokenAddress,
      tokenSymbol: campaign.tokenSymbol,
      recipients: campaign.recipients
    });
    setTokenOpsResult(result);
    setCampaign((current) => ({
      ...current,
      tokenOpsOperator: result.operator as Address,
      status: "live",
      contractAddress: (result.airdropAddress ?? current.contractAddress) as Address,
      txHash: result.txHash ?? `0x${result.encryptedBatchId.replace(/[^a-f0-9]/g, "").padEnd(64, "0").slice(0, 64)}`
    }));
    pushToast(`Private ${result.mode.replace("confidential-", "")} staged · ${result.claimPackets.length} claim packets.`, "success");
    setBusyAction(null);
  }

  async function handleDecrypt(recipient: Recipient) {
    setBusyAction(`decrypt-${recipient.id}`);
    const result = await zama.decryptAllocation(recipient.encryptedHandle, recipient);
    setCampaign((current) => ({
      ...current,
      recipients: current.recipients.map((item) => (item.id === recipient.id ? { ...item, decrypted: true } : item))
    }));
    pushToast(`Decrypted for ${compactAddress(recipient.address)} · ${formatUnits(result.amount)} ${campaign.tokenSymbol}.`, "private");
    setBusyAction(null);
  }

  function handleClaim(recipient: Recipient) {
    setCampaign((current) => ({
      ...current,
      recipients: current.recipients.map((item) => (item.id === recipient.id ? { ...item, claimed: true, decrypted: true } : item))
    }));
    pushToast(`${compactAddress(recipient.address)} claimed confidentially — public observers see nothing.`, "success");
  }

  function handleWrapperSelect(wrapper: WrapperPair) {
    setSelectedWrapper(wrapper);
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

  function handleExport() {
    downloadText("shielddrop-audit.csv", buildAuditExport(campaign, tokenOpsReadiness, tokenOpsResult));
    pushToast("Audit export generated with public-safe metadata.", "success");
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
        onCsvChange={setCsvInput}
        onParseCsv={handleParseCsv}
        onEncrypt={handleEncrypt}
        onTokenOpsSync={handleTokenOpsSync}
        onStatusChange={(status) => setCampaign((current) => ({ ...current, status }))}
      />
    ),
    claim: (
      <ClaimDesk
        campaign={campaign}
        recipient={selectedRecipient}
        busyAction={busyAction}
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

function CommandCenter({
  campaign,
  selectedWrapper,
  csvInput,
  invalidRows,
  busyAction,
  tokenOpsReadiness,
  tokenOpsResult,
  onCsvChange,
  onParseCsv,
  onEncrypt,
  onTokenOpsSync,
  onStatusChange
}: {
  campaign: Campaign;
  selectedWrapper: WrapperPair;
  csvInput: string;
  invalidRows: number;
  busyAction: string | null;
  tokenOpsReadiness: TokenOpsReadiness;
  tokenOpsResult: TokenOpsDistributionResult | null;
  onCsvChange: (value: string) => void;
  onParseCsv: () => void;
  onEncrypt: () => void;
  onTokenOpsSync: () => void;
  onStatusChange: (status: CampaignStatus) => void;
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
          <button className="secondary-button">
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
            <input value={campaign.name} readOnly />
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
        <textarea className="csv-box" value={csvInput} onChange={(event) => onCsvChange(event.target.value)} spellCheck={false} />
        <div className="action-row">
          <button className="secondary-button" onClick={onParseCsv}>
            <Upload size={17} />
            Validate CSV
          </button>
          <button className="secondary-button">
            <KeyRound size={17} />
            Generate handles
          </button>
        </div>
        <RecipientTable campaign={campaign} compact />
        <ClaimPacketPreview result={tokenOpsResult} />
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

function ClaimPacketPreview({ result }: { result: TokenOpsDistributionResult | null }) {
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
        {result.claimPackets.slice(0, 3).map((packet) => (
          <div className="packet-row" key={packet.recipientId}>
            <div>
              <strong>{packet.label}</strong>
              <span className="mono">{compactAddress(packet.recipient)}</span>
            </div>
            <span className="mono">{packet.encryptedInput.handle.slice(0, 18)}...</span>
          </div>
        ))}
      </div>
      <p className="muted-note">
        Packets contain the TokenOps encrypted input, EIP-712 admin signature, and private claim URL.
      </p>
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
  onRecipientSelect,
  onDecrypt,
  onClaim
}: {
  campaign: Campaign;
  recipient: Recipient;
  busyAction: string | null;
  onRecipientSelect: (id: string) => void;
  onDecrypt: (recipient: Recipient) => void;
  onClaim: (recipient: Recipient) => void;
}) {
  const steps = useMemo(
    () => [
      { id: "connect", label: "Wallet connected", status: "done" },
      { id: "verify", label: "Eligibility verified", status: recipient ? "done" : "pending" },
      { id: "decrypt", label: "EIP-712 decrypt", status: recipient?.decrypted ? "done" : "active" },
      { id: "claim", label: "Confidential claim", status: recipient?.claimed ? "done" : recipient?.decrypted ? "active" : "pending" }
    ],
    [recipient]
  );

  const decrypting = busyAction === `decrypt-${recipient?.id}`;

  return (
    <div className="two-column claim-layout">
      <section className="panel claim-panel">
        <div className="panel-heading">
          <div>
            <span className="panel-kicker">Recipient experience</span>
            <h2>Claim confidential allocation</h2>
          </div>
          <div className="select-wrap">
            <select value={recipient?.id} onChange={(event) => onRecipientSelect(event.target.value)}>
              {campaign.recipients.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
            <ChevronDown size={16} />
          </div>
        </div>

        <div className={`claim-amount ${recipient?.decrypted ? "is-open" : "is-locked"} ${decrypting ? "is-working" : ""}`}>
          <span className="claim-amount-label">
            <Eye size={14} /> Private allocation · only you can see this
          </span>
          <strong>
            <EncryptedValue revealed={!!recipient?.decrypted} amount={recipient?.amount ?? 0n} symbol={campaign.tokenSymbol} size="hero" />
          </strong>
          <small className="mono">{recipient?.encryptedHandle}</small>
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
          <button className="secondary-button" onClick={() => onDecrypt(recipient)} disabled={!recipient || recipient.decrypted || decrypting}>
            {decrypting ? <Spinner /> : <Eye size={17} />}
            {decrypting ? "Decrypting" : recipient?.decrypted ? "Decrypted" : "Decrypt"}
          </button>
          <button className="primary-button" onClick={() => onClaim(recipient)} disabled={!recipient || recipient.claimed || !recipient.decrypted}>
            <Send size={17} />
            {recipient?.claimed ? "Claimed" : "Claim"}
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
