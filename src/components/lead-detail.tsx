"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowLeft,
  CalendarClock,
  FlipHorizontal,
  Mail,
  Pencil,
  Phone,
  Plus,
  Trash2,
} from "lucide-react";
import { BarcodeMark, Button, Field, Input, Modal, Textarea, cx, useToast } from "@/components/ui";
import { Monogram, StatusChip } from "@/components/lead-badge";
import { AiPanel } from "@/components/ai-panel";
import { api, RequestError } from "@/lib/api";
import { useFollowUps, useInvalidate, useLead } from "@/lib/hooks";
import { CHANNELS, LEAD_STATUSES, STATUS_META, type LeadStatus } from "@/lib/statuses";
import type { FollowUpDTO, LeadDTO } from "@/lib/types";

export function LeadDetail({ id }: { id: string }) {
  const lead = useLead(id);
  if (lead.isPending) {
    return (
      <div className="flex flex-col gap-4 pt-8">
        <div className="skeleton h-8 w-52 rounded-[3px]" />
        <div className="skeleton h-[260px] rounded-[4px]" />
        <div className="skeleton h-[220px] rounded-[4px]" />
      </div>
    );
  }
  if (lead.isError || !lead.data) {
    return (
      <div className="flex flex-col items-start gap-4 pt-16">
        <h1 className="display text-2xl">That badge isn&apos;t on the rail</h1>
        <p className="text-ink-2">It may have been deleted, or the link is wrong.</p>
        <Link href="/leads">
          <Button variant="primary">Back to the rail</Button>
        </Link>
      </div>
    );
  }
  return <Detail lead={lead.data} />;
}

function Detail({ lead }: { lead: LeadDTO }) {
  const router = useRouter();
  const toast = useToast();
  const [flipped, setFlipped] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const invalidate = useInvalidate(["lead", lead.id], ["leads"], ["stats"]);

  const changeStatus = async (status: LeadStatus) => {
    if (status === lead.status) return;
    try {
      await api.patch(`/api/leads/${lead.id}`, { status });
      invalidate();
      toast(`Status → ${STATUS_META[status].label}`);
    } catch {
      toast("Could not change the status.");
    }
  };

  const snapshotForUndo = async (): Promise<Record<string, unknown> | null> => {
    try {
      const [leadRes, fuRes] = await Promise.all([
        api.get<{ lead: LeadDTO }>(`/api/leads/${lead.id}`),
        api.get<{ items: FollowUpDTO[] }>(`/api/leads/${lead.id}/followups`),
      ]);
      const l = leadRes.lead;
      return {
        id: l.id,
        name: l.name,
        company: l.company,
        title: l.title,
        email: l.email,
        phone: l.phone,
        source: l.source,
        notes: l.notes,
        status: l.status,
        temperature: l.temperature,
        eventId: l.event.id,
        createdAt: l.createdAt,
        nextFollowUpAt: l.nextFollowUpAt,
        lastContactedAt: l.lastContactedAt,
        tags: l.tags,
        followUps: fuRes.items.map((f) => ({
          channel: f.channel,
          direction: f.direction,
          body: f.body,
          sentAt: f.sentAt,
        })),
      };
    } catch {
      return null;
    }
  };

  const onDelete = async () => {
    const snapshot = await snapshotForUndo();
    try {
      await api.del(`/api/leads/${lead.id}`);
      invalidate();
      router.push("/leads");
      router.refresh();
      toast(`${lead.name} deleted`, {
        undo: snapshot
          ? async () => {
              try {
                await api.post("/api/leads/restore", snapshot);
                invalidate();
                toast(`${lead.name} is back on the rail`);
              } catch {
                toast("Could not restore that lead.");
              }
            }
          : undefined,
      });
    } catch {
      toast("Could not delete that lead.");
    }
  };

  return (
    <div className="flex flex-col gap-5 pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/leads"
          className="inline-flex items-center gap-1.5 text-sm text-ink-2 transition-colors hover:text-ink"
        >
          <ArrowLeft size={15} aria-hidden />
          The rail
        </Link>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => router.push(`/leads/${lead.id}/edit`)}>
            <Pencil size={13} aria-hidden />
            Edit
          </Button>
          <Button size="sm" variant="danger" onClick={() => setConfirmDelete(true)}>
            <Trash2 size={13} aria-hidden />
            Delete
          </Button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.55fr_1fr]">
        <div className="flex flex-col gap-5">
          <FlipBadge lead={lead} flipped={flipped} onFlip={() => setFlipped((v) => !v)} />
          <NotesCard lead={lead} />
          <TimelineCard leadId={lead.id} />
        </div>

        <aside className="flex flex-col gap-5">
          <StatusCard lead={lead} onChange={changeStatus} />
          <AiPanel lead={lead} />
          <MetaCard lead={lead} />
        </aside>
      </div>

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this badge?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              Keep it
            </Button>
            <Button variant="danger" onClick={() => void onDelete()}>
              {lead.followUpCount > 0 ? `Delete with ${lead.followUpCount} follow-ups` : "Delete"}
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-ink-2">
          {lead.followUpCount > 0
            ? `${lead.name} has ${lead.followUpCount} logged follow-up${lead.followUpCount === 1 ? "" : "s"}. They'll go with it.`
            : `${lead.name} will come off the rail. You'll have five seconds to undo.`}
        </p>
      </Modal>
    </div>
  );
}

