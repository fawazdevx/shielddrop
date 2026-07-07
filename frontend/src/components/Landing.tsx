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
  Users,
  type LucideIcon
} from "lucide-react";
import { useState } from "react";
import { Button, EncryptedValue, StatusBadge, cn } from "./ui";
import { LatticeCanvas } from "./LatticeCanvas";

/* ------------------------------------------------------------------ */
/* content — real product copy, no lorem                               */
/* ------------------------------------------------------------------ */

type Feature = { icon: LucideIcon; title: string; body: string; wide?: boolean };

const features: Feature[] = [
  {
    icon: FileLock2,
    title: "Encrypted allocations",
    body: "Amounts are encrypted onchain with FHE. The ledger settles without ever exposing who received how much.",
    wide: true
  },
  {
    icon: KeyRound,
    title: "Recipient-only decryption",
    body: "Each recipient decrypts their own allocation through the EIP-712 user-decryption flow, no one else can."
  },
  {
    icon: Layers,
    title: "Registry-first tokens",
    body: "Built on the official confidential wrapper registry (ERC-7984) on Sepolia."
  },
  {
    icon: ClipboardCheck,
    title: "Audit without exposure",
    body: "Export public-safe campaign evidence and a full event trail while amounts stay private.",
    wide: true
  }
];

const useCases: Array<{ icon: LucideIcon; label: string }> = [
  { icon: Gift, label: "Airdrops" },
  { icon: Coins, label: "Investor payouts" },
  { icon: Users, label: "Contributor rewards" },
  { icon: Gift, label: "Grants" },
  { icon: Unlock, label: "Token unlocks" }
];

const steps: Array<{ icon: LucideIcon; title: string; body: string }> = [
  { icon: Layers, title: "Pick a registry token", body: "Choose a confidential wrapper pair from the Sepolia registry." },
  { icon: FileLock2, title: "Encrypt the batch", body: "Load recipients, validate, and encrypt every allocation with per-recipient ACLs." },
  { icon: Eye, title: "Recipients claim privately", body: "Each wallet verifies eligibility and decrypts only its own amount." }
];

/** Demo allocation used by the hero's live privacy visual. 6-decimal cUSDT. */
const HERO_AMOUNT = 12_500n * 1_000_000n;

/* ------------------------------------------------------------------ */

