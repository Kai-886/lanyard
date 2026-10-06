import { created, handleError, ok, parseBody } from "@/lib/http";
import { db } from "@/lib/db";
import { createEvent } from "@/lib/mutations";
import { eventInputSchema } from "@/lib/validation";
import { LEAD_STATUSES, isStatus } from "@/lib/statuses";
import type { EventDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const events = await db.event.findMany({
      orderBy: { startsAt: "desc" },
      include: { _count: { select: { leads: true } }, leads: { select: { status: true } } },
    });

    const items: EventDTO[] = events.map((e) => {
      const statusMix = Object.fromEntries(LEAD_STATUSES.map((s) => [s, 0])) as Record<
        (typeof LEAD_STATUSES)[number],
        number
      >;
      for (const lead of e.leads) {
        if (isStatus(lead.status)) statusMix[lead.status] += 1;
      }
      return {
        id: e.id,
        name: e.name,
        location: e.location,
        startsAt: e.startsAt.toISOString(),
        endsAt: e.endsAt.toISOString(),
        accent: e.accent,
        leadCount: e._count.leads,
        statusMix,
      };
    });

    return ok({ items });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: Request) {
  try {
    const { data, error } = await parseBody(req, eventInputSchema);
    if (error) return error;
    const event = await createEvent(data);
    return created({ event });
  } catch (err) {
    return handleError(err);
  }
}
