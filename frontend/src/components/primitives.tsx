import { AlertCircle, Check, Info, Loader2, Lock, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export type ToastTone = "info" | "success" | "private";
export type Toast = { id: number; message: string; tone: ToastTone };

/** Animate a number from 0 -> target with an ease-out curve whenever `active` flips on. */
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

type EncryptedSize = "sm" | "lg" | "hero";

/**
 * The core privacy visual: a locked allocation shows a blurred cipher mask;
 * when revealed it un-blurs and counts up to the real amount.
 */
export function EncryptedValue({
  revealed,
  amount,
  symbol,
  decimals = 6,
  size = "sm"
}: {
  revealed: boolean;
  amount: bigint;
  symbol: string;
  decimals?: number;
  size?: EncryptedSize;
}) {
  const target = Number(amount) / 10 ** decimals;
  const value = useCountUp(target, revealed);
  const display = value.toLocaleString(undefined, { maximumFractionDigits: 0 });
  const lockSize = size === "hero" ? 22 : size === "lg" ? 16 : 13;

  return (
    <span className={`enc enc-${size} ${revealed ? "is-open" : "is-locked"}`}>
      <span className="enc-real">
        {display} <span className="enc-symbol">{symbol}</span>
      </span>
      <span className="enc-mask" aria-hidden="true">
        <Lock size={lockSize} />
        <i className="enc-cipher">{"••,•••"}</i>
      </span>
    </span>
  );
}

export function Spinner({ size = 17 }: { size?: number }) {
  return <Loader2 size={size} className="spin" />;
}

const toastIcon: Record<ToastTone, typeof Info> = {
  info: Info,
  success: Check,
  private: Lock
};

export function ToastStack({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div className="toast-stack" aria-live="polite">
      {toasts.map((toast) => {
        const Icon = toastIcon[toast.tone] ?? AlertCircle;
        return (
          <div className={`toast toast-${toast.tone}`} key={toast.id}>
            <span className="toast-icon">
              <Icon size={16} />
            </span>
            <span className="toast-message">{toast.message}</span>
            <button className="toast-close" onClick={() => onDismiss(toast.id)} aria-label="Dismiss">
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
