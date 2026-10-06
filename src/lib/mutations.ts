import { db } from "@/lib/db";
import { buildSearchIndex } from "@/lib/search";
import type { EventInput, LeadInput } from "@/lib/validation";
import { leadInclude, toLeadDTO } from "@/lib/leads";
import type { LeadDTO } from "@/lib/types";

/** Keep the denormalised search haystack in step with the record + its event. */
async function searchIndexFor(input: {
  name: string;
  company?: string | null;
  title?: string | null;
  email?: string | null;
  source?: string | null;
  notes?: string;
  tags?: string[];
  eventId: string;
}): Promise<string> {
  const event = await db.event.findUnique({
    where: { id: input.eventId },
    select: { name: true },
  });
  return buildSearchIndex({
    name: input.name,
    company: input.company ?? null,
    title: input.title ?? null,
    email: input.email ?? null,
    source: input.source ?? null,
    notes: input.notes ?? "",
    tags: input.tags ?? [],
    eventName: event?.name ?? null,
  });
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(`${value}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function createLead(input: LeadInput): Promise<LeadDTO> {
  const search = await searchIndexFor({ ...input, notes: input.notes ?? "" });

  const lead = await db.lead.create({
    data: {
      name: input.name,
      company: input.company ?? null,
      title: input.title ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      source: input.source ?? null,
      notes: input.notes ?? "",
      status: input.status ?? "NEW",
      temperature: input.temperature ?? null,
      eventId: input.eventId,
      nextFollowUpAt: parseDate(input.nextFollowUpAt),
      search,
      tags: { create: [...new Set(input.tags ?? [])].map((tag) => ({ tag })) },
    },
    include: leadInclude,
  });

  return toLeadDTO(lead);
}

export async function updateLead(id: string, input: LeadInput): Promise<LeadDTO> {
  const search = await searchIndexFor({ ...input, notes: input.notes ?? "" });

  const lead = await db.$transaction(async (tx) => {
    await tx.leadTag.deleteMany({ where: { leadId: id } });
    return tx.lead.update({
      where: { id },
      data: {
        name: input.name,
        company: input.company ?? null,
        title: input.title ?? null,
        email: input.email ?? null,
        phone: input.phone ?? null,
        source: input.source ?? null,
        notes: input.notes ?? "",
        status: input.status ?? "NEW",
        temperature: input.temperature ?? null,
        eventId: input.eventId,
        nextFollowUpAt: parseDate(input.nextFollowUpAt),
        search,
        tags: { create: [...new Set(input.tags ?? [])].map((tag) => ({ tag })) },
      },
      include: leadInclude,
    });
  });

  return toLeadDTO(lead);
}

export async function setStatus(id: string, status: string): Promise<LeadDTO> {
  const data: { status: string; lastContactedAt?: Date } = { status };
  if (status === "CONTACTED" || status === "REPLIED") {
    const current = await db.lead.findUnique({
      where: { id },
      select: { lastContactedAt: true },
    });
    if (!current?.lastContactedAt) data.lastContactedAt = new Date();
  }
  const lead = await db.lead.update({ where: { id }, data, include: leadInclude });
  return toLeadDTO(lead);
}

/** Hard delete, but returns enough for a client-side undo. */
export async function deleteLead(id: string): Promise<{ id: string }> {
  await db.lead.delete({ where: { id } });
  return { id };
}

export async function createEvent(input: EventInput) {
  return db.event.create({
    data: {
      name: input.name,
      location: input.location ?? null,
      startsAt: new Date(`${input.startsAt}T12:00:00`),
      endsAt: new Date(`${input.endsAt}T12:00:00`),
      accent: input.accent,
    },
  });
}

/**
 * Deleting an event that still has leads is refused unless `reassignTo` is
 * provided — silently orphaning or cascading 30 contacts would be indefensible.
 */
export async function deleteEvent(id: string, reassignTo?: string): Promise<void> {
  const count = await db.lead.count({ where: { eventId: id } });

  if (count > 0 && !reassignTo) {
    throw Object.assign(new Error(`This event still has ${count} lead(s).`), {
      status: 409,
      fields: { event: `Move the ${count} lead(s) somewhere else first.` },
    });
  }

  await db.$transaction(async (tx) => {
    if (count > 0 && reassignTo) {
      const target = await tx.event.findUnique({ where: { id: reassignTo } });
      if (!target) throw Object.assign(new Error("Target event not found."), { status: 404 });

      const leads = await tx.lead.findMany({
        where: { eventId: id },
        include: { tags: true },
      });
      for (const lead of leads) {
        const search = buildSearchIndex({
          name: lead.name,
          company: lead.company,
          title: lead.title,
          email: lead.email,
          source: lead.source,
          notes: lead.notes,
          eventName: target.name,
          tags: lead.tags.map((t) => t.tag),
        });
        await tx.lead.update({
          where: { id: lead.id },
          data: { eventId: reassignTo, search },
        });
      }
    }
    await tx.event.delete({ where: { id } });
  });
}
