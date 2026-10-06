import { aiAvailability } from "@/lib/env";
import { ok } from "@/lib/http";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const usage = await db.aiCall.aggregate({
      _count: { _all: true },
      _sum: { tokensIn: true, tokensOut: true, latencyMs: true },
    });
    const recent = await db.aiCall.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        kind: true,
        model: true,
        latencyMs: true,
        cached: true,
        createdAt: true,
      },
    });

    return ok({
      availability: aiAvailability(),
      calls: usage._count._all,
      tokensIn: usage._sum.tokensIn ?? 0,
      tokensOut: usage._sum.tokensOut ?? 0,
      recent,
    });
  } catch {
    return ok({ availability: aiAvailability(), calls: 0, tokensIn: 0, tokensOut: 0, recent: [] });
  }
}
