import { z } from "zod";
import { handleError, ok, parseBody } from "@/lib/http";
import { db } from "@/lib/db";
import { buildSearchIndex } from "@/lib/search";
import { leadInclude, toLeadDTO } from "@/lib/leads";

export const dynamic = "force-dynamic";

const snapshotSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  company: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  source: z.string().nullable().optional(),
  notes: z.string().optional(),
  status: z.string().optional(),
  temperature: z.string().nullable().optional(),
  eventId: z.string().min(1),
  createdAt: z.string().optional(),
  nextFollowUpAt: z.string().nullable().optional(),
  lastContactedAt: z.string().nullable().optional(),
  tags: z.array(z.string()).default([]),
  followUps: z
    .array(
      z.object({
        channel: z.string(),
        direction: z.string(),
        body: z.string(),
        sentAt: z.string(),
      }),
    )
    .default([]),
});

/**
 * Undo after a hard delete. The snapshot is held in memory on the client for the
 * length of the toast, so the restore re-inserts the original id, timestamps and
 * follow-up history rather than creating a near-copy.
 */
export async function POST(req: Request) {
  try {
    const { data, error } = await parseBody(req, snapshotSchema);
    if (error) return error;

    const event = await db.event.findUnique({ where: { id: data.eventId } });
    if (!event) return handleError(Object.assign(new Error("Event not found."), { status: 404 }));

    const search = buildSearchIndex({
      name: data.name,
      company: data.company ?? null,
      title: data.title ?? null,
      email: data.email ?? null,
      source: data.source ?? null,
      notes: data.notes ?? "",
      tags: data.tags,
      eventName: event.name,
    });

    const lead = await db.lead.create({
      data: {
        id: data.id,
        name: data.name,
        company: data.company ?? null,
        title: data.title ?? null,
        email: data.email ?? null,
        phone: data.phone ?? null,
        source: data.source ?? null,
        notes: data.notes ?? "",
        status: data.status ?? "NEW",
        temperature: data.temperature ?? null,
        eventId: data.eventId,
        nextFollowUpAt: data.nextFollowUpAt ? new Date(data.nextFollowUpAt) : null,
        lastContactedAt: data.lastContactedAt ? new Date(data.lastContactedAt) : null,
        createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
        search,
        tags: { create: data.tags.map((tag) => ({ tag })) },
        followUps: {
          create: data.followUps.map((f) => ({
            channel: f.channel,
            direction: f.direction,
            body: f.body,
            sentAt: new Date(f.sentAt),
          })),
        },
      },
      include: leadInclude,
    });

    return ok({ lead: toLeadDTO(lead) });
  } catch (err) {
    return handleError(err);
  }
}
