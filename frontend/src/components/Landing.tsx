import {
  ArrowRight,
  ClipboardCheck,
  Coins,
  Eye,
  FileLock2,
  Gift,
  KeyRound,
  Layers,
  Lock,
  ShieldCheck,
  Unlock,
  Users
} from "lucide-react";
import { LatticeCanvas } from "./LatticeCanvas";

const features = [
  {
    icon: FileLock2,
    title: "Encrypted allocations",
    body: "Amounts are encrypted onchain with Zama FHEVM. The ledger settles without ever exposing who received how much.",
    span: "wide"
  },
  {
    icon: KeyRound,
    title: "Recipient-only decryption",
    body: "Each recipient decrypts their own allocation via the EIP-712 user-decryption flow."
  },
  {
    icon: Layers,
    title: "Registry-first tokens",
    body: "Built on the official Zama confidential wrapper registry on Sepolia."
  },
  {
    icon: ClipboardCheck,
    title: "Audit without exposure",
    body: "Export public-safe campaign evidence and a full event trail while amounts stay private.",
    span: "wide"
  }
];

const useCases = [
  { icon: Gift, label: "Airdrops" },
  { icon: Coins, label: "Investor payouts" },
  { icon: Users, label: "Contributor rewards" },
  { icon: Gift, label: "Grants" },
  { icon: Unlock, label: "Token unlocks" }
];

const steps = [
  { icon: Layers, title: "Pick a registry token", body: "Choose a confidential wrapper pair from the Zama Sepolia registry." },
  { icon: FileLock2, title: "Encrypt the batch", body: "Load recipients, validate, and encrypt every allocation with recipient ACLs." },
  { icon: Eye, title: "Recipients claim privately", body: "Each wallet verifies eligibility and decrypts only its own amount." }
];

export function Landing({ onLaunch }: { onLaunch: () => void }) {
  return (
    <div className="landing">
      <div className="grid-bg" aria-hidden="true" />

      <header className="landing-nav">
        <div className="brand">
          <span className="brand-mark">
            <ShieldCheck size={22} />
          </span>
          <div>
            <strong>ShieldDrop</strong>
            <span className="mono">confidential.distribution.os</span>
          </div>
        </div>
        <nav className="landing-links">
          <a href="#features">Features</a>
          <a href="#how">How it works</a>
          <a href="#usecases">Use cases</a>
        </nav>
        <button className="primary-button" onClick={onLaunch}>
          Launch app
          <ArrowRight size={17} />
        </button>
      </header>

      <section className="hero">
        <LatticeCanvas className="hero-lattice" />
        <div className="hero-inner">
          <span className="mono-tag">
            <span className="mono-tag-dot" />
            PRIVATE DISTRIBUTIONS · SEPOLIA
          </span>
          <h1>
            Distribute tokens.
            <br />
            <span className="gradient-text">Reveal nothing.</span>
          </h1>
          <p>
            ShieldDrop is a confidential token distribution OS for private airdrops, investor payouts,
            contributor rewards, grants, and unlocks. Allocations stay encrypted onchain — recipients
            decrypt only their own amount.
          </p>
          <div className="hero-actions">
            <button className="primary-button lg" onClick={onLaunch}>
              <ShieldCheck size={18} />
              Launch the demo
            </button>
            <a className="ghost-button lg" href="#how">
              See how it works
              <ArrowRight size={16} />
            </a>
          </div>
          <div className="hero-stats">
            <div>
              <strong>FHE</strong>
              <span className="mono">encrypted ledger</span>
            </div>
            <div>
              <strong>EIP-712</strong>
              <span className="mono">user decryption</span>
            </div>
            <div>
              <strong>ERC-7984</strong>
              <span className="mono">wrapper registry</span>
            </div>
          </div>
        </div>
        <div className="hero-scrim" aria-hidden="true" />
      </section>

      <section className="usecases-strip" id="usecases">
        {useCases.map((useCase, index) => (
          <div className="usecase-chip" key={`${useCase.label}-${index}`}>
            <useCase.icon size={15} />
            {useCase.label}
          </div>
        ))}
      </section>

      <section className="features" id="features">
        <div className="section-head">
          <span className="mono-label">// why shielddrop</span>
          <h2>Privacy as a product workflow</h2>
        </div>
        <div className="bento">
          {features.map((feature, index) => (
            <article
              className={`bento-card ${feature.span === "wide" ? "bento-wide" : ""} reveal-up`}
              style={{ animationDelay: `${index * 70}ms` }}
              key={feature.title}
            >
              <span className="bento-icon">
                <feature.icon size={20} />
              </span>
              <h3>{feature.title}</h3>
              <p>{feature.body}</p>
              <span className="bento-corner" aria-hidden="true" />
            </article>
          ))}
        </div>
      </section>

      <section className="how" id="how">
        <div className="section-head">
          <span className="mono-label">// how it works</span>
          <h2>Three steps to a private distribution</h2>
        </div>
        <div className="how-grid">
          {steps.map((step, index) => (
            <div className="how-step" key={step.title}>
              <span className="how-index mono">{String(index + 1).padStart(2, "0")}</span>
              <span className="bento-icon">
                <step.icon size={20} />
              </span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="cta-banner">
        <div className="grid-bg sub" aria-hidden="true" />
        <div className="cta-inner">
          <div>
            <h2>Make confidential distribution feel simple.</h2>
            <p>Launch the interactive demo — create a campaign, encrypt allocations, and watch a private claim reveal.</p>
          </div>
          <button className="primary-button lg" onClick={onLaunch}>
            <Lock size={18} />
            Launch app
            <ArrowRight size={17} />
          </button>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="brand">
          <span className="brand-mark sm">
            <ShieldCheck size={16} />
          </span>
          <span className="mono">shielddrop · confidential distribution</span>
        </div>
        <span className="footer-note">Confidential token distribution on Zama Protocol</span>
      </footer>
    </div>
  );
}
