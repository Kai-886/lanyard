"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { Clock, AtSign, Building2, Check } from "lucide-react";
import { BarcodeMark, cx } from "@/components/ui";
import { segments } from "@/lib/search";
import { STATUS_META, statusMeta, type LeadStatus } from "@/lib/statuses";
import type { LeadDTO } from "@/lib/types";

/** Marks matched substrings so search results show *why* they matched (FR-4). */
export function Marked({ text, terms }: { text: string; terms?: string[] }) {
  if (!terms?.length) return <>{text}</>;
  return (
    <>
      {segments(text, terms).map((part, i) =>
        part.hit ? (
          <mark
            key={i}
            className="rounded-[2px] bg-signal/25 px-px text-inherit"
          >
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </>
  );
}

const DUE_LABEL: Record<LeadDTO["due"], { text: string; tone: string } | null> = {
  overdue: { text: "Overdue", tone: "text-[#B3261E] dark:text-[#FF8078]" },
  today: { text: "Due today", tone: "text-signal" },
  upcoming: { text: "Scheduled", tone: "text-ink-3" },
  none: null,
};

/** Deterministic hue source so every lead's monogram is stable. */
function seedOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0x7fffffff;
  return h;
}

export function Monogram({ name, id, size = 44 }: { name: string; id: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
  const seed = seedOf(id);
  const angle = 20 + (seed % 50);
  return (
    <span
      aria-hidden
      className="relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[3px] border border-paper-3"
      style={{ width: size, height: size, background: "var(--paper-2)" }}
    >
      <span
        className="absolute inset-0"
        style={{
          backgroundImage: `repeating-linear-gradient(${angle}deg, var(--signal) 0 2px, transparent 2px 7px)`,
          opacity: 0.55,
        }}
      />
      <span className="display relative text-ink" style={{ fontSize: size * 0.38 }}>
        {initials}
      </span>
    </span>
  );
}

export function StatusChip({ status, small }: { status: LeadStatus; small?: boolean }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-[3px] border px-1.5 meta",
        small ? "py-0.5" : "py-1",
      )}
      style={{ borderColor: `${meta.tab}55`, background: meta.wash, color: meta.ink }}
    >
      <span className="h-2 w-[3px] rounded-full" style={{ background: meta.tab }} />
      {meta.label}
    </span>
  );
}

export function LeadBadge({
  lead,
  highlight,
  selected,
  onToggle,
  href,
}: {
  lead: LeadDTO;
  highlight?: string[];
  selected?: boolean;
  onToggle?: () => void;
  href?: string;
}) {
  const reduce = useReducedMotion();
  const meta = statusMeta(lead.status);
  const due = DUE_LABEL[lead.due];
  const seed = seedOf(lead.id);

  return (
    <motion.article
      layout={!reduce}
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        reduce
          ? { duration: 0 }
          : { type: "spring", stiffness: 380, damping: 34, mass: 0.7 }
      }
      className={cx(
        "ticket group relative flex overflow-hidden rounded-[4px] transition-shadow",
        selected ? "ring-2 ring-signal" : "hover:shadow-[0_14px_30px_-22px_rgb(var(--shadow-color)/0.7)]",
      )}
    >
      {/* Holder tab — 6px status colour on the badge edge. */}
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-[6px]"
        style={{ background: meta.tab }}
      />

      {onToggle ? (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggle();
          }}
          role="checkbox"
          aria-checked={selected ?? false}
          aria-label={`Select ${lead.name}`}
          className={cx(
            "absolute top-2.5 left-3.5 z-10 flex h-[18px] w-[18px] cursor-pointer items-center justify-center rounded-[3px] border transition-colors",
            selected
              ? "border-signal bg-signal text-on-signal"
              : "border-paper-3 bg-paper text-transparent hover:border-ink-3",
          )}
        >
          <Check size={12} strokeWidth={3} />
        </button>
      ) : null}

      <Link
        href={href ?? `/leads/${lead.id}`}
        className="flex min-w-0 flex-1 flex-col gap-3 py-3.5 pr-4 pl-6 focus-visible:outline-offset-[-2px]"
      >
        <div className="flex items-start gap-3">
          <Monogram name={lead.name} id={lead.id} />
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <h3 className="display truncate text-[17px] leading-tight">
                <Marked text={lead.name} terms={highlight} />
              </h3>
              {lead.temperature ? (
                <span
                  title={`${lead.temperature} lead`}
                  className={cx(
                    "meta rounded-[2px] px-1 py-px",
                    lead.temperature === "hot" && "bg-signal text-on-signal",
                    lead.temperature === "warm" && "bg-paper-3 text-ink-2",
                    lead.temperature === "cold" && "border border-paper-3 text-ink-3",
                  )}
                >
                  {lead.temperature}
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 truncate text-[13.5px] text-ink-2">
              {[lead.title, lead.company].filter(Boolean).join(" at ") ? (
                <>
                  {lead.title ? <Marked text={lead.title} terms={highlight} /> : null}
                  {lead.title && lead.company ? " at " : null}
                  {lead.company ? <Marked text={lead.company} terms={highlight} /> : null}
                </>
              ) : (
                "—"
              )}
            </p>
          </div>
          <div className="hidden shrink-0 sm:block">
            <StatusChip status={lead.status} small />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-ink-3">
          <span
            className="meta inline-flex items-center gap-1.5"
            style={{ color: "var(--ink-3)" }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: lead.event.accent }} />
            {lead.event.name}
          </span>
          {lead.email ? (
            <span className="inline-flex items-center gap-1 truncate text-[12.5px]">
              <AtSign size={12} aria-hidden />
              <span className="truncate">
                <Marked text={lead.email} terms={highlight} />
              </span>
            </span>
          ) : null}
          {lead.company ? (
            <span className="hidden items-center gap-1 text-[12.5px] md:inline-flex">
              <Building2 size={12} aria-hidden />
              {lead.company}
            </span>
          ) : null}
          {due ? (
            <span className={cx("inline-flex items-center gap-1 text-[12.5px] font-medium", due.tone)}>
              <Clock size={12} aria-hidden />
              {due.text}
            </span>
          ) : null}
        </div>

        {lead.tags.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5">
            {lead.tags.slice(0, 4).map((tag) => (
              <li
                key={tag}
                className="meta rounded-[2px] border border-paper-3 bg-paper-2 px-1.5 py-0.5 text-ink-3"
              >
                {tag}
              </li>
            ))}
            {lead.tags.length > 4 ? (
              <li className="meta px-1 py-0.5 text-ink-3">+{lead.tags.length - 4}</li>
            ) : null}
          </ul>
        ) : null}

        {/* Tear-off stub: dashed rule with half-moon notches, then a barcode. */}
        <div className="stub mt-auto flex items-end gap-4 pt-3">
          <span className="meta shrink-0 text-ink-3">
            #{lead.id.slice(-6).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1 text-ink-3/70">
            <BarcodeMark seed={seed} height={16} />
          </span>
          <span className="meta shrink-0 text-ink-3">
            {new Date(lead.createdAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}
          </span>
        </div>
      </Link>
    </motion.article>
  );
}
