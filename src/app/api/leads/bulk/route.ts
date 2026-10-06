import { bulkActionSchema } from "@/lib/validation";
import { db } from "@/lib/db";
import { handleError, ok, parseBody } from "@/lib/http";
import { leadInclude, toLeadDTO } from "@/lib/leads";
import { isStatus } from "@/lib/statuses";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { data, error } = await parseBody(req, bulkActionSchema);
    if (error) return error;

    if (data.action === "delete") {
      const result = await db.lead.deleteMany({ where: { id: { in: data.ids } } });
      return ok({ deleted: result.count });
    }

    if (data.action === "export") {
      const rows = await db.lead.findMany({
        where: { id: { in: data.ids } },
        include: leadInclude,
      });
      return ok({ rows: rows.map(toLeadDTO) });
    }

    if (!data.value) {
      return handleError(Object.assign(new Error("Missing value for bulk action."), { status: 422 }));
    }

    if (data.action === "status") {
      if (!isStatus(data.value)) {
        return handleError(Object.assign(new Error("Unknown status."), { status: 422 }));
      }
      await db.lead.updateMany({
        where: { id: { in: data.ids } },
        data: { status: data.value },
      });
      return ok({ updated: data.ids.length });
    }

    if (data.action === "event") {
      const target = await db.event.findUnique({ where: { id: data.value } });
      if (!target) {
        return handleError(Object.assign(new Error("Event not found."), { status: 404 }));
      }
      const result = await db.lead.updateMany({
        where: { id: { in: data.ids } },
        data: { eventId: target.id },
      });
      return ok({ updated: result.count });
    }

    return handleError(Object.assign(new Error("Unknown bulk action."), { status: 400 }));
  } catch (err) {
    return handleError(err);
  }
}
