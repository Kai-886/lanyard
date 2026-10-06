"use client";

import Link from "next/link";
import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { MapPin, Plus, Users } from "lucide-react";
import { Button, EmptyState, Field, Input, Modal, useToast } from "@/components/ui";
import { useEvents, useInvalidate } from "@/lib/hooks";
import { api, RequestError } from "@/lib/api";
import { LEAD_STATUSES, STATUS_META } from "@/lib/statuses";

const ACCENTS = ["#FF4D00", "#2F5FE0", "#0B6E4F", "#7A4BD1", "#B3261E", "#C9A227"];

export function EventsView() {
  const events = useEvents();
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col gap-6 pt-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="meta text-ink-3">Where you were</p>
          <h1 className="display mt-1 text-[clamp(1.9rem,4vw,2.6rem)]">Events</h1>
          <p className="mt-2 max-w-xl text-sm text-ink-2">
            Every badge belongs to an event. Filter the rail by one to see who you met where.
          </p>
        </div>
        <Button variant="primary" size="lg" onClick={() => setOpen(true)}>
          <Plus size={16} aria-hidden />
          New event
        </Button>
      </header>

      {events.isPending ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton h-52 rounded-[4px]" />
          ))}
        </div>
      ) : (events.data ?? []).length === 0 ? (
        <EmptyState
          title="No events yet"
          body="Create the conference or meetup you attended, then start capturing badges against it."
          icon={<Plus size={20} />}
          action={<Button variant="primary" onClick={() => setOpen(true)}>Create the first event</Button>}
        />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(events.data ?? []).map((e, i) => (
            <motion.li
              key={e.id}
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reduce ? 0 : i * 0.05, duration: 0.25 }}
            >
              <Link
                href={`/leads?event=${e.id}`}
                className="ticket hairline group flex h-full flex-col gap-4 rounded-[4px] p-5 transition-transform hover:-translate-y-0.5"
              >
                <span className="lanyard -mx-5 -mt-5" style={{ ["--lanyard" as string]: e.accent }} />
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="display text-lg leading-tight">{e.name}</h2>
                    <p className="mt-1 flex items-center gap-1.5 text-[13px] text-ink-2">
                      <MapPin size={12} aria-hidden />
                      {e.location ?? "Location TBC"}
                    </p>
                  </div>
                  <span className="flex items-center gap-1.5 meta text-ink-3">
                    <Users size={13} aria-hidden />
                    {e.leadCount}
                  </span>
                </div>

                <p className="meta text-ink-3">
                  {formatRange(e.startsAt, e.endsAt)}
                </p>

                <div className="mt-auto flex flex-col gap-2">
                  <div className="flex h-2 w-full overflow-hidden rounded-[2px] bg-paper-2">
                    {LEAD_STATUSES.map((s) => {
                      const count = e.statusMix?.[s] ?? 0;
                      if (!count) return null;
                      return (
                        <span
                          key={s}
                          title={`${STATUS_META[s].label}: ${count}`}
                          style={{
                            background: STATUS_META[s].tab,
                            width: `${(count / Math.max(e.leadCount ?? 1, 1)) * 100}%`,
                          }}
                          className="h-full"
                        />
                      );
                    })}
                  </div>
                  <span className="meta text-ink-3 transition-colors group-hover:text-signal">
                    View badges →
                  </span>
                </div>
              </Link>
            </motion.li>
          ))}
        </ul>
      )}

      <NewEventModal open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

function formatRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const opts = { month: "short", day: "numeric" } as const;
  const sameDay = s.toDateString() === e.toDateString();
  return sameDay
    ? s.toLocaleDateString(undefined, { ...opts, year: "numeric" })
    : `${s.toLocaleDateString(undefined, opts)} – ${e.toLocaleDateString(undefined, { ...opts, year: "numeric" })}`;
}

function NewEventModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const invalidate = useInvalidate(["events"], ["leads"], ["tags"]);
  const today = new Date().toISOString().slice(0, 10);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [startsAt, setStartsAt] = useState(today);
  const [endsAt, setEndsAt] = useState(today);
  const [accent, setAccent] = useState(ACCENTS[0]!);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const submit = async () => {
    setBusy(true);
    setError(undefined);
    try {
      await api.post("/api/events", { name, location: location || null, startsAt, endsAt: endsAt || startsAt, accent });
      invalidate();
      setName("");
      setLocation("");
      toast("Event created");
      onClose();
    } catch (err) {
      setError(err instanceof RequestError ? err.message : "Could not create the event");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New event"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => void submit()} disabled={busy}>
            {busy ? "Creating…" : "Create event"}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Field label="Name" required error={error}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Web Summit 2026" autoFocus />
        </Field>
        <Field label="Location">
          <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Lisbon, PT" />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Starts">
            <Input type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
          </Field>
          <Field label="Ends">
            <Input type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
          </Field>
        </div>
        <div>
          <span className="meta mb-2 block text-ink-2">Tab colour</span>
          <div className="flex gap-2">
            {ACCENTS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setAccent(c)}
                aria-label={`Use colour ${c}`}
                aria-pressed={accent === c}
                className="h-7 w-7 cursor-pointer rounded-[3px] transition-transform hover:scale-110"
                style={{ background: c, outline: accent === c ? "2px solid var(--ink)" : "none", outlineOffset: 2 }}
              />
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
