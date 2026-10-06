"use client";

import { useState } from "react";
import { Download, KeyRound, Moon, Sun } from "lucide-react";
import { Button, Chip, Kbd, cx } from "@/components/ui";
import { useAiStatus } from "@/lib/hooks";
import { useTheme } from "@/components/theme";

const SHORTCUTS: [string, string][] = [
  ["⌘K / Ctrl+K", "Command palette"],
  ["/", "Focus search"],
  ["n", "New lead"],
  ["Esc", "Close the topmost layer"],
  ["?", "This list (coming soon)"],
];

export function SettingsView() {
  const status = useAiStatus();
  const { mode, toggle } = useTheme();
  const [copied, setCopied] = useState(false);

  const availability = status.data?.availability ?? "off";

  const copyEnv = async () => {
    const snippet = [
      'AI_PROVIDER="openai"',
      'AI_API_KEY="sk-…"',
      'AI_MODEL="gpt-4o-mini"',
      'AI_MOCK="0"',
    ].join("\n");
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="flex flex-col gap-6 pt-8">
      <header>
        <p className="meta text-ink-3">Configuration</p>
        <h1 className="display mt-1 text-[clamp(1.9rem,4vw,2.6rem)]">Settings</h1>
      </header>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* ------------------------------------------------------------- AI */}
        <section className="hairline flex flex-col gap-4 rounded-[4px] bg-paper p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="display text-lg">AI</h2>
            <Chip tone={availability === "live" ? "signal" : "neutral"}>
              {availability === "live" ? "Live model" : availability === "mock" ? "Demo mode" : "Not configured"}
            </Chip>
          </div>

          <p className="text-sm leading-relaxed text-ink-2">
            {availability === "live"
              ? "Requests are going to a real model. Summaries are cached by content hash, so the same notes are only billed once."
              : availability === "mock"
                ? "Demo mode is on: summaries and drafts are derived deterministically from each lead's own notes, with no network call and no cost. Everything works — the output just isn't model-generated."
                : "No key is present, so the AI controls are disabled rather than failing silently."}
          </p>

          <dl className="grid grid-cols-2 gap-3 border-t border-dashed border-paper-3 pt-3">
            <Stat label="AI calls recorded" value={status.data?.calls ?? 0} />
            <Stat label="Cached / live" value={`${status.data?.calls ?? 0}`} />
          </dl>

          {status.data?.recent?.length ? (
            <ul className="flex flex-col gap-1.5 border-t border-dashed border-paper-3 pt-3">
              {status.data.recent.slice(0, 5).map((row) => {
                const r = row as { id: string; kind: string; model: string; cached: boolean };
                return (
                  <li key={r.id} className="flex items-center justify-between gap-3 text-[13px]">
                    <span className="text-ink-2">{r.kind}</span>
                    <span className="meta text-ink-3">{r.model}</span>
                    <span className={cx("meta", r.cached ? "text-signal" : "text-ink-3")}>
                      {r.cached ? "cached" : "live"}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : null}

          <div className="flex flex-wrap items-center gap-2 border-t border-dashed border-paper-3 pt-3">
            <Button size="sm" onClick={() => void copyEnv()} disabled={availability === "live"}>
              <KeyRound size={13} aria-hidden />
              {copied ? "Copied" : "Copy .env snippet"}
            </Button>
            <span className="meta text-ink-3">then restart the dev server</span>
          </div>
        </section>

        {/* -------------------------------------------------------- appearance */}
        <section className="hairline flex flex-col gap-4 rounded-[4px] bg-paper p-5">
          <h2 className="display text-lg">Appearance</h2>
          <p className="text-sm leading-relaxed text-ink-2">
            Paper is the default — it&apos;s ticket stock, and this is a badge. Backstage inverts it
            for late-night triage after day one of a conference.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => mode === "dark" && toggle()}
              aria-pressed={mode === "light"}
              className={cx(
                "flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-[3px] border px-4 py-3 text-sm transition-colors",
                mode === "light" ? "border-ink font-semibold" : "border-paper-3 text-ink-2 hover:border-ink-3",
              )}
            >
              <Sun size={15} aria-hidden /> Paper
            </button>
            <button
              type="button"
              onClick={() => mode === "light" && toggle()}
              aria-pressed={mode === "dark"}
              className={cx(
                "flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-[3px] border px-4 py-3 text-sm transition-colors",
                mode === "dark" ? "border-ink font-semibold" : "border-paper-3 text-ink-2 hover:border-ink-3",
              )}
            >
              <Moon size={15} aria-hidden /> Backstage
            </button>
          </div>

          <div className="border-t border-dashed border-paper-3 pt-3">
            <h3 className="meta mb-2 text-ink-3">Keyboard</h3>
            <ul className="flex flex-col gap-1.5">
              {SHORTCUTS.map(([keys, label]) => (
                <li key={keys} className="flex items-center justify-between gap-3 text-[13px]">
                  <span className="text-ink-2">{label}</span>
                  <Kbd>{keys}</Kbd>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ------------------------------------------------------------- data */}
        <section className="hairline flex flex-col gap-4 rounded-[4px] bg-paper p-5">
          <h2 className="display text-lg">Data</h2>
          <p className="text-sm leading-relaxed text-ink-2">
            Everything lives in SQLite (<code className="meta">prisma/dev.db</code>) via Prisma. The
            export respects whatever filters you have applied on the rail, so &quot;Export&quot; gives
            you the view you&apos;re looking at, not a dump.
          </p>
          <div className="flex flex-wrap gap-2">
            <a
              href="/api/export"
              className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-[3px] border border-paper-3 bg-paper px-4 text-sm transition-colors hover:border-ink-3"
            >
              <Download size={15} aria-hidden />
              Export CSV
            </a>
            <code className="meta flex h-9 items-center rounded-[3px] border border-dashed border-paper-3 px-3 text-ink-3">
              npm run db:reset
            </code>
          </div>
        </section>

        {/* -------------------------------------------------------- shortcuts */}
        <section className="hairline flex flex-col gap-4 rounded-[4px] bg-paper p-5">
          <h2 className="display text-lg">Deployment</h2>
          <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm leading-relaxed text-ink-2">
            <li>
              Push the repo to GitHub — <code className="meta">README.md</code> has the full
              quickstart.
            </li>
            <li>
              On Vercel, add <code className="meta">DATABASE_URL</code> pointing at a hosted SQLite
              or Postgres URL, plus <code className="meta">AI_API_KEY</code>.
            </li>
            <li>Run <code className="meta">prisma db push</code> and <code className="meta">db:seed</code> once against the target database.</li>
          </ol>
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-[3px] border border-dashed border-paper-3 px-3 py-2">
      <dt className="meta text-ink-3">{label}</dt>
      <dd className="display mt-1 text-xl">{value}</dd>
    </div>
  );
}
