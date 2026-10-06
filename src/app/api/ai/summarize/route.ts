import { aiSummarizeSchema } from "@/lib/validation";
import { handleError, ok, parseBody } from "@/lib/http";
import { db } from "@/lib/db";
import {
  AiNotConfiguredError,
  AiRateLimitError,
  summarizeLead,
  type AiLeadContext,
} from "@/lib/ai";

export const dynamic = "force-dynamic";

function clientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "local"
  );
}

export async function POST(req: Request) {
  try {
    const { data, error } = await parseBody(req, aiSummarizeSchema);
    if (error) return error;

    const lead = await db.lead.findUnique({
      where: { id: data.leadId },
      include: { event: true, tags: true },
    });
    if (!lead) return handleError(Object.assign(new Error("Lead not found."), { status: 404 }));

    if (lead.notes.trim().length < 15) {
      return handleError(
        Object.assign(new Error("Add a little more detail to the notes first."), {
          status: 422,
          fields: { notes: "Add a little more detail first." },
        }),
      );
    }

    const context: AiLeadContext = {
      id: lead.id,
      name: lead.name,
      company: lead.company,
      title: lead.title,
      notes: lead.notes,
      eventName: lead.event.name,
      tags: lead.tags.map((t) => t.tag),
    };

    const result = await summarizeLead(context, clientIp(req));
    return ok(result);
  } catch (err) {
    if (err instanceof AiNotConfiguredError) {
      return handleError(Object.assign(err, { status: 503 }));
    }
    if (err instanceof AiRateLimitError) {
      return handleError(Object.assign(err, { status: 429 }));
    }
    return handleError(err);
  }
}
