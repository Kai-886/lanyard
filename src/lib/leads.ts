import { db } from "@/lib/db";
import { parseQuery } from "@/lib/search";
import { isStatus, type LeadStatus, type Temperature } from "@/lib/statuses";
import type { LeadDTO, LeadListResponse } from "@/lib/types";
import type { SearchFilters } from "@/lib/validation";
import type { Prisma } from "@/generated/prisma/client";

export type LeadWithRelations = Prisma.LeadGetPayload<{
  include: { event: true; tags: true; followUps: { orderBy: { sentAt: "desc" } } };
}>;

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function nextDay(d: Date): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + 1);
  return x;
}

export function buildWhere(f: SearchFilters): Prisma.LeadWhereInput {
  const and: Prisma.LeadWhereInput[] = [];

  const terms = parseQuery(f.q);
  if (terms.length > 0) {
    and.push({ AND: terms.map((t) => ({ search: { contains: t } })) });
  }

  if (f.status && f.status.length > 0) and.push({ status: { in: f.status } });
  if (f.event && f.event.length > 0) and.push({ eventId: { in: f.event } });
  if (f.tag && f.tag.length > 0)
    and.push({ tags: { some: { tag: { in: f.tag } } } });

  if (f.from || f.to) {
    and.push({
      createdAt: {
        ...(f.from ? { gte: new Date(`${f.from}T00:00:00`) } : {}),
        ...(f.to ? { lte: new Date(`${f.to}T23:59:59.999`) } : {}),
      },
    });
  }

  if (f.due === "today") {
    const t = startOfToday();
    and.push({ nextFollowUpAt: { gte: t, lt: nextDay(t) } });
  } else if (f.due === "overdue") {
    and.push({ nextFollowUpAt: { lt: startOfToday() } });
  } else if (f.due === "uncontacted") {
    and.push({ lastContactedAt: null });
  } else if (f.due === "has-email") {
    and.push({ NOT: { OR: [{ email: null }, { email: "" }] } });
  }

  return and.length > 0 ? { AND: and } : {};
}

const HEAT: Record<string, number> = { hot: 3, warm: 2, cold: 1 };

type SortKey = NonNullable<SearchFilters["sort"]>;

function compare(a: Projection, b: Projection, sort: SortKey): number {
  if (sort === "name") return a.name.localeCompare(b.name);
  if (sort === "event") {
    const d = b.eventDate.getTime() - a.eventDate.getTime();
    return d !== 0 ? d : a.name.localeCompare(b.name);
  }
  if (sort === "due") {
    const av = a.dueAt?.getTime() ?? Number.POSITIVE_INFINITY;
    const bv = b.dueAt?.getTime() ?? Number.POSITIVE_INFINITY;
    return av !== bv ? av - bv : a.name.localeCompare(b.name);
  }
  if (sort === "temperature") {
    const d = (HEAT[b.heat ?? ""] ?? 0) - (HEAT[a.heat ?? ""] ?? 0);
    return d !== 0 ? d : a.name.localeCompare(b.name);
  }
  return b.updatedAt.getTime() - a.updatedAt.getTime();
}

type Projection = {
  id: string;
  name: string;
  updatedAt: Date;
  createdAt: Date;
  dueAt: Date | null;
  heat: string | null;
  eventDate: Date;
};

/**
 * Order + paginate in application code over a lightweight projection.
 *
 * Prisma cannot express the mixed ordering we need (nulls-last due dates,
 * hot>warm>cold) on SQLite in one portable `orderBy`, and the projection keeps
 * `notes` out of the sort pass. At the stated 5k-lead ceiling this is a few
 * milliseconds against a local file; the full rows are only loaded for the
 * page that is actually returned.
 */
export async function listLeads(f: SearchFilters): Promise<LeadListResponse> {
  const where = buildWhere(f);
  const limit = f.limit ?? 24;
  const offset = f.cursor ? Number.parseInt(f.cursor, 10) || 0 : 0;
  const sort: SortKey = f.sort ?? "updated";

  const total = await db.lead.count({ where });

  const projection = await db.lead.findMany({
    where,
    select: {
      id: true,
      name: true,
      updatedAt: true,
      createdAt: true,
      nextFollowUpAt: true,
      temperature: true,
      event: { select: { startsAt: true } },
    },
  });

  const rows = projection.map((r) => ({
    id: r.id,
    name: r.name,
    updatedAt: r.updatedAt,
    createdAt: r.createdAt,
    dueAt: r.nextFollowUpAt,
    heat: r.temperature,
    eventDate: r.event.startsAt,
  }));

  rows.sort((a, b) => compare(a, b, sort));

  const page = rows.slice(offset, offset + limit);
  const ids = page.map((r) => r.id);

  const records =
    ids.length === 0
      ? []
      : await db.lead.findMany({
          where: { id: { in: ids } },
          include,
        });

  const byId = new Map(records.map((r) => [r.id, r]));
  const items: LeadDTO[] = [];
  for (const id of ids) {
    const record = byId.get(id);
    if (record) items.push(toLeadDTO(record));
  }

  return { items, total, hasMore: offset + limit < total };
}

const include = {
  event: true,
  tags: true,
  _count: { select: { followUps: true } },
} satisfies Prisma.LeadInclude;

export async function getLead(id: string): Promise<LeadDTO | null> {
  const lead = await db.lead.findUnique({ where: { id }, include });
  return lead ? toLeadDTO(lead) : null;
}

export type LeadRecord = Prisma.LeadGetPayload<{ include: typeof include }>;

export function toLeadDTO(lead: LeadRecord): LeadDTO {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  let due: LeadDTO["due"] = "none";
  if (lead.nextFollowUpAt) {
    const d = lead.nextFollowUpAt;
    if (d < today) due = "overdue";
    else if (d < tomorrow) due = "today";
    else due = "upcoming";
  }

  let summary = null;
  if (lead.aiSummary) {
    try {
      summary = JSON.parse(lead.aiSummary) as LeadDTO["aiSummary"];
    } catch {
      summary = null;
    }
  }

  return {
    id: lead.id,
    name: lead.name,
    company: lead.company,
    title: lead.title,
    email: lead.email,
    phone: lead.phone,
    source: lead.source,
    notes: lead.notes,
    status: (isStatus(lead.status) ? lead.status : "NEW") as LeadStatus,
    temperature: (lead.temperature as Temperature | null) ?? null,
    tags: lead.tags.map((t) => t.tag),
    event: {
      id: lead.event.id,
      name: lead.event.name,
      accent: lead.event.accent,
      startsAt: lead.event.startsAt.toISOString(),
    },
    nextFollowUpAt: lead.nextFollowUpAt?.toISOString() ?? null,
    lastContactedAt: lead.lastContactedAt?.toISOString() ?? null,
    createdAt: lead.createdAt.toISOString(),
    updatedAt: lead.updatedAt.toISOString(),
    aiSummary: summary,
    aiGeneratedAt: lead.aiGeneratedAt?.toISOString() ?? null,
    aiModel: lead.aiModel,
    followUpCount: lead._count.followUps,
    due,
  };
}

export { include as leadInclude };
