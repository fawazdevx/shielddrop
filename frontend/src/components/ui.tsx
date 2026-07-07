
import {
  AlertCircle,
  Check,
  Copy,
  Info,
  Loader2,
  Lock,
  ShieldCheck,
  X,
  type LucideIcon
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode
} from "react";

/* ------------------------------------------------------------------ */
/* utils                                                               */
/* ------------------------------------------------------------------ */

/** Tiny className joiner — no clsx dependency. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/** Animate 0 → target with ease-out whenever `active` flips on. */
export function useCountUp(target: number, active: boolean, duration = 950) {
  const [value, setValue] = useState(active ? target : 0);
  const frame = useRef(0);

  useEffect(() => {
    if (!active) {
      setValue(0);
      return;
    }
    let start = 0;
    const step = (ts: number) => {
      if (!start) start = ts;
      const progress = Math.min(1, (ts - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(target * eased);
      if (progress < 1) frame.current = requestAnimationFrame(step);
      else setValue(target);
    };
    frame.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame.current);
  }, [target, active, duration]);

  return value;
}

/* ------------------------------------------------------------------ */
/* layout surfaces                                                     */
/* ------------------------------------------------------------------ */

/** Full-bleed obsidian app shell with the ambient purple aurora. */
export function Surface({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("relative min-h-screen bg-obsidian text-ink", className)}>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(900px 520px at 82% -8%, rgba(124,58,237,0.18), transparent 60%)," +
            "radial-gradient(760px 520px at 6% 4%, rgba(157,92,255,0.10), transparent 55%)"
        }}
      />
      {children}
    </div>
  );
}

/** Elevated glass card — the default container for content. */
export function Panel({
  children,
  className,
  glow = false,
  as: Tag = "div"
}: {
  children: ReactNode;
  className?: string;
  glow?: boolean;
  as?: "div" | "section" | "article" | "aside";
}) {
  return (
    <Tag
      className={cn(
        "rounded-[14px] border border-hairline bg-elevated/60 backdrop-blur-xl",
        glow ? "shadow-[0_0_0_1px_rgba(157,92,255,0.35),0_20px_60px_rgba(124,58,237,0.25)]" : "shadow-[0_16px_44px_rgba(2,1,8,0.6)]",
        className
      )}
    >
      {children}
    </Tag>
  );
}

export function Divider({ className }: { className?: string }) {
  return <div className={cn("h-px w-full bg-hairline/70", className)} />;
}

/* ------------------------------------------------------------------ */
/* buttons                                                             */
/* ------------------------------------------------------------------ */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const buttonBase =
  "group relative inline-flex items-center justify-center gap-2 rounded-[10px] font-medium " +
  "transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-purple/60 " +
  "disabled:cursor-not-allowed disabled:opacity-45 disabled:saturate-50 select-none";

const buttonSize: Record<ButtonSize, string> = {
  sm: "h-9 px-3.5 text-[13px]",
  md: "h-11 px-5 text-sm",
  lg: "h-[52px] px-7 text-[15px]"
};

const buttonVariant: Record<ButtonVariant, string> = {
  primary:
    "text-white bg-[linear-gradient(135deg,#7c3aed_0%,#9d5cff_55%,#c084fc_100%)] " +
    "shadow-[0_8px_28px_-8px_rgba(124,58,237,0.7)] hover:shadow-[0_10px_34px_-6px_rgba(157,92,255,0.85)] " +
    "hover:-translate-y-px active:translate-y-0",
  secondary:
    "text-ink-2 bg-white/[0.04] border border-hairline hover:bg-white/[0.07] hover:border-purple/40 hover:text-ink",
  ghost: "text-ink-muted hover:text-ink hover:bg-white/[0.04]",
  danger:
    "text-rose bg-rose/10 border border-rose/25 hover:bg-rose/15 hover:border-rose/40"
};

export function Button({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  icon: Icon,
  className,
  disabled,
  ...rest
}: {
  children?: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: LucideIcon;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const iconSize = size === "lg" ? 18 : size === "sm" ? 15 : 16;
  return (
    <button
      className={cn(buttonBase, buttonSize[size], buttonVariant[variant], className)}
      disabled={disabled || loading}
      {...rest}
    >
      {/* shimmer sweep on primary hover */}
      {variant === "primary" && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-[10px]"
        >
          <span className="absolute -inset-y-8 -left-1/3 w-1/3 rotate-12 bg-white/20 blur-md opacity-0 transition-all duration-500 group-hover:left-[110%] group-hover:opacity-100" />
        </span>
      )}
      {loading ? <Spinner size={iconSize} /> : Icon ? <Icon size={iconSize} /> : null}
      {children}
    </button>
  );
}

