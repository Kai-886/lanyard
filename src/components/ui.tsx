"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

/* ------------------------------------------------------------------ Button */

type ButtonVariant = "primary" | "outline" | "ghost" | "danger" | "quiet";
type ButtonSize = "sm" | "md" | "lg";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-signal text-on-signal border border-transparent hover:brightness-105 active:translate-y-px",
  outline:
    "bg-paper text-ink border border-paper-3 hover:border-ink-3 hover:bg-paper-2 active:translate-y-px",
  ghost: "bg-transparent text-ink-2 border border-transparent hover:bg-paper-2 hover:text-ink",
  danger: "bg-transparent text-[#B3261E] border border-[#E8BFBC] hover:bg-[#F8DFDD] dark:text-[#FF8078] dark:border-[#5A2723] dark:hover:bg-[#3A1715]",
  quiet: "bg-paper-2 text-ink border border-transparent hover:bg-paper-3",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-[15px] gap-2",
};

export function Button({
  variant = "outline",
  size = "md",
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return (
    <button
      {...rest}
      className={cx(
        "inline-flex shrink-0 items-center justify-center rounded-[3px] font-medium transition-[background,border,transform,color] duration-150",
        "disabled:pointer-events-none disabled:opacity-40",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------- Chips */

export function Chip({
  children,
  onRemove,
  className,
  tone = "neutral",
}: {
  children: ReactNode;
  onRemove?: () => void;
  className?: string;
  tone?: "neutral" | "signal";
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-[3px] border px-2 py-1 meta",
        tone === "signal"
          ? "border-signal/40 bg-signal-soft text-signal"
          : "border-paper-3 bg-paper-2 text-ink-2",
        className,
      )}
    >
      {children}
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove filter"
          className="-mr-1 cursor-pointer rounded-sm px-0.5 text-ink-3 transition-colors hover:text-ink"
        >
          ×
        </button>
      ) : null}
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="meta rounded-[3px] border border-paper-3 bg-paper-2 px-1.5 py-0.5 text-ink-3">
      {children}
    </kbd>
  );
}

/* ------------------------------------------------------------------- Forms */

const fieldBase =
  "w-full rounded-[3px] border border-paper-3 bg-paper px-3 py-2.5 text-[15px] text-ink placeholder:text-ink-3 transition-colors focus:border-signal focus:outline-none disabled:opacity-50";

export function Field({
  label,
  hint,
  error,
  required,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="meta flex items-baseline gap-1.5 text-ink-2">
        {label}
        {required ? <span className="text-signal">•</span> : null}
      </label>
      <div id={id}>{children}</div>
      {error ? (
        <p role="alert" className="text-[13px] text-[#B3261E] dark:text-[#FF8078]">
          {error}
        </p>
      ) : hint ? (
        <p className="text-[13px] text-ink-3">{hint}</p>
      ) : null}
    </div>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(fieldBase, props.className)} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cx(fieldBase, "min-h-32 resize-y font-[inherit] leading-relaxed", props.className)}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cx(fieldBase, "cursor-pointer appearance-none pr-8", props.className)}
    />
  );
}

/* -------------------------------------------------------------- StatusTab */

export function StatusTab({ color, width = 6 }: { color: string; width?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.span
      aria-hidden
      layout
      animate={{ backgroundColor: color }}
      transition={reduce ? { duration: 0 } : { duration: 0.18 }}
      className="absolute inset-y-0 left-0 rounded-l-[3px]"
      style={{ width }}
    />
  );
}

/* --------------------------------------------------------- Confirm dialog */

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
      if (e.key === "Tab" && ref.current) {
        const focusable = ref.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0]!;
        const last = focusable[focusable.length - 1]!;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey, true);
    const t = window.setTimeout(() => ref.current?.querySelector<HTMLElement>("button")?.focus(), 30);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      window.clearTimeout(t);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-80 flex items-end justify-center p-0 sm:items-center sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.15 }}
            onClick={onClose}
            className="absolute inset-0 bg-[rgb(var(--shadow-color)/0.55)] backdrop-blur-[2px]"
          />
          <motion.div
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.99 }}
            transition={reduce ? { duration: 0 } : { duration: 0.2, ease: [0.2, 0.7, 0.3, 1] }}
            className="ticket hairline relative z-10 w-full max-w-lg rounded-[4px] p-5 sm:p-6"
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <h2 className="display text-xl">{title}</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="-mr-1 -mt-1 cursor-pointer rounded-sm p-1 text-ink-3 transition-colors hover:text-ink"
              >
                ×
              </button>
            </div>
            {children}
            {footer ? <div className="mt-6 flex justify-end gap-2">{footer}</div> : null}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}

/* ----------------------------------------------------------- Empty / error */

export function EmptyState({
  title,
  body,
  action,
  icon,
}: {
  title: string;
  body: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="hairline flex flex-col items-center justify-center rounded-[4px] border-dashed px-6 py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-paper-3 bg-paper-2 text-ink-3">
        {icon ?? <BarcodeMark seed={0} />}
      </div>
      <h3 className="display text-lg">{title}</h3>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-2">{body}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

/** Procedural barcode strip — decorative, aria-hidden (PRD §8.4). */
export function BarcodeMark({
  seed,
  height = 26,
  className,
}: {
  seed: number;
  height?: number;
  className?: string;
}) {
  let x = 0;
  const bars: { x: number; w: number }[] = [];
  let state = (seed || 1) * 2654435761;
  for (let i = 0; i < 44; i++) {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    const w = 1 + (state % 3);
    bars.push({ x, w });
    x += w + 1 + ((state >> 8) % 2);
  }
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${Math.max(x, 1)} 10`}
      preserveAspectRatio="none"
      height={height}
      className={cx("w-full", className)}
    >
      {bars.map((b, i) => (
        <rect key={i} x={b.x} y="0" width={b.w} height="10" fill="currentColor" />
      ))}
    </svg>
  );
}

/* -------------------------------------------------------------- Toast glue */

const ToastCtx = createContext<(msg: string, opts?: { undo?: () => void }) => void>(() => {});
export const useToast = () => useContext(ToastCtx);
export { ToastCtx };
