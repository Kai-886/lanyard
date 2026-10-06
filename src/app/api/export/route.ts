import { db } from "@/lib/db";
import { buildWhere } from "@/lib/leads";
import { filtersFromParams } from "@/lib/filters";
import { handleError } from "@/lib/http";
import { isStatus, STATUS_META } from "@/lib/statuses";

export const dynamic = "force-dynamic";

function cell(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  // Neutralise spreadsheet formula injection.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

function date(value: Date | null | undefined): string {
  return value ? value.toISOString().slice(0, 10) : "";
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const filters = filtersFromParams(url.searchParams);
    const where = buildWhere(filters);

    const rows = await db.lead.findMany({
      where,
      include: { event: true, tags: true },
      orderBy: { updatedAt: "desc" },
      take: 5000,
    });

    const header = [
      "Name", "Company", "Title", "Email", "Phone", "Event", "Event date",
      "Status", "Temperature", "Tags", "Follow-up due", "Last contacted",
      "Met via", "Notes", "Updated",
    ];

    const lines = [header.map(cell).join(",")];
    for (const r of rows) {
      lines.push(
        [
          r.name, r.company, r.title, r.email, r.phone, r.event.name,
          date(r.event.startsAt),
          isStatus(r.status) ? STATUS_META[r.status].label : r.status,
          r.temperature ?? "",
          r.tags.map((t) => t.tag).join("; "),
          date(r.nextFollowUpAt), date(r.lastContactedAt),
          r.source ?? "", r.notes, date(r.updatedAt),
        ].map(cell).join(","),
      );
    }

    return new Response(lines.join("\r\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="lanyard-leads-${new Date().toISOString().slice(0, 10)}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return handleError(err);
  }
}
