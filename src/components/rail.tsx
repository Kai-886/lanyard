"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Download,
  Filter,
  Search,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import { Button, Chip, EmptyState, Kbd, Modal, Select, cx, useToast } from "@/components/ui";
import { LeadBadge } from "@/components/lead-badge";
import { useEvents, useLeads, useTags } from "@/lib/hooks";
import {
  DUE_OPTIONS,
  SORT_OPTIONS,
  activeFilterCount,
  filtersFromParams,
} from "@/lib/filters";
import { LEAD_STATUSES, STATUS_META, type LeadStatus } from "@/lib/statuses";
import type { SearchFilters } from "@/lib/validation";
import { parseQuery } from "@/lib/search";

const PAGE_SIZE = 24;

function toggleIn(list: string[] | undefined, value: string): string[] {
  const current = list ?? [];
  return current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
}

export function Rail() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const toast = useToast();
  const reduce = useReducedMotion();

  const filters = useMemo(() => filtersFromParams(params), [params]);
  const [search, setSearch] = useState(filters.q ?? "");
  const [panelOpen, setPanelOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const searchRef = useRef<HTMLInputElement>(null);

  const leads = useLeads({ ...filters, limit });
  const events = useEvents();
  const tags = useTags();

  /* --- URL is the source of truth for filters (PRD §4) --- */
  const patch = useCallback(
    (next: Partial<SearchFilters>, opts?: { replace?: boolean }) => {
      const merged = { ...filters, ...next };
      const sp = new URLSearchParams();
      if (merged.q) sp.set("q", merged.q);
      if (merged.status?.length) sp.set("status", merged.status.join(","));
      if (merged.event?.length) sp.set("event", merged.event.join(","));
      if (merged.tag?.length) sp.set("tag", merged.tag.join(","));
      if (merged.due && merged.due !== "none") sp.set("due", merged.due);
      if (merged.sort && merged.sort !== "updated") sp.set("sort", merged.sort);
      const url = sp.toString() ? `${pathname}?${sp}` : pathname;
      router.replace(url, { scroll: false, ...(opts ?? {}) });
    },
    [filters, pathname, router],
  );

  /* --- Debounced search (150ms, PRD FR-4) --- */
  useEffect(() => {
    if ((filters.q ?? "") === search) return;
    const t = window.setTimeout(() => patch({ q: search || undefined }), 150);
    return () => window.clearTimeout(t);
  }, [search, filters.q, patch]);

  /* --- Sync the input when the URL changes elsewhere (clear all, back/forward).
     Render-phase adjustment of state — the documented pattern, and it avoids the
     cascading render that an effect would cause. --- */
  const [prevUrlQ, setPrevUrlQ] = useState(filters.q ?? "");
  if ((filters.q ?? "") !== prevUrlQ) {
    setPrevUrlQ(filters.q ?? "");
    setSearch(filters.q ?? "");
  }

  /* --- `/` focuses search --- */
  useEffect(() => {
    const onFocus = () => searchRef.current?.focus();
    window.addEventListener("lanyard:focus-search", onFocus);
    return () => window.removeEventListener("lanyard:focus-search", onFocus);
  }, []);

  const terms = useMemo(() => parseQuery(filters.q), [filters.q]);
  const filterCount = activeFilterCount(filters);
  const items = useMemo(() => leads.data?.items ?? [], [leads.data]);
  const activeIds = useMemo(() => items.map((i) => i.id), [items]);

  const allSelected = activeIds.length > 0 && activeIds.every((id) => selected.includes(id));
  const toggleOne = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const runBulk = async (action: "status" | "event" | "delete", value?: string) => {
    if (selected.length === 0) return;
    if (action === "delete") {
      const count = selected.length;
      const res = await fetch("/api/leads/bulk", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids: selected, action: "delete" }),
      });
      if (!res.ok) {
        toast("Could not delete those leads.");
        return;
      }
      setSelected([]);
      void leads.refetch();
      toast(`${count} lead${count === 1 ? "" : "s"} deleted`, {
        undo: async () => {
          toast("Bulk restore isn't available — use the detail view for single undo.");
        },
      });
      return;
    }

    const res = await fetch("/api/leads/bulk", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids: selected, action, value }),
    });
    if (!res.ok) {
      toast("Bulk update failed.");
      return;
    }
    setSelected([]);
    void leads.refetch();
    toast(`${selected.length} lead${selected.length === 1 ? "" : "s"} updated`);
  };

  const exportUrl = `/api/export${
    filters.q || filterCount
      ? `?${new URLSearchParams(
          Object.entries({
            q: filters.q,
            status: filters.status?.join(","),
            event: filters.event?.join(","),
            tag: filters.tag?.join(","),
            due: filters.due,
          }).filter(([, v]) => Boolean(v)) as [string, string][],
        )}`
      : ""
  }`;

  return (
    <div className="flex flex-col gap-5">
      {/* ------------------------------------------------------------ toolbar */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="display text-[clamp(1.9rem,4vw,2.6rem)]">The rail</h1>
            <p className="mt-1 text-sm text-ink-2">
              {leads.data ? (
                <>
                  <span className="text-ink">{leads.data.total}</span> badge
                  {leads.data.total === 1 ? "" : "s"}
                  {items.length !== leads.data.total ? ` · showing ${items.length}` : ""}
                </>
              ) : (
                "Loading…"
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="hairline flex h-10 min-w-[220px] flex-1 items-center gap-2 rounded-[3px] bg-paper px-3 sm:w-72 sm:flex-none">
              <Search size={15} className="shrink-0 text-ink-3" aria-hidden />
              <input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search names, companies, notes…"
                aria-label="Search leads"
                className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-3"
              />
              {search ? (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                  className="cursor-pointer text-ink-3 hover:text-ink"
                >
                  <X size={14} />
                </button>
              ) : (
                <Kbd>/</Kbd>
              )}
            </div>

            <Button
              onClick={() => setPanelOpen(true)}
              className={cx(filterCount > 0 && "border-signal text-signal")}
            >
              <Filter size={15} aria-hidden />
              Filters
              {filterCount > 0 ? (
                <span className="ml-0.5 rounded-[2px] bg-signal px-1.5 py-px text-[11px] font-bold text-on-signal">
                  {filterCount}
                </span>
              ) : null}
            </Button>

            <label className="sr-only" htmlFor="sort">
              Sort
            </label>
            <div className="relative">
              <Select
                id="sort"
                value={filters.sort ?? "updated"}
                onChange={(e) => patch({ sort: e.target.value as SearchFilters["sort"] })}
                className="h-10 py-0 text-sm"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
              <SlidersHorizontal
                size={13}
                aria-hidden
                className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-ink-3"
              />
            </div>

            <a
              href={exportUrl}
              className="hairline inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-[3px] bg-paper px-3 text-sm text-ink-2 transition-colors hover:text-ink"
            >
              <Download size={15} aria-hidden />
              <span className="hidden sm:inline">Export</span>
            </a>
          </div>
        </div>

        {/* Active filter chips */}
        <AnimatePresence initial={false}>
          {filterCount > 0 || filters.q ? (
            <motion.div
              initial={reduce ? false : { height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
              transition={{ duration: reduce ? 0 : 0.16 }}
              className="flex flex-wrap items-center gap-2 overflow-hidden"
            >
              {filters.q ? (
                <Chip tone="signal" onRemove={() => patch({ q: undefined })}>
                  “{filters.q}”
                </Chip>
              ) : null}
              {(filters.status ?? []).map((s) => (
                <Chip
                  key={s}
                  onRemove={() => patch({ status: toggleIn(filters.status, s) as LeadStatus[] })}
                >
                  {STATUS_META[s].label}
                </Chip>
              ))}
              {(filters.event ?? []).map((id) => (
                <Chip
                  key={id}
                  onRemove={() => patch({ event: toggleIn(filters.event, id) })}
                >
                  {events.data?.find((e) => e.id === id)?.name ?? "Event"}
                </Chip>
              ))}
              {(filters.tag ?? []).map((t) => (
                <Chip key={t} onRemove={() => patch({ tag: toggleIn(filters.tag, t) })}>
                  {t}
                </Chip>
              ))}
              {filters.due && filters.due !== "none" ? (
                <Chip onRemove={() => patch({ due: undefined })}>
                  {DUE_OPTIONS.find((d) => d.value === filters.due)?.label}
                </Chip>
              ) : null}
              <button
                type="button"
                onClick={() => router.replace(pathname, { scroll: false })}
                className="meta cursor-pointer text-ink-3 underline decoration-dotted underline-offset-4 hover:text-ink"
              >
                Clear all
              </button>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {/* ------------------------------------------------------------- results */}
      {leads.isPending ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-[210px] rounded-[4px]" />
          ))}
        </div>
      ) : items.length === 0 ? (
        filters.q || filterCount > 0 ? (
          <EmptyState
            title="Nothing matches that"
            body={
              filters.q
                ? `No badges match “${filters.q}”. Try fewer terms, or clear the filters.`
                : "No badges match the current filters."
            }
            icon={<Search size={20} />}
            action={
              <Button onClick={() => router.replace(pathname, { scroll: false })}>
                Clear search & filters
              </Button>
            }
          />
        ) : (
          <EmptyState
            title="The rail is empty"
            body="Add the first person you met — name and event is enough to start. Notes can come later."
            icon={<Sparkles size={20} />}
            action={
              <Button variant="primary" onClick={() => router.push("/leads/new")}>
                Capture a lead
              </Button>
            }
          />
        )
      ) : (
        <>
          <div className="flex items-center justify-between">
            <label className="flex cursor-pointer items-center gap-2 text-[13px] text-ink-2">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={() => setSelected(allSelected ? [] : activeIds)}
                className="h-4 w-4 accent-[var(--signal)]"
              />
              Select all on this page
            </label>
            {selected.length > 0 ? (
              <span className="meta text-signal">{selected.length} selected</span>
            ) : null}
          </div>

          <motion.div layout={!reduce} className="grid gap-4 lg:grid-cols-2">
            <AnimatePresence mode="popLayout" initial={false}>
              {items.map((lead, i) => (
                <motion.div
                  key={lead.id}
                  layout={!reduce}
                  initial={reduce ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
                  transition={
                    reduce
                      ? { duration: 0 }
                      : { delay: Math.min(i * 0.018, 0.22), duration: 0.22 }
                  }
                >
                  <LeadBadge
                    lead={lead}
                    highlight={terms}
                    selected={selected.includes(lead.id)}
                    onToggle={() => toggleOne(lead.id)}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>

          {leads.data?.hasMore ? (
            <div className="flex justify-center pt-2">
              <Button onClick={() => setLimit((n) => n + PAGE_SIZE)}>Show more</Button>
            </div>
          ) : null}
        </>
      )}

      {/* --------------------------------------------------------- filter panel */}
      <Modal
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        title="Filter the rail"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => router.replace(pathname, { scroll: false })}
            >
              Reset
            </Button>
            <Button variant="primary" onClick={() => setPanelOpen(false)}>
              Show {leads.data?.total ?? 0} results
            </Button>
          </>
        }
      >
        <div className="flex max-h-[65dvh] flex-col gap-6 overflow-y-auto pr-1">
          <FilterGroup label="Follow-up status">
            {LEAD_STATUSES.map((s) => {
              const on = (filters.status ?? []).includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => patch({ status: toggleIn(filters.status, s) as LeadStatus[] })}
                  aria-pressed={on}
                  className={cx(
                    "flex cursor-pointer items-center gap-2 rounded-[3px] border px-2.5 py-1.5 text-[13px] transition-colors",
                    on ? "border-signal bg-signal-soft text-signal" : "border-paper-3 text-ink-2 hover:border-ink-3",
                  )}
                >
                  <span
                    className="h-3 w-[3px] rounded-full"
                    style={{ background: STATUS_META[s].tab }}
                  />
                  {STATUS_META[s].label}
                </button>
              );
            })}
          </FilterGroup>

          <FilterGroup label="Follow-up timing">
            {DUE_OPTIONS.map((o) => {
              const on = filters.due === o.value;
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => patch({ due: on ? undefined : o.value })}
                  aria-pressed={on}
                  className={cx(
                    "cursor-pointer rounded-[3px] border px-2.5 py-1.5 text-[13px] transition-colors",
                    on ? "border-signal bg-signal-soft text-signal" : "border-paper-3 text-ink-2 hover:border-ink-3",
                  )}
                >
                  {o.label}
                </button>
              );
            })}
          </FilterGroup>

          <FilterGroup label="Event">
            {(events.data ?? []).map((e) => {
              const on = (filters.event ?? []).includes(e.id);
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => patch({ event: toggleIn(filters.event, e.id) })}
                  aria-pressed={on}
                  className={cx(
                    "flex cursor-pointer items-center gap-2 rounded-[3px] border px-2.5 py-1.5 text-left text-[13px] transition-colors",
                    on ? "border-signal bg-signal-soft text-signal" : "border-paper-3 text-ink-2 hover:border-ink-3",
                  )}
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: e.accent }} />
                  <span className="truncate">{e.name}</span>
                  <span className="ml-auto meta text-ink-3">{e.leadCount}</span>
                </button>
              );
            })}
          </FilterGroup>

          {tags.data?.length ? (
            <FilterGroup label="Tags">
              {tags.data.map((t) => {
                const on = (filters.tag ?? []).includes(t.tag);
                return (
                  <button
                    key={t.tag}
                    type="button"
                    onClick={() => patch({ tag: toggleIn(filters.tag, t.tag) })}
                    aria-pressed={on}
                    className={cx(
                      "cursor-pointer rounded-[3px] border px-2.5 py-1.5 text-[13px] transition-colors",
                      on ? "border-signal bg-signal-soft text-signal" : "border-paper-3 text-ink-2 hover:border-ink-3",
                    )}
                  >
                    {t.tag} <span className="meta text-ink-3">{t.count}</span>
                  </button>
                );
              })}
            </FilterGroup>
          ) : null}
        </div>
      </Modal>

      {/* ---------------------------------------------------------- bulk action bar */}
      <AnimatePresence>
        {selected.length > 0 ? (
          <motion.div
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 24 }}
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
            className="hairline fixed inset-x-4 bottom-4 z-70 mx-auto flex max-w-xl flex-wrap items-center gap-2 rounded-[4px] bg-paper-2 p-2.5 shadow-xl sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2"
          >
            <span className="meta px-2 text-ink-2">{selected.length} selected</span>
            <Select
              aria-label="Change status"
              value=""
              onChange={(e) => {
                if (e.target.value) void runBulk("status", e.target.value);
              }}
              className="h-9 w-auto min-w-[130px] py-0 text-[13px]"
            >
              <option value="">Set status…</option>
              {LEAD_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_META[s].label}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Move to event"
              value=""
              onChange={(e) => {
                if (e.target.value) void runBulk("event", e.target.value);
              }}
              className="h-9 w-auto min-w-[130px] py-0 text-[13px]"
            >
              <option value="">Move to event…</option>
              {(events.data ?? []).map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.name}
                </option>
              ))}
            </Select>
            <Button size="sm" variant="danger" onClick={() => void runBulk("delete")}>
              Delete
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected([])}>
              Cancel
            </Button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="meta mb-1 text-ink-3">{label}</legend>
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}