/* --------------------------------------------------------------- flip badge */

function FlipBadge({
  lead,
  flipped,
  onFlip,
}: {
  lead: LeadDTO;
  flipped: boolean;
  onFlip: () => void;
}) {
  const reduce = useReducedMotion();
  const frontRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(240);

  useLayoutEffect(() => {
    const measure = () => {
      const node = flipped ? backRef.current : frontRef.current;
      if (node) setHeight(Math.max(node.scrollHeight, 200));
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (frontRef.current) observer.observe(frontRef.current);
    if (backRef.current) observer.observe(backRef.current);
    return () => observer.disconnect();
  }, [flipped, lead]);

  const meta = STATUS_META[lead.status];

  return (
    <div style={{ perspective: 1400 }}>
      <motion.div
        layout={!reduce}
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={reduce ? { duration: 0 } : { duration: 0.4, ease: [0.2, 0.7, 0.3, 1] }}
        style={{ transformStyle: "preserve-3d", height }}
        className="relative"
      >
        {/* ------------------------------------------------------- front */}
        <div
          ref={frontRef}
          style={{ backfaceVisibility: "hidden" }}
          className="ticket hairline absolute inset-0 flex flex-col gap-4 overflow-hidden rounded-[4px] p-5"
        >
          <span aria-hidden className="absolute inset-y-0 left-0 w-[6px]" style={{ background: meta.tab }} />
          <div className="flex items-start gap-4 pl-3">
            <Monogram name={lead.name} id={lead.id} size={64} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="display text-[clamp(1.5rem,3vw,2.1rem)]">{lead.name}</h1>
                <StatusChip status={lead.status} small />
              </div>
              <p className="mt-1 text-[15px] text-ink-2">
                {[lead.title, lead.company].filter(Boolean).join(" at ") || "Role not recorded"}
              </p>
            </div>
            <button
              type="button"
              onClick={onFlip}
              aria-label="Flip the badge"
              title="Flip the badge"
              className="hairline flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-[3px] bg-paper-2 text-ink-3 transition-colors hover:text-ink"
            >
              <FlipHorizontal size={16} />
            </button>
          </div>

          <div className="mt-auto flex flex-wrap items-center gap-x-5 gap-y-2 pl-3">
            <span className="meta text-ink-3">#{lead.id.slice(-8).toUpperCase()}</span>
            <span className="meta text-ink-3">
              Met {new Date(lead.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
            </span>
            {lead.source ? <span className="meta text-ink-3">{lead.source}</span> : null}
            <span className="ml-auto text-ink-3/70">
              <BarcodeMark seed={lead.id.length * 977} height={20} className="w-40" />
            </span>
          </div>
        </div>

        {/* -------------------------------------------------------- back */}
        <div
          ref={backRef}
          style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
          className="ticket hairline absolute inset-0 flex flex-col gap-4 overflow-hidden rounded-[4px] p-5"
        >
          <span aria-hidden className="absolute inset-y-0 left-0 w-[6px]" style={{ background: meta.tab }} />
          <div className="flex items-center justify-between gap-3 pl-3">
            <span className="meta text-ink-3">Back of badge</span>
            <button
              type="button"
              onClick={onFlip}
              aria-label="Flip back to the front"
              className="hairline flex h-9 w-9 cursor-pointer items-center justify-center rounded-[3px] bg-paper-2 text-ink-3 transition-colors hover:text-ink"
            >
              <FlipHorizontal size={16} />
            </button>
          </div>

          <dl className="grid flex-1 grid-cols-1 gap-x-6 gap-y-3 pl-3 sm:grid-cols-2">
            <BackRow label="Email">
              {lead.email ? (
                <a href={`mailto:${lead.email}`} className="inline-flex items-center gap-1.5 text-signal hover:underline">
                  <Mail size={13} aria-hidden />
                  {lead.email}
                </a>
              ) : (
                "—"
              )}
            </BackRow>
            <BackRow label="Phone">
              {lead.phone ? (
                <a href={`tel:${lead.phone}`} className="inline-flex items-center gap-1.5 hover:text-signal">
                  <Phone size={13} aria-hidden />
                  {lead.phone}
                </a>
              ) : (
                "—"
              )}
            </BackRow>
            <BackRow label="Event">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: lead.event.accent }} />
                {lead.event.name}
              </span>
            </BackRow>
            <BackRow label="Met via">{lead.source ?? "—"}</BackRow>
            <BackRow label="Last contacted">
              {lead.lastContactedAt ? (
                <span className="inline-flex items-center gap-1.5">
                  <CalendarClock size={13} aria-hidden />
                  {new Date(lead.lastContactedAt).toLocaleDateString()}
                </span>
              ) : (
                "Never"
              )}
            </BackRow>
            <BackRow label="Follow-ups logged">{String(lead.followUpCount)}</BackRow>
          </dl>
        </div>
      </motion.div>
    </div>
  );
}

function BackRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b border-dashed border-paper-3 pb-2">
      <dt className="meta text-ink-3">{label}</dt>
      <dd className="truncate text-[14.5px] text-ink">{children}</dd>
    </div>
  );
}

