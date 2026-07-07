import { BadgeCheck, Check, Coins, Search, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { wrapperPairs } from "../lib/constants";
import { compactAddress } from "../lib/format";
import type { WrapperPair } from "../lib/types";
import { Panel, StatusBadge, cn, inputClass } from "../components/ui";

export function RegistryDesk({
  selectedWrapper,
  onSelect
}: {
  selectedWrapper: WrapperPair;
  onSelect: (wrapper: WrapperPair) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(
    () =>
      wrapperPairs.filter((w) =>
        `${w.name} ${w.symbol}`.toLowerCase().includes(query.trim().toLowerCase())
      ),
    [query]
  );

  return (
    <Panel className="p-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="font-mono text-[11px] uppercase tracking-wider text-purple-bright">
            Confidential token registry
          </span>
          <h2 className="mt-1 text-xl font-semibold text-ink">Sepolia wrapper pairs</h2>
        </div>
        <div className="relative w-full sm:w-64">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search wrappers"
            className={cn(inputClass, "pl-9")}
            aria-label="Search wrappers"
          />
        </div>
      </header>

      {filtered.length === 0 ? (
        <div className="mt-6 flex flex-col items-center gap-2 rounded-[14px] border border-dashed border-hairline bg-white/[0.015] px-6 py-12 text-center">
          <Search size={20} className="text-ink-faint" />
          <strong className="text-[14px] font-medium text-ink-2">No wrappers match “{query}”</strong>
          <span className="text-[12.5px] text-ink-muted">Try a different token name or symbol.</span>
        </div>
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {filtered.map((wrapper) => (
            <WrapperCard
              key={wrapper.confidentialToken}
              wrapper={wrapper}
              selected={wrapper.confidentialToken === selectedWrapper.confidentialToken}
              onSelect={() => onSelect(wrapper)}
            />
          ))}
        </div>
      )}

      <p className="mt-5 flex items-center gap-1.5 text-[12px] text-ink-faint">
        <ShieldCheck size={13} />
        Every pair is an ERC-7984 confidential wrapper validated against the official Sepolia registry.
      </p>
    </Panel>
  );
}

function WrapperCard({
  wrapper,
  selected,
  onSelect
}: {
  wrapper: WrapperPair;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "group relative overflow-hidden rounded-[14px] border p-4 text-left transition-all",
        selected
          ? "border-purple/50 bg-purple/[0.08] ring-1 ring-purple/30"
          : "border-hairline bg-white/[0.02] hover:border-purple/30 hover:bg-white/[0.04]"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-[11px] border",
              selected ? "border-purple/40 bg-purple/15 text-purple-bright" : "border-hairline bg-white/[0.03] text-ink-muted"
            )}
          >
            <Coins size={20} />
          </span>
          <div className="min-w-0">
            <strong className="block text-[15px] font-semibold text-ink">{wrapper.symbol}</strong>
            <span className="block truncate text-[12.5px] text-ink-muted">{wrapper.name}</span>
          </div>
        </div>
        <span
          className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors",
            selected ? "border-purple/50 bg-purple/20 text-purple-bright" : "border-hairline text-transparent group-hover:text-ink-faint"
          )}
          aria-hidden
        >
          {selected ? <Check size={14} /> : <BadgeCheck size={14} />}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {wrapper.publicMint ? (
          <StatusBadge tone="ready">Faucet mint</StatusBadge>
        ) : (
          <StatusBadge tone="restricted" />
        )}
        <span className="rounded-full border border-hairline bg-white/[0.02] px-2.5 py-1 text-[11px] text-ink-muted">
          {wrapper.decimals} decimals
        </span>
      </div>

      <dl className="mt-4 grid gap-1.5 text-[11.5px]">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-ink-faint">Confidential</dt>
          <dd className="font-mono text-ink-2">{compactAddress(wrapper.confidentialToken)}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-ink-faint">Underlying</dt>
          <dd className="font-mono text-ink-2">{compactAddress(wrapper.underlyingToken)}</dd>
        </div>
      </dl>
    </button>
  );
}
