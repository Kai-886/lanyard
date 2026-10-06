import { handleError, noContent, ok, parseBody } from "@/lib/http";
import { db } from "@/lib/db";
import { deleteEvent } from "@/lib/mutations";
import { eventInputSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const { data, error } = await parseBody(req, eventInputSchema);
    if (error) return error;

    const event = await db.event.update({
      where: { id },
      data: {
        name: data.name,
        location: data.location ?? null,
        startsAt: new Date(`${data.startsAt}T12:00:00`),
        endsAt: new Date(`${data.endsAt}T12:00:00`),
        accent: data.accent,
      },
    });
    return ok({ event });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const url = new URL(req.url);
    const reassignTo = url.searchParams.get("reassignTo") ?? undefined;
    await deleteEvent(id, reassignTo);
    return noContent();
  } catch (err) {
    const e = err as Error & { status?: number; fields?: Record<string, string> };
    if (e.status) return handleError(e);
    return handleError(err);
  }
}
