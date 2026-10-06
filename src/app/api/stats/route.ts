import { handleError, ok } from "@/lib/http";
import { db } from "@/lib/db";
import { getLead } from "@/lib/leads";
import { LEAD_STATUSES, isStatus } from "@/lib/statuses";
import type { StatsDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function GET() {
  try {
    const today = startOfToday();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const [
      total,
      dueToday,
      overdue,
      hot,
      awaitingReply,
      won,
      last7,
      recent,
      statusRows,
    ] = await Promise.all([
      db.lead.count(),
      db.lead.count({ where: { nextFollowUpAt: { gte: today, lt: tomorrow } } }),
      db.lead.count({ where: { nextFollowUpAt: { lt: today } } }),
      db.lead.count({ where: { temperature: "hot" } }),
      db.lead.count({ where: { status: { in: ["CONTACTED", "QUALIFIED"] } } }),
      db.lead.count({ where: { status: "WON" } }),
      db.lead.count({ where: { createdAt: { gte: weekAgo } } }),
      db.lead.findMany({ orderBy: { updatedAt: "desc" }, take: 5, select: { id: true } }),
      db.lead.groupBy({ by: ["status"], _count: { _all: true } }),
    ]);

    const byStatus = Object.fromEntries(LEAD_STATUSES.map((s) => [s, 0])) as Record<
      (typeof LEAD_STATUSES)[number],
      number
    >;
    for (const row of statusRows) {
      if (isStatus(row.status)) byStatus[row.status] = row._count._all;
    }

    const recentDtos = (
      await Promise.all(recent.map((r) => getLead(r.id)))
    ).filter((r): r is NonNullable<typeof r> => r !== null);

    const stats: StatsDTO = {
      total,
      dueToday,
      overdue,
      hot,
      awaitingReply,
      won,
      last7,
      byStatus,
      recent: recentDtos,
    };

    return ok(stats);
  } catch (err) {
    return handleError(err);
  }
}
