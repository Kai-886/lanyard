"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Plus, X } from "lucide-react";
import { Button, Field, Input, Modal, Select, Textarea, cx, useToast } from "@/components/ui";
import { useEvents, useLead } from "@/lib/hooks";
import { api, RequestError } from "@/lib/api";
import { LEAD_STATUSES, STATUS_META } from "@/lib/statuses";
import { leadInputSchema, type LeadInput } from "@/lib/validation";
import type { EventDTO, LeadDTO } from "@/lib/types";

const BLANK: LeadInput = {
  name: "",
  company: null,
  title: null,
  email: null,
  phone: null,
  source: null,
  notes: "",
  status: "NEW",
  temperature: null,
  eventId: "",
  tags: [],
  nextFollowUpAt: null,
};

export function LeadForm({ leadId }: { leadId?: string }) {
  const router = useRouter();
  const toast = useToast();
  const events = useEvents();
  const existing = useLead(leadId ?? "");
  const [tagDraft, setTagDraft] = useState("");
  const [eventModal, setEventModal] = useState(false);
  const [dirty, setDirty] = useState(false);

  const form = useForm<LeadInput>({
    resolver: zodResolver(leadInputSchema),
    mode: "onBlur",
    defaultValues: BLANK,
  });

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    getValues,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = form;

  /* Hydrate from the server record once, then stay in user-controlled state. */
  useEffect(() => {
    if (!leadId || !existing.data) return;
    const l: LeadDTO = existing.data;
    reset({
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
      tags: l.tags,
      nextFollowUpAt: l.nextFollowUpAt ? l.nextFollowUpAt.slice(0, 10) : null,
    });
  }, [leadId, existing.data, reset]);

  /* Default to the first event so the form is submittable immediately. */
  useEffect(() => {
    if (leadId || events.data?.length === 0) return;
    if (!getValues("eventId") && events.data?.[0]) {
      setValue("eventId", events.data[0].id, { shouldDirty: true });
    }
  }, [events.data, getValues, setValue, leadId]);

  /* Unsaved-changes guard (FR-2). */
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const addTag = () => {
    const t = tagDraft.trim().toLowerCase().replace(/\s+/g, "-").slice(0, 32);
    if (!t) return;
    const current = getValues("tags") ?? [];
    if (!current.includes(t) && current.length < 12) {
      setValue("tags", [...current, t], { shouldDirty: true });
    }
    setTagDraft("");
  };

  const onSubmit = async (values: LeadInput) => {
    try {
      if (leadId) {
        await api.patch<{ lead: LeadDTO }>(`/api/leads/${leadId}`, values);
        toast("Lead saved");
        setDirty(false);
        router.push(`/leads/${leadId}`);
      } else {
        const res = await api.post<{ lead: LeadDTO; duplicate: { id: string; name: string } | null }>(
          "/api/leads",
          values,
        );
        if (res.duplicate) {
          toast(`Heads up — ${res.duplicate.name} already has this email in this event.`);
        } else {
          toast("Badge added to the rail");
        }
        setDirty(false);
        router.push(`/leads/${res.lead.id}`);
      }
      router.refresh();
    } catch (err) {
      if (err instanceof RequestError && err.fields) {
        for (const [key, message] of Object.entries(err.fields)) {
          if (key in BLANK) {
            setError(key as keyof LeadInput, { type: "server", message });
          }
        }
        toast(err.message);
      } else {
        toast("Could not save that lead.");
      }
    }
  };

  const cancel = () => {
    if (dirty && !window.confirm("Discard unsaved changes?")) return;
    router.push(leadId ? `/leads/${leadId}` : "/leads");
  };

  if (leadId && existing.isPending) {
    return <div className="skeleton h-[520px] rounded-[4px]" />;
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      onChange={() => setDirty(true)}
      className="grid gap-6 lg:grid-cols-[1.4fr_1fr]"
    >
      <div className="flex flex-col gap-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" required error={errors.name?.message}>
            <Input
              {...register("name")}
              placeholder="Maya Okonkwo"
              autoComplete="off"
              aria-invalid={Boolean(errors.name)}
            />
          </Field>
          <Field label="Company" error={errors.company?.message}>
            <Input {...register("company")} placeholder="Northwind Analytics" />
          </Field>
          <Field label="Role" error={errors.title?.message}>
            <Input {...register("title")} placeholder="VP Revenue Operations" />
          </Field>
          <Field label="Email" error={errors.email?.message}>
            <Input
              {...register("email")}
              type="email"
              placeholder="maya@northwind.io"
              autoComplete="off"
              aria-invalid={Boolean(errors.email)}
            />
          </Field>
          <Field label="Phone" error={errors.phone?.message}>
            <Input {...register("phone")} placeholder="+1 415 555 0143" />
          </Field>
          <Field label="Met via" hint="Booth, talk, dinner, hallway…" error={errors.source?.message}>
            <Input {...register("source")} placeholder="Booth — demo corner" />
          </Field>
        </div>

        <Field
          label="Interaction notes"
          hint="Write it the way you'd scribble it. This is what the AI reads."
          error={errors.notes?.message}
        >
          <Textarea
            {...register("notes")}
            rows={9}
            placeholder="QBR deck is a mess — hates standard reports. Asked what the export looks like. Whiskey: no ice."
          />
        </Field>

        <div>
          <span className="meta mb-1.5 block text-ink-2">Tags</span>
          <div className="flex flex-wrap items-center gap-2">
            {(watch("tags") ?? []).map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1.5 rounded-[3px] border border-paper-3 bg-paper-2 px-2 py-1 meta text-ink-2"
              >
                {tag}
                <button
                  type="button"
                  aria-label={`Remove tag ${tag}`}
                  onClick={() =>
                    setValue(
                      "tags",
                      (getValues("tags") ?? []).filter((t) => t !== tag),
                      { shouldDirty: true },
                    )
                  }
                  className="cursor-pointer text-ink-3 hover:text-ink"
                >
                  <X size={11} />
                </button>
              </span>
            ))}
            <div className="flex items-center gap-1.5">
              <Input
                value={tagDraft}
                onChange={(e) => setTagDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    addTag();
                  }
                }}
                onBlur={addTag}
                placeholder="revops"
                aria-label="Add a tag"
                className="h-8 w-32 px-2 py-1 text-[13px]"
              />
              <Button type="button" size="sm" variant="ghost" onClick={addTag}>
                <Plus size={13} aria-hidden />
                Add
              </Button>
            </div>
          </div>
          {errors.tags?.message ? (
            <p role="alert" className="mt-1.5 text-[13px] text-[#B3261E]">
              {errors.tags.message}
            </p>
          ) : null}
        </div>
      </div>

      {/* -------------------------------------------------------- side column */}
      <aside className="flex flex-col gap-4">
        <div className="hairline rounded-[4px] bg-paper p-4">
          <span className="meta mb-2 block text-ink-2">
            Event <span className="text-signal">•</span>
          </span>
          <Controller
            control={control}
            name="eventId"
            render={({ field }) => (
              <Select
                value={field.value ?? ""}
                onChange={(e) => field.onChange(e.target.value)}
                aria-label="Event"
                aria-invalid={Boolean(errors.eventId)}
                className={cx(errors.eventId && "border-[#B3261E]")}
              >
                <option value="" disabled>
                  Choose an event…
                </option>
                {(events.data ?? []).map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </Select>
            )}
          />
          {errors.eventId?.message ? (
            <p role="alert" className="mt-1.5 text-[13px] text-[#B3261E]">
              {errors.eventId.message}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => setEventModal(true)}
            className="mt-2 cursor-pointer meta text-ink-3 underline decoration-dotted underline-offset-4 hover:text-ink"
          >
            + New event
          </button>
        </div>

        <div className="hairline rounded-[4px] bg-paper p-4">
          <span className="meta mb-2 block text-ink-2">Status</span>
          <Controller
            control={control}
            name="status"
            render={({ field }) => (
              <div className="grid grid-cols-3 gap-1.5">
                {LEAD_STATUSES.map((s) => {
                  const on = field.value === s;
                  const meta = STATUS_META[s];
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => field.onChange(s)}
                      aria-pressed={on}
                      className={cx(
                        "flex cursor-pointer items-center gap-1.5 rounded-[3px] border px-2 py-1.5 text-[12px] transition-colors",
                        on ? "border-ink font-semibold" : "border-paper-3 text-ink-2 hover:border-ink-3",
                      )}
                    >
                      <span className="h-2.5 w-[3px] rounded-full" style={{ background: meta.tab }} />
                      {meta.label}
                    </button>
                  );
                })}
              </div>
            )}
          />
        </div>

        <div className="hairline rounded-[4px] bg-paper p-4">
          <Field
            label="Next follow-up"
            hint="Drives the due / overdue views."
            error={errors.nextFollowUpAt?.message}
          >
            <Input {...register("nextFollowUpAt")} type="date" />
          </Field>
        </div>

        <div className="hairline rounded-[4px] bg-paper p-4 text-[13px] leading-relaxed text-ink-2">
          <p>
            Only <span className="text-ink">name</span> and an{" "}
            <span className="text-ink">event</span> are required. Everything else can be filled in
            later — capture fast, tidy up after.
          </p>
        </div>

        <div className="flex gap-2">
          <Button type="submit" variant="primary" size="lg" disabled={isSubmitting} className="flex-1">
            {isSubmitting ? "Saving…" : leadId ? "Save changes" : "Add to rail"}
          </Button>
          <Button type="button" size="lg" variant="ghost" onClick={cancel}>
            Cancel
          </Button>
        </div>
      </aside>

      <NewEventModal
        open={eventModal}
        onClose={() => setEventModal(false)}
        onCreated={(event) => {
          setValue("eventId", event.id, { shouldDirty: true });
          setEventModal(false);
          toast("Event created");
        }}
      />
    </form>
  );
}

function NewEventModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (e: EventDTO) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [startsAt, setStartsAt] = useState(today);
  const [endsAt, setEndsAt] = useState(today);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { refetch } = useEvents();

  const submit = async () => {
    if (!name.trim()) {
      setError("Give the event a name");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<{ event: EventDTO }>("/api/events", {
        name: name.trim(),
        location: location.trim() || null,
        startsAt,
        endsAt: endsAt || startsAt,
        accent: "#FF4D00",
      });
      await refetch();
      setName("");
      setLocation("");
      onCreated(res.event);
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
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={busy}>
            {busy ? "Creating…" : "Create event"}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Field label="Name" required error={error ?? undefined}>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="SaaStr Annual 2027"
            autoFocus
          />
        </Field>
        <Field label="Location">
          <Input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="San Francisco, CA"
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Starts">
            <Input type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
          </Field>
          <Field label="Ends">
            <Input type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}
