"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, Plus, Sparkles } from "lucide-react";
import { Button, EmptyState, cx } from "@/components/ui";
import { LeadBadge } from "@/components/lead-badge";
import { useLeads, useStats } from "@/lib/hooks";
import { STATUS_META } from "@/lib/statuses";

export function Overview() {
  const router = useRouter();
  const reduce = useReducedMotion();
  const stats = useStats();
  const dueToday = useLeads({ due: "today", sort: "due", limit: 6 });
  const overdue = useLeads({ due: "overdue", sort: "due", limit: 6 });

  const s = stats.data;
  const queue = [
    ...(overdue.data?.items ?? []).map((l) => ({ ...l, flag: "overdue" as const })),
    ...(dueToday.data?.items ?? []).map((l) => ({ ...l, flag: "today" as const })),
  ];

  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const tiles = [
    { key: "due", label: "Due now", value: (s?.overdue ?? 0) + (s?.dueToday ?? 0), accent: "#FF4D00", href: "/leads?due=today" },
    { key: "hot", label: "Hot leads", value: s?.hot ?? 0, accent: "#7A4BD1", href: "/leads?sort=temperature" },
    { key: "wait", label: "Awaiting reply", value: s?.awaitingReply ?? 0, accent: "#2F5FE0", href: "/leads?status=CONTACTED,QUALIFIED" },
    { key: "won", label: "Won", value: s?.won ?? 0, accent: "#0B6E4F", href: "/leads?status=WON" },
  ];

  return (
    <div className="flex flex-col gap-8 pt-8">
      {/* ------------------------------------------------------------ hero */}
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div>
          {/* The date is computed in the renderer's timezone, so it is explicitly
              exempted from hydration checking — server TZ and client TZ differ. */}
          <p className="meta text-ink-3" suppressHydrationWarning>
            {today}
          </p>
          <h1 className="display mt-2 text-[clamp(2.2rem,6vw,3.6rem)]">
            {queue.length > 0 ? (
              <>
                {queue.length} follow-up{queue.length === 1 ? "" : "s"}
                <br />
                <span className="text-signal">need you today.</span>
              </>
            ) : (
              <>
                The queue is clear.
                <br />
                <span className="text-signal">Go make more contacts.</span>
              </>
            )}
          </h1>
        </div>
        <div className="flex gap-2">
          <Button variant="primary" size="lg" onClick={() => router.push("/leads/new")}>
            <Plus size={16} aria-hidden />
            Capture
          </Button>
          <Button size="lg" onClick={() => router.push("/leads?due=overdue")}>
            Work the queue
            <ArrowRight size={16} aria-hidden />
          </Button>
        </div>
      </header>

      {/* ------------------------------------------------------------ tiles */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t, i) => (
          <motion.div
            key={t.key}
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: reduce ? 0 : i * 0.05, duration: 0.25 }}
          >
            <Link
              href={t.href}
              className="ticket hairline group flex flex-col gap-3 rounded-[4px] p-4 transition-transform hover:-translate-y-0.5"
            >
              <span className="flex items-center gap-2">
                <span className="h-2.5 w-[3px] rounded-full" style={{ background: t.accent }} />
                <span className="meta text-ink-3">{t.label}</span>
              </span>
              <span className="display text-[clamp(2rem,4vw,2.8rem)] leading-none">
                {stats.isPending ? "—" : t.value}
              </span>
              <span className="meta text-ink-3 transition-colors group-hover:text-signal">
                Open →
              </span>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* ------------------------------------------------------------ queue */}
      <section className="flex flex-col gap-4" aria-label="Follow-ups due">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="display text-xl">Today&apos;s queue</h2>
            <p className="mt-1 text-sm text-ink-2">
              Sorted by urgency. Overdue first — that&apos;s on purpose.
            </p>
          </div>
          <Link href="/leads" className="meta text-ink-3 hover:text-ink">
            All badges →
          </Link>
        </div>

        {queue.length === 0 ? (
          <EmptyState
            title="Nothing due"
            body="No follow-ups are scheduled for today or overdue. Schedule one from any badge and it'll show up here."
            icon={<Sparkles size={20} />}
            action={
              <Button variant="primary" onClick={() => router.push("/leads")}>
                Open the rail
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {queue.slice(0, 6).map((lead) => (
              <div key={lead.id} className="relative">
                <span
                  className={cx(
                    "meta absolute top-3 right-4 z-10 rounded-[2px] px-1.5 py-0.5",
                    lead.flag === "overdue"
                      ? "bg-[#B3261E] text-white"
                      : "bg-signal text-on-signal",
                  )}
                >
                  {lead.flag === "overdue" ? "overdue" : "today"}
                </span>
                <LeadBadge lead={lead} />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ----------------------------------------------------------- recent */}
      <section className="flex flex-col gap-4" aria-label="Recently captured">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="display text-xl">Fresh on the rail</h2>
            <p className="mt-1 text-sm text-ink-2">The last five badges to land.</p>
          </div>
        </div>

        {s?.recent.length ? (
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {s.recent.map((lead) => (
              <li key={lead.id}>
                <LeadBadge lead={lead} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="skeleton h-40 rounded-[4px]" />
        )}
      </section>

      {/* --------------------------------------------------------- breakdown */}
      {s ? (
        <section className="hairline rounded-[4px] bg-paper p-5" aria-label="Status breakdown">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="display text-xl">Pipeline shape</h2>
            <span className="meta text-ink-3">{s.total} total</span>
          </div>
          <div className="flex h-3 w-full overflow-hidden rounded-[2px] bg-paper-2">
            {Object.entries(s.byStatus).map(([status, count]) => {
              if (!count) return null;
              const pct = (count / Math.max(s.total, 1)) * 100;
              const meta =
                STATUS_META[status as keyof typeof STATUS_META] ?? STATUS_META.NEW;
              return (
                <motion.span
                  key={status}
                  initial={reduce ? false : { width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: reduce ? 0 : 0.5, ease: [0.2, 0.7, 0.3, 1] }}
                  title={`${meta.label}: ${count}`}
                  style={{ background: meta.tab }}
                  className="h-full"
                />
              );
            })}
          </div>
          <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
            {Object.entries(s.byStatus).map(([status, count]) => {
              const meta =
                STATUS_META[status as keyof typeof STATUS_META] ?? STATUS_META.NEW;
              return (
                <li key={status} className="flex items-center gap-2">
                  <span className="h-2.5 w-[3px] rounded-full" style={{ background: meta.tab }} />
                  <span className="meta text-ink-3">{meta.label}</span>
                  <span className="text-[13px] text-ink">{count}</span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
