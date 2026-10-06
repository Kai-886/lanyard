import { db } from "@/lib/db";
import { handleError, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await db.leadTag.groupBy({ by: ["tag"], _count: { _all: true } });
    const items = rows
      .map((r) => ({ tag: r.tag, count: r._count._all }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
    return ok({ items });
  } catch (err) {
    return handleError(err);
  }
}