export function IconButton({
  icon: Icon,
  label,
  size = 16,
  className,
  ...rest
}: {
  icon: LucideIcon;
  label: string;
  size?: number;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-[9px] border border-hairline",
        "text-ink-muted transition-colors hover:border-purple/40 hover:text-ink hover:bg-white/[0.04]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple/60",
        className
      )}
      {...rest}
    >
      <Icon size={size} />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* status badge                                                        */
/* ------------------------------------------------------------------ */

export type StatusTone = "live" | "ready" | "claimed" | "restricted" | "encrypted" | "paused";

const statusStyle: Record<StatusTone, { dot: string; text: string; ring: string; label: string; icon?: LucideIcon }> = {
  live: { dot: "bg-mint-bright", text: "text-mint-bright", ring: "border-mint/30 bg-mint/10", label: "Live" },
  ready: { dot: "bg-indigo", text: "text-indigo", ring: "border-indigo/30 bg-indigo/10", label: "Ready" },
  claimed: { dot: "bg-mint-bright", text: "text-mint-bright", ring: "border-mint/30 bg-mint/10", label: "Claimed", icon: Check },
  restricted: { dot: "bg-amber", text: "text-amber", ring: "border-amber/30 bg-amber/10", label: "Restricted mint" },
  encrypted: { dot: "bg-purple-bright", text: "text-purple-bright", ring: "border-purple/30 bg-purple/10", label: "Encrypted", icon: Lock },
  paused: { dot: "bg-ink-faint", text: "text-ink-muted", ring: "border-hairline bg-white/[0.03]", label: "Paused" }
};