export function Landing({ onLaunch }: { onLaunch: () => void }) {
  const [heroRevealed, setHeroRevealed] = useState(false);

  return (
    <div className="relative">
      {/* faint grid backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(157,92,255,0.06) 1px, transparent 1px)," +
            "linear-gradient(90deg, rgba(157,92,255,0.06) 1px, transparent 1px)",
          backgroundSize: "54px 54px",
          maskImage: "radial-gradient(1200px 700px at 50% -5%, black, transparent 75%)"
        }}
      />

      {/* ---------------- nav ---------------- */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <a href="#top" className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-hairline bg-elevated/70 p-1.5">
            <img src="/shield.png" alt="" className="h-full w-full rounded-[8px] object-contain" aria-hidden="true" />
          </span>
          <span className="leading-tight">
            <strong className="block text-[15px] font-semibold text-ink">ShieldDrop</strong>
            <span className="font-mono text-[11px] text-ink-faint">confidential.distribution.os</span>
          </span>
        </a>
        <nav className="hidden items-center gap-7 text-sm text-ink-muted md:flex">
          <a className="transition-colors hover:text-ink" href="#features">Features</a>
          <a className="transition-colors hover:text-ink" href="#how">How it works</a>
          <a className="transition-colors hover:text-ink" href="#usecases">Use cases</a>
        </nav>
        <Button size="sm" icon={ArrowRight} onClick={onLaunch}>
          Launch app
        </Button>
      </header>

      {/* ---------------- hero ---------------- */}
      <section id="top" className="relative overflow-hidden">
        <LatticeCanvas className="pointer-events-none absolute inset-0 h-full w-full opacity-60" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-6 pb-20 pt-14 lg:grid-cols-[1.1fr_0.9fr] lg:pt-20">
          {/* left: pitch */}
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-hairline bg-elevated/60 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-ink-muted">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint-bright opacity-70" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-mint-bright" />
              </span>
              Private distributions · Sepolia
            </span>

            <h1 className="mt-6 text-5xl font-semibold leading-[1.04] tracking-tight text-ink md:text-6xl">
              Distribute tokens.
              <br />
              <span className="bg-[linear-gradient(120deg,#e9d5ff_0%,#c084fc_45%,#818cf8_100%)] bg-clip-text text-transparent">
                Reveal nothing.
              </span>
            </h1>

            <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-ink-muted">
              ShieldDrop is a confidential token distribution OS for private airdrops, investor
              payouts, contributor rewards, grants, and unlocks. Allocations stay encrypted
              onchain, recipients decrypt only their own amount.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button size="lg" icon={ShieldCheck} onClick={onLaunch}>
                Launch the app
              </Button>
              <a href="#how">
                <Button size="lg" variant="secondary" icon={ArrowRight}>
                  See how it works
                </Button>
              </a>
            </div>

            <dl className="mt-10 flex flex-wrap gap-x-10 gap-y-4">
              {[
                { k: "FHE", v: "encrypted ledger" },
                { k: "EIP-712", v: "user decryption" },
                { k: "ERC-7984", v: "wrapper registry" }
              ].map((s) => (
                <div key={s.k}>
                  <dt className="text-lg font-semibold text-ink">{s.k}</dt>
                  <dd className="font-mono text-[11px] text-ink-faint">{s.v}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* right: live privacy visual — the product, demonstrated */}
          <div className="relative">
            <div className="rounded-[18px] border border-hairline bg-elevated/60 p-6 backdrop-blur-xl shadow-[0_0_0_1px_rgba(157,92,255,0.2),0_24px_70px_-20px_rgba(124,58,237,0.5)]">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] uppercase tracking-wider text-ink-faint">
                  Your allocation
                </span>
                <StatusBadge tone={heroRevealed ? "claimed" : "encrypted"} />
              </div>

              <div className="mt-8 flex min-h-[72px] items-center">
                <EncryptedValue
                  revealed={heroRevealed}
                  amount={HERO_AMOUNT}
                  symbol="cUSDT"
                  decimals={6}
                  size="hero"
                />
              </div>

              <p className="mt-6 text-[13px] leading-relaxed text-ink-muted">
                {heroRevealed
                  ? "Decrypted locally in your wallet. Only you can see this — the onchain ledger still shows nothing."
                  : "This amount is encrypted onchain. No one — not even ShieldDrop — can read it until you decrypt."}
              </p>

              <div className="mt-6">
                <Button
                  variant={heroRevealed ? "secondary" : "primary"}
                  icon={heroRevealed ? Lock : KeyRound}
                  className="w-full"
                  onClick={() => setHeroRevealed((v) => !v)}
                >
                  {heroRevealed ? "Re-encrypt" : "Decrypt my allocation"}
                </Button>
                <p className="mt-2 text-center text-[11px] text-ink-faint">
                  Interactive preview — try it
                </p>
              </div>
            </div>
          </div>
        </div>
        {/* fade into next section */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-obsidian" />
      </section>

      {/* ---------------- use-case strip ---------------- */}
      <section id="usecases" className="mx-auto max-w-6xl px-6">
        <div className="flex flex-wrap items-center justify-center gap-2.5 border-y border-hairline/60 py-5">
          {useCases.map((u) => (
            <span
              key={u.label}
              className="inline-flex items-center gap-2 rounded-full border border-hairline bg-white/[0.02] px-3.5 py-1.5 text-[13px] text-ink-2"
            >
              <u.icon size={15} className="text-purple-bright" />
              {u.label}
            </span>
          ))}
        </div>
      </section>

      {/* ---------------- features bento ---------------- */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-20">
        <SectionHead label="// why shielddrop" title="Privacy as a product workflow" />
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {features.map((f) => (
            <article
              key={f.title}
              className={cn(
                "group relative overflow-hidden rounded-[16px] border border-hairline bg-elevated/50 p-6 transition-colors hover:border-purple/40",
                f.wide && "md:col-span-2"
              )}
            >
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-hairline bg-purple/10 text-purple-bright">
                <f.icon size={20} />
              </span>
              <h3 className="mt-4 text-lg font-semibold text-ink">{f.title}</h3>
              <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-ink-muted">{f.body}</p>
              <span
                aria-hidden
                className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-purple/10 opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100"
              />
            </article>
          ))}
        </div>
      </section>

      {/* ---------------- how it works ---------------- */}
      <section id="how" className="mx-auto max-w-6xl px-6 pb-20">
        <SectionHead label="// how it works" title="Three steps to a private distribution" />
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {steps.map((s, i) => (
            <div key={s.title} className="relative rounded-[16px] border border-hairline bg-elevated/50 p-6">
              <span className="absolute right-5 top-5 font-mono text-sm text-ink-faint">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-hairline bg-purple/10 text-purple-bright">
                <s.icon size={20} />
              </span>
              <h3 className="mt-4 text-[17px] font-semibold text-ink">{s.title}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-ink-muted">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------- CTA ---------------- */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="relative overflow-hidden rounded-[20px] border border-hairline bg-[linear-gradient(135deg,rgba(124,58,237,0.18),rgba(18,14,36,0.6))] px-8 py-12 text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-ink">
            Make confidential distribution feel simple.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-[15px] text-ink-muted">
            Create a campaign, encrypt allocations, and watch a private claim reveal, end to end.
          </p>
          <div className="mt-7 flex justify-center">
            <Button size="lg" icon={ShieldCheck} onClick={onLaunch}>
              Launch app
            </Button>
          </div>
        </div>
      </section>

      {/* ---------------- footer ---------------- */}
      <footer className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 border-t border-hairline/60 px-6 py-8 sm:flex-row">
        <div className="flex items-center gap-2.5 text-ink-muted">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-hairline bg-elevated/70 text-purple-bright">
            <ShieldCheck size={16} />
          </span>
          <span className="font-mono text-[12px]">shielddrop · confidential distribution</span>
        </div>
        <span className="text-[12px] text-ink-faint">Confidential token distribution · Sepolia</span>
      </footer>
    </div>
  );
}

function SectionHead({ label, title }: { label: string; title: string }) {
  return (
    <div className="text-center">
      <span className="font-mono text-[12px] uppercase tracking-wider text-purple-bright">{label}</span>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink md:text-4xl">{title}</h2>
    </div>
  );
}
