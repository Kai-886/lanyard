"use client";

import { useCallback, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Check,
  Copy,
  KeyRound,
  RefreshCw,
  Send,
  Sparkles,
  Wand2,
} from "lucide-react";
import { Button, cx, useToast } from "@/components/ui";
import { useAiStatus, useInvalidate } from "@/lib/hooks";
import { RequestError } from "@/lib/api";
import type { LeadDTO, AiSummary } from "@/lib/types";

type Channel = "EMAIL" | "LINKEDIN" | "SMS";

const CHANNELS: { value: Channel; label: string }[] = [
  { value: "EMAIL", label: "Email" },
  { value: "LINKEDIN", label: "LinkedIn" },
  { value: "SMS", label: "SMS" },
];

export function AiPanel({ lead }: { lead: LeadDTO }) {
  const toast = useToast();
  const reduce = useReducedMotion();
  const status = useAiStatus();
  const invalidate = useInvalidate(["lead", lead.id], ["leads"], ["ai-status"]);

  const [summary, setSummary] = useState<AiSummary | null>(lead.aiSummary);
  const [summarizing, setSummarizing] = useState(false);
  const [channel, setChannel] = useState<Channel>("EMAIL");
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  /* Reset only when a *different* badge is opened; render-phase adjustment
     keeps the React Compiler happy about state that mirrors a prop. */
  const [seenId, setSeenId] = useState(lead.id);
  if (seenId !== lead.id) {
    setSeenId(lead.id);
    setSummary(lead.aiSummary);
    setDraft("");
    setError(null);
    setCopied(false);
  }

  const tooShort = lead.notes.trim().length < 15;
  const availability = status.data?.availability ?? "off";

  const runSummarize = useCallback(async () => {
    setError(null);
    setSummarizing(true);
    try {
      const res = await fetch("/api/ai/summarize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ leadId: lead.id }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new RequestError(res.status, body?.error?.message ?? "Summarize failed");
      }
      setSummary(body.summary as AiSummary);
      invalidate();
      if (body.cached) toast("Recalled from cache — no new AI spend.");
    } catch (err) {
      const message = err instanceof RequestError ? err.message : "Could not reach the AI service.";
      setError(message);
      toast(message);
    } finally {
      setSummarizing(false);
    }
  }, [lead.id, invalidate, toast]);

  const runDraft = useCallback(async () => {
    setError(null);
    setDraft("");
    setStreaming(true);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/ai/draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ leadId: lead.id, channel }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => null);
        throw new RequestError(res.status, body?.error?.message ?? "Draft failed");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        setDraft((prev) => prev + decoder.decode(value, { stream: true }));
      }
      invalidate();
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      const message = err instanceof RequestError ? err.message : "Could not reach the AI service.";
      setError(message);
      toast(message);
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }, [lead.id, channel, invalidate, toast]);

  const copy = async () => {
    if (!draft) return;
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      toast("Draft copied to clipboard");
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast("Clipboard blocked by the browser — select and copy manually.");
    }
  };

  const saveToTimeline = async () => {
    if (!draft) return;
    try {
      await fetch(`/api/leads/${lead.id}/followups`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          channel: channel === "SMS" ? "CALL" : channel,
          direction: "OUT",
          body: draft,
        }),
      });
      invalidate();
      toast("Saved to the follow-up timeline as a draft");
    } catch {
      toast("Could not save that draft.");
    }
  };

  return (
    <section className="hairline flex flex-col gap-5 rounded-[4px] bg-paper p-5" aria-label="AI assist">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-signal" aria-hidden />
          <h2 className="display text-lg">AI assist</h2>
        </div>
        <AvailabilityBadge availability={availability} />
      </header>

      {/* ------------------------------------------------------- summary */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <span className="meta text-ink-3">Recall</span>
          <Button
            size="sm"
            onClick={() => void runSummarize()}
            disabled={summarizing || tooShort || availability === "off"}
            title={tooShort ? "Add more detail first." : undefined}
          >
            <RefreshCw size={13} className={cx(summarizing && "animate-spin")} aria-hidden />
            {summary ? "Re-summarize" : "Summarize notes"}
          </Button>
        </div>

        {tooShort ? (
          <p className="rounded-[3px] border border-dashed border-paper-3 px-3 py-2.5 text-[13px] text-ink-3">
            Notes are too thin to summarize — add a sentence about what you actually discussed.
          </p>
        ) : summary ? (
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduce ? 0 : 0.22 }}
            className="flex flex-col gap-3"
          >
            <p className="text-[15px] leading-relaxed text-ink">{summary.recall}</p>

            {summary.interests.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {summary.interests.map((tag) => (
                  <span
                    key={tag}
                    className="meta rounded-[3px] border border-paper-3 bg-paper-2 px-2 py-1 text-ink-2"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}

            {summary.signals.length > 0 ? (
              <ul className="flex flex-col gap-1.5 border-l-2 border-signal/40 pl-3">
                {summary.signals.map((s) => (
                  <li key={s} className="text-[13.5px] leading-snug text-ink-2">
                    {s}
                  </li>
                ))}
              </ul>
            ) : null}

            <div className="flex flex-wrap items-center gap-3 border-t border-dashed border-paper-3 pt-3">
              <span className="meta text-ink-3">Next step</span>
              <span className="flex-1 text-[13.5px] text-ink">{summary.nextStep}</span>
              <span
                className={cx(
                  "meta rounded-[2px] px-1.5 py-0.5",
                  summary.temperature === "hot" && "bg-signal text-on-signal",
                  summary.temperature === "warm" && "bg-paper-3 text-ink-2",
                  summary.temperature === "cold" && "border border-paper-3 text-ink-3",
                )}
              >
                {summary.temperature}
              </span>
            </div>
          </motion.div>
        ) : (
          <p className="rounded-[3px] border border-dashed border-paper-3 px-3 py-2.5 text-[13px] text-ink-3">
            Not summarized yet. One click turns the raw notes into recall, interests and a next step.
          </p>
        )}
      </div>

      {/* -------------------------------------------------------- draft */}
      <div className="flex flex-col gap-3 border-t border-dashed border-paper-3 pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="meta text-ink-3">Follow-up draft</span>
          <div className="flex items-center gap-1 rounded-[3px] border border-paper-3 bg-paper-2 p-0.5">
            {CHANNELS.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setChannel(c.value)}
                aria-pressed={channel === c.value}
                className={cx(
                  "relative cursor-pointer rounded-[2px] px-2.5 py-1 meta transition-colors",
                  channel === c.value ? "text-ink" : "text-ink-3 hover:text-ink-2",
                )}
              >
                {channel === c.value ? (
                  <motion.span
                    layoutId="draft-channel"
                    className="absolute inset-0 rounded-[2px] bg-paper"
                    transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 36 }}
                  />
                ) : null}
                <span className="relative">{c.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={() => void runDraft()}
            disabled={streaming || tooShort || availability === "off"}
            title={tooShort ? "Add more detail first." : undefined}
          >
            {streaming ? (
              <>
                <RefreshCw size={13} className="animate-spin" aria-hidden />
                Writing…
              </>
            ) : draft ? (
              <>
                <RefreshCw size={13} aria-hidden />
                Regenerate
              </>
            ) : (
              <>
                <Wand2 size={13} aria-hidden />
                Draft follow-up
              </>
            )}
          </Button>

          {streaming ? (
            <Button size="sm" variant="ghost" onClick={() => abortRef.current?.abort()}>
              Stop
            </Button>
          ) : null}

          {draft && !streaming ? (
            <>
              <Button size="sm" onClick={() => void copy()}>
                {copied ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />}
                {copied ? "Copied" : "Copy"}
              </Button>
              <Button size="sm" onClick={() => void saveToTimeline()}>
                <Send size={13} aria-hidden />
                Save to timeline
              </Button>
            </>
          ) : null}
        </div>

        <AnimatePresence mode="wait">
          {draft ? (
            <motion.div
              key="draft"
              initial={reduce ? false : { opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: reduce ? 0 : 0.2 }}
              className="overflow-hidden"
            >
              <div className="hairline rounded-[3px] bg-paper-2 p-4">
                <pre
                  className={cx(
                    "wh-pre-wrap font-sans text-[14.5px] leading-relaxed break-words whitespace-pre-wrap text-ink",
                    streaming && "caret",
                  )}
                >
                  {draft}
                </pre>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {error ? (
        <p role="alert" className="rounded-[3px] border border-[#E8BFBC] bg-[#F8DFDD] px-3 py-2 text-[13px] text-[#8E1F19] dark:border-[#5A2723] dark:bg-[#3A1715] dark:text-[#FF8078]">
          {error}
        </p>
      ) : null}

      {availability === "off" ? (
        <p className="flex items-start gap-2 rounded-[3px] border border-dashed border-paper-3 px-3 py-2.5 text-[13px] text-ink-3">
          <KeyRound size={14} className="mt-0.5 shrink-0" aria-hidden />
          <span>
            No AI key configured. Set <code className="meta">AI_API_KEY</code> (or turn on demo
            mode) in <code className="meta">.env</code> — see Settings.
          </span>
        </p>
      ) : null}
    </section>
  );
}

function AvailabilityBadge({ availability }: { availability: "live" | "mock" | "off" }) {
  const meta = {
    live: { label: "Live model", cls: "border-[#0B6E4F]/40 bg-[#DAEFE6] text-[#08543C] dark:bg-[#0C2A20] dark:text-[#5FD3AC]" },
    mock: { label: "Demo mode", cls: "border-signal/40 bg-signal-soft text-signal" },
    off: { label: "Not configured", cls: "border-paper-3 bg-paper-2 text-ink-3" },
  }[availability];

  return (
    <span className={cx("rounded-[3px] border px-2 py-1 meta", meta.cls)}>{meta.label}</span>
  );
}