export function StatusBadge({
  tone,
  children,
  pulse = false
}: {
  tone: StatusTone;
  children?: ReactNode;
  pulse?: boolean;
}) {
  const s = statusStyle[tone];
  const Icon = s.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide",
        s.ring,
        s.text
      )}
    >
      {Icon ? (
        <Icon size={11} />
      ) : (
        <span className={cn("relative h-1.5 w-1.5 rounded-full", s.dot)}>
          {pulse && <span className={cn("absolute inset-0 animate-ping rounded-full", s.dot)} />}
        </span>
      )}
      {children ?? s.label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* EncryptedValue — the core privacy visual                            */
/* ------------------------------------------------------------------ */

type EncSize = "sm" | "lg" | "hero";

const encText: Record<EncSize, string> = {
  sm: "text-base",
  lg: "text-2xl",
  hero: "text-5xl md:text-6xl"
};

/**
 * Locked: blurred cipher mask + lock glyph, soft purple neon.
 * Revealed: un-blurs and counts up to the real amount, flashes mint once.
 *
 * `amount` is the on-chain integer (bigint); `decimals` scales it for display.
 */
export function EncryptedValue({
  revealed,
  amount,
  symbol,
  decimals = 6,
  size = "sm",
  className
}: {
  revealed: boolean;
  amount: bigint;
  symbol: string;
  decimals?: number;
  size?: EncSize;
  className?: string;
}) {
  const target = Number(amount) / 10 ** decimals;
  const value = useCountUp(target, revealed);
  const display = value.toLocaleString(undefined, { maximumFractionDigits: 0 });
  const lockSize = size === "hero" ? 26 : size === "lg" ? 18 : 14;

  return (
    <span
      className={cn(
        "relative inline-flex items-center font-mono font-semibold tabular-nums",
        encText[size],
        revealed ? "text-ink" : "text-purple-bright",
        className
      )}
    >
      {revealed ? (
        <span
          className="inline-flex items-baseline gap-1.5"
          style={{ animation: "reveal-flash 0.9s ease-out" }}
        >
          {display}
          <span className="text-[0.62em] font-medium uppercase tracking-wider text-ink-muted">
            {symbol}
          </span>
        </span>
      ) : (
        <span className="inline-flex items-center gap-2">
          <Lock size={lockSize} className="opacity-80" />
          <span
            className="select-none blur-[1.5px]"
            style={{
              textShadow: "0 0 18px rgba(157,92,255,0.55)",
              WebkitTextStroke: "0.4px rgba(192,132,252,0.35)"
            }}
            aria-label="encrypted amount"
          >
            ••,•••
          </span>
          <span className="text-[0.62em] font-medium uppercase tracking-wider text-ink-muted/70">
            {symbol}
          </span>
        </span>
      )}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* form + data primitives                                              */
/* ------------------------------------------------------------------ */

export function Field({
  label,
  hint,
  htmlFor,
  children,
  className
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label htmlFor={htmlFor} className={cn("block", className)}>
      <span className="mb-2 flex items-center justify-between">
        <span className="text-[13px] font-medium text-ink-2">{label}</span>
        {hint && <span className="text-[11px] text-ink-faint">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

/** Shared input styling for text/number inputs and textareas. */
export const inputClass =
  "w-full rounded-[10px] border border-hairline bg-obsidian-2/70 px-3.5 py-2.5 text-sm text-ink " +
  "placeholder:text-ink-faint transition-colors outline-none " +
  "focus:border-purple/50 focus:ring-2 focus:ring-purple/25";

export function Stat({
  label,
  value,
  sub,
  icon: Icon
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <div className="rounded-[12px] border border-hairline bg-white/[0.02] px-4 py-3.5">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-faint">
        {Icon && <Icon size={12} />}
        {label}
      </div>
      <div className="mt-1.5 font-mono text-xl font-semibold text-ink tabular-nums">{value}</div>
      {sub && <div className="mt-0.5 text-[12px] text-ink-muted">{sub}</div>}
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded-md border border-hairline bg-white/[0.04] px-1.5 py-0.5 font-mono text-[11px] text-ink-2">
      {children}
    </kbd>
  );
}

/** Copy-to-clipboard address chip (mono, click to copy). */
export function CopyChip({
  value,
  display,
  onCopied
}: {
  value: string;
  display?: string;
  onCopied?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          onCopied?.();
          setTimeout(() => setCopied(false), 1400);
        } catch {
          /* clipboard blocked — no-op */
        }
      }}
      className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-white/[0.03] px-2.5 py-1 font-mono text-[12px] text-ink-2 transition-colors hover:border-purple/40 hover:text-ink"
    >
      {display ?? value}
      {copied ? <Check size={12} className="text-mint-bright" /> : <Copy size={12} className="opacity-60" />}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* spinner + toasts                                                    */
/* ------------------------------------------------------------------ */

export function Spinner({ size = 17, className }: { size?: number; className?: string }) {
  return <Loader2 size={size} className={cn("animate-spin", className)} />;
}

export type ToastTone = "info" | "success" | "private" | "warn";
export type Toast = { id: number; message: string; tone: ToastTone };

const toastMeta: Record<ToastTone, { icon: LucideIcon; ring: string; iconColor: string }> = {
  info: { icon: Info, ring: "border-indigo/30", iconColor: "text-indigo" },
  success: { icon: ShieldCheck, ring: "border-mint/30", iconColor: "text-mint-bright" },
  private: { icon: Lock, ring: "border-purple/30", iconColor: "text-purple-bright" },
  warn: { icon: AlertCircle, ring: "border-amber/30", iconColor: "text-amber" }
};

export function ToastStack({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed bottom-5 right-5 z-50 flex w-[min(360px,calc(100vw-2.5rem))] flex-col gap-2.5" aria-live="polite">
      {toasts.map((t) => {
        const m = toastMeta[t.tone];
        const Icon = m.icon;
        return (
          <div
            key={t.id}
            style={{ animation: "toast-in 0.3s cubic-bezier(0.22,1,0.36,1) both" }}
            className={cn(
              "flex items-start gap-3 rounded-[12px] border bg-elevated/85 px-4 py-3 backdrop-blur-xl",
              "shadow-[0_16px_44px_rgba(2,1,8,0.6)]",
              m.ring
            )}
          >
            <span className={cn("mt-0.5 shrink-0", m.iconColor)}>
              <Icon size={16} />
            </span>
            <span className="flex-1 text-[13px] leading-snug text-ink-2">{t.message}</span>
            <button
              onClick={() => onDismiss(t.id)}
              aria-label="Dismiss"
              className="shrink-0 text-ink-faint transition-colors hover:text-ink"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
