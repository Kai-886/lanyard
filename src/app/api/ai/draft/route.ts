import { aiDraftSchema } from "@/lib/validation";
import { handleError, parseBody } from "@/lib/http";
import { db } from "@/lib/db";
import {
  AiNotConfiguredError,
  AiRateLimitError,
  draftFollowUp,
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

function encode(source: ReadableStream<string>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return source.pipeThrough(
    new TransformStream<string, Uint8Array>({
      transform(chunk, controller) {
        controller.enqueue(encoder.encode(chunk));
      },
    }),
  );
}

export async function POST(req: Request) {
  try {
    const { data, error } = await parseBody(req, aiDraftSchema);
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

    const result = await draftFollowUp(context, data.channel, clientIp(req));

    return new Response(encode(result.stream), {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store, no-transform",
        "X-Accel-Buffering": "no",
      },
    });
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
