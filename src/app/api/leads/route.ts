import { created, handleError, ok, parseBody } from "@/lib/http";
import { listLeads } from "@/lib/leads";
import { createLead } from "@/lib/mutations";
import { filtersFromParams } from "@/lib/filters";
import { leadInputSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const filters = filtersFromParams(url.searchParams);
    const page = await listLeads(filters);
    return ok(page);
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: Request) {
  try {
    const { data, error } = await parseBody(req, leadInputSchema);
    if (error) return error;

    const duplicate = await findDuplicateEmail(data.email, data.eventId);
    const lead = await createLead(data);
    return created({ lead, duplicate });
  } catch (err) {
    return handleError(err);
  }
}

/** Non-blocking duplicate warning (FR-1): the lead is still created. */
async function findDuplicateEmail(
  email: string | null | undefined,
  eventId: string,
): Promise<{ id: string; name: string } | null> {
  if (!email) return null;
  const existing = await import("@/lib/db").then((m) =>
    m.db.lead.findFirst({
      where: { email, eventId },
      select: { id: true, name: true },
    }),
  );
  return existing ?? null;
}