/* ------------------------------------------------------------------ notes */

function NotesCard({ lead }: { lead: LeadDTO }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(lead.notes);
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const invalidate = useInvalidate(["lead", lead.id], ["leads"]);

  /* Render-phase reset when a different badge is opened — avoids the
     setState-in-effect cascade the compiler now flags. */
  const [seenId, setSeenId] = useState(lead.id);
  if (seenId !== lead.id) {
    setSeenId(lead.id);
    setValue(lead.notes);
    setEditing(false);
  }

  const save = async () => {
    setSaving(true);
    try {
      await api.patch(`/api/leads/${lead.id}`, {
        name: lead.name,
        company: lead.company,
        title: lead.title,
        email: lead.email,
        phone: lead.phone,
        source: lead.source,
        notes: value,
        status: lead.status,
        temperature: lead.temperature,
        eventId: lead.event.id,
        tags: lead.tags,
        nextFollowUpAt: lead.nextFollowUpAt ? lead.nextFollowUpAt.slice(0, 10) : null,
      });
      invalidate();
      setEditing(false);
      toast("Notes saved");
    } catch (err) {
      toast(err instanceof RequestError ? err.message : "Could not save the notes.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="hairline rounded-[4px] bg-paper p-5" aria-label="Interaction notes">
      <header className="mb-3 flex items-center justify-between gap-3">
        <h2 className="display text-lg">Notes</h2>
        <div className="flex items-center gap-2">
          {lead.tags.length > 0 ? (
            <ul className="flex flex-wrap gap-1.5">
              {lead.tags.map((t) => (
                <li key={t} className="meta rounded-[2px] border border-paper-3 bg-paper-2 px-1.5 py-0.5 text-ink-3">
                  {t}
                </li>
              ))}
            </ul>
          ) : null}
          <Button size="sm" variant="ghost" onClick={() => setEditing((v) => !v)}>
            {editing ? "Cancel" : "Edit"}
          </Button>
        </div>
      </header>

      {editing ? (
        <div className="flex flex-col gap-3">
          <Textarea value={value} onChange={(e) => setValue(e.target.value)} rows={8} autoFocus />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button size="sm" variant="primary" onClick={() => void save()} disabled={saving}>
              {saving ? "Saving…" : "Save notes"}
            </Button>
          </div>
        </div>
      ) : lead.notes ? (
        <p className="text-[15px] leading-relaxed whitespace-pre-wrap text-ink">{lead.notes}</p>
      ) : (
        <p className="rounded-[3px] border border-dashed border-paper-3 px-3 py-4 text-[13.5px] text-ink-3">
          No notes yet. Scribble whatever you remember — the AI reads this.
        </p>
      )}
    </section>
  );
}

/* --------------------------------------------------------------- timeline */

function TimelineCard({ leadId }: { leadId: string }) {
  const followUps = useFollowUps(leadId);
  const toast = useToast();
  const invalidate = useInvalidate(["lead", leadId], ["leads"], ["stats"]);
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [channel, setChannel] = useState<(typeof CHANNELS)[number]>("EMAIL");
  const [busy, setBusy] = useState(false);

  const items = followUps.data ?? [];

  const add = async () => {
    if (!body.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/followups`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ channel, direction: "OUT", body: body.trim() }),
      });
      if (!res.ok) throw new Error("failed");
      setBody("");
      setOpen(false);
      invalidate();
      toast("Follow-up logged");
    } catch {
      toast("Could not log that follow-up.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="hairline rounded-[4px] bg-paper p-5" aria-label="Follow-up timeline">
      <header className="mb-3 flex items-center justify-between gap-3">
        <h2 className="display text-lg">Timeline</h2>
        <Button size="sm" onClick={() => setOpen((v) => !v)}>
          <Plus size={13} aria-hidden />
          Log follow-up
        </Button>
      </header>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="mb-4 flex flex-col gap-3 border-b border-dashed border-paper-3 pb-4">
              <div className="flex flex-wrap gap-1.5">
                {CHANNELS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setChannel(c)}
                    aria-pressed={channel === c}
                    className={cx(
                      "cursor-pointer rounded-[3px] border px-2 py-1 meta transition-colors",
                      channel === c ? "border-signal bg-signal-soft text-signal" : "border-paper-3 text-ink-3 hover:text-ink-2",
                    )}
                  >
                    {c === "LINKEDIN" ? "LinkedIn" : c.charAt(0) + c.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={4}
                placeholder="What you sent, or what they said back…"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button size="sm" variant="primary" onClick={() => void add()} disabled={busy || !body.trim()}>
                  {busy ? "Saving…" : "Log it"}
                </Button>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {followUps.isPending ? (
        <div className="skeleton h-24 rounded-[3px]" />
      ) : items.length === 0 ? (
        <p className="rounded-[3px] border border-dashed border-paper-3 px-3 py-4 text-[13.5px] text-ink-3">
          Nothing logged yet. Anything you send counts — record it so the next person on the team
          knows where this stands.
        </p>
      ) : (
        <ol className="relative flex flex-col gap-4 border-l border-dashed border-paper-3 pl-4">
          {items.map((f, i) => (
            <motion.li
              key={f.id}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(i * 0.04, 0.2), duration: 0.22 }}
              className="relative"
            >
              <span
                aria-hidden
                className="absolute top-1.5 -left-[21px] h-2 w-2 rounded-full border border-paper bg-paper-3"
              />
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="meta text-ink-2">{f.channel}</span>
                <span className="meta text-ink-3">{f.direction === "OUT" ? "sent" : "received"}</span>
                <time className="meta ml-auto text-ink-3" dateTime={f.sentAt}>
                  {new Date(f.sentAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </time>
              </div>
              <p className="mt-1 text-[14.5px] leading-relaxed whitespace-pre-wrap text-ink">{f.body}</p>
            </motion.li>
          ))}
        </ol>
      )}
    </section>
  );
}

/* ----------------------------------------------------------- status + meta */

function StatusCard({
  lead,
  onChange,
}: {
  lead: LeadDTO;
  onChange: (s: LeadStatus) => void;
}) {
  return (
    <section className="hairline rounded-[4px] bg-paper p-5" aria-label="Follow-up status">
      <h2 className="display mb-3 text-lg">Status</h2>
      <div className="grid grid-cols-2 gap-2">
        {LEAD_STATUSES.map((s) => {
          const on = lead.status === s;
          const meta = STATUS_META[s];
          return (
            <button
              key={s}
              type="button"
              onClick={() => onChange(s)}
              aria-pressed={on}
              className={cx(
                "flex cursor-pointer items-center gap-2 rounded-[3px] border px-2.5 py-2 text-[13px] transition-colors",
                on
                  ? "border-ink bg-paper-2 font-semibold"
                  : "border-paper-3 text-ink-2 hover:border-ink-3",
              )}
            >
              <span className="h-3.5 w-[3px] rounded-full" style={{ background: meta.tab }} />
              {meta.label}
            </button>
          );
        })}
      </div>
      <div className="mt-4 border-t border-dashed border-paper-3 pt-3">
        <Field label="Next follow-up" hint="Drives the due and overdue views.">
          <NextFollowUpInput lead={lead} />
        </Field>
      </div>
    </section>
  );
}

function NextFollowUpInput({ lead }: { lead: LeadDTO }) {
  const toast = useToast();
  const invalidate = useInvalidate(["lead", lead.id], ["leads"]);
  return (
    <Input
      type="date"
      defaultValue={lead.nextFollowUpAt ? lead.nextFollowUpAt.slice(0, 10) : ""}
      onChange={async (e) => {
        try {
          await api.patch(`/api/leads/${lead.id}`, {
            name: lead.name,
            company: lead.company,
            title: lead.title,
            email: lead.email,
            phone: lead.phone,
            source: lead.source,
            notes: lead.notes,
            status: lead.status,
            temperature: lead.temperature,
            eventId: lead.event.id,
            tags: lead.tags,
            nextFollowUpAt: e.target.value || null,
          });
          invalidate();
          toast(e.target.value ? "Follow-up scheduled" : "Follow-up cleared");
        } catch {
          toast("Could not save that date.");
        }
      }}
    />
  );
}

function MetaCard({ lead }: { lead: LeadDTO }) {
  const rows: [string, React.ReactNode][] = [
    ["Record", <span key="r" className="meta">{lead.id}</span>],
    [
      "Event",
      <span key="e" className="inline-flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full" style={{ background: lead.event.accent }} />
        {lead.event.name}
      </span>,
    ],
    ["Event date", new Date(lead.event.startsAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })],
    ["Updated", new Date(lead.updatedAt).toLocaleString()],
    ["Temperature", lead.temperature ?? "not scored"],
    ["AI summary", lead.aiGeneratedAt ? `${lead.aiModel ?? "model"} · ${new Date(lead.aiGeneratedAt).toLocaleDateString()}` : "not generated"],
  ];

  return (
    <section className="hairline rounded-[4px] bg-paper p-5" aria-label="Record details">
      <h2 className="display mb-3 text-lg">Record</h2>
      <dl className="flex flex-col gap-2.5">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-4 border-b border-dashed border-paper-3 pb-2 last:border-0">
            <dt className="meta shrink-0 text-ink-3">{label}</dt>
            <dd className="truncate text-right text-[13.5px] text-ink">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
