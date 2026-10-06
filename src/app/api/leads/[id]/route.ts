import { z } from "zod";
import { fail, handleError, noContent, ok, parseWith } from "@/lib/http";
import { getLead } from "@/lib/leads";
import { deleteLead, setStatus, updateLead } from "@/lib/mutations";
import { leadInputSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const lead = await getLead(id);
    if (!lead) return fail(404, "Lead not found.");
    return ok({ lead });
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;

    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return fail(400, "Request body must be valid JSON");
    }

    // Status-only updates skip full-form validation so a one-click change from
    // the rail can never be rejected because of an unrelated field.
    const isStatusOnly =
      raw !== null &&
      typeof raw === "object" &&
      !Array.isArray(raw) &&
      Object.keys(raw).length === 1 &&
      "status" in raw;

    if (isStatusOnly) {
      const parsed = z.object({ status: z.string().min(1) }).safeParse(raw);
      if (!parsed.success) return fail(422, "Pick a valid status.");
      const lead = await setStatus(id, parsed.data.status);
      return ok({ lead });
    }

    const { data, error } = parseWith(leadInputSchema, raw);
    if (error) return error;

    const lead = await updateLead(id, data);
    return ok({ lead });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    await deleteLead(id);
    return noContent();
  } catch (err) {
    return handleError(err);
  }
}
