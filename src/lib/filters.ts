import { LEAD_STATUSES, isStatus, type LeadStatus } from "@/lib/statuses";
import { searchFiltersSchema, type SearchFilters } from "@/lib/validation";

export const EMPTY_FILTERS: SearchFilters = { sort: "updated" };

function list(value: string | null): string[] | undefined {
  if (!value) return undefined;
  const parts = value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : undefined;
}

/** Parse URL search params into a validated filter object. */
export function filtersFromParams(params: URLSearchParams): SearchFilters {
  const raw = {
    q: params.get("q") ?? undefined,
    status: list(params.get("status"))?.filter(isStatus) as LeadStatus[] | undefined,
    event: list(params.get("event")),
    tag: list(params.get("tag")),
    due: (params.get("due") ?? undefined) as SearchFilters["due"],
    from: params.get("from") ?? undefined,
    to: params.get("to") ?? undefined,
    sort: (params.get("sort") ?? "updated") as SearchFilters["sort"],
    cursor: params.get("cursor") ?? undefined,
    limit: params.get("limit") ?? undefined,
  };

  const parsed = searchFiltersSchema.safeParse(raw);
  if (!parsed.success) return { sort: raw.sort ?? "updated" };
  return parsed.data;
}

/** Serialise filters back into search params (empty values dropped). */
export function paramsFromFilters(f: SearchFilters): URLSearchParams {
  const sp = new URLSearchParams();
  if (f.q) sp.set("q", f.q);
  if (f.status?.length) sp.set("status", f.status.join(","));
  if (f.event?.length) sp.set("event", f.event.join(","));
  if (f.tag?.length) sp.set("tag", f.tag.join(","));
  if (f.due && f.due !== "none") sp.set("due", f.due);
  if (f.from) sp.set("from", f.from);
  if (f.to) sp.set("to", f.to);
  if (f.sort && f.sort !== "updated") sp.set("sort", f.sort);
  return sp;
}

export function activeFilterCount(f: SearchFilters): number {
  let n = 0;
  if (f.status?.length) n += f.status.length;
  if (f.event?.length) n += f.event.length;
  if (f.tag?.length) n += f.tag.length;
  if (f.due && f.due !== "none") n += 1;
  if (f.from || f.to) n += 1;
  return n;
}

export const DUE_OPTIONS = [
  { value: "today", label: "Due today" },
  { value: "overdue", label: "Overdue" },
  { value: "uncontacted", label: "Not contacted" },
  { value: "has-email", label: "Has email" },
] as const;

export const SORT_OPTIONS = [
  { value: "updated", label: "Recently updated" },
  { value: "name", label: "Name A–Z" },
  { value: "event", label: "Event date" },
  { value: "due", label: "Follow-up due" },
  { value: "temperature", label: "Temperature" },
] as const;

export { LEAD_STATUSES };
