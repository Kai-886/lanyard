import { handleError, ok, parseBody } from "@/lib/http";
import { db } from "@/lib/db";
import { followUpInputSchema } from "@/lib/validation";
import type { FollowUpDTO } from "@/lib/types";
import { isStatus } from "@/lib/statuses";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

function toDTO(f: {
  id: string;
  channel: string;
  direction: string;
  body: string;
  sentAt: Date;
}): FollowUpDTO {
  return {
    id: f.id,
    channel: f.channel as FollowUpDTO["channel"],
    direction: f.direction as FollowUpDTO["direction"],
    body: f.body,
    sentAt: f.sentAt.toISOString(),
  };
}

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const rows = await db.followUp.findMany({
      where: { leadId: id },
      orderBy: { sentAt: "desc" },
    });
    return ok({ items: rows.map(toDTO) });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const lead = await db.lead.findUnique({ where: { id }, select: { status: true } });
    if (!lead) return handleError(Object.assign(new Error("Lead not found."), { status: 404 }));

    const { data, error } = await parseBody(req, followUpInputSchema);
    if (error) return error;

    const sentAt = data.sentAt ? new Date(`${data.sentAt}T12:00:00`) : new Date();
    const row = await db.$transaction(async (tx) => {
      const created = await tx.followUp.create({
        data: {
          leadId: id,
          channel: data.channel,
          direction: data.direction,
          body: data.body,
          sentAt,
        },
      });

      // Logging an outbound touch implies contact unless the lead already moved on.
      const advance =
        data.direction === "OUT" && isStatus(lead.status) && lead.status === "NEW";
      await tx.lead.update({
        where: { id },
        data: {
          lastContactedAt: sentAt,
          ...(advance ? { status: "CONTACTED" } : {}),
        },
      });
      return created;
    });

    return ok({ item: toDTO(row) }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
