# Lanyard — AI Event Lead Manager

**Capture the room. Close the loop.**

Lanyard helps a team capture the people they meet at business events and turn half-remembered
conversations into follow-ups that actually go out. Every lead is a **badge**: a ticket-stock card
with a status tab, a barcode, and a tear-off stub. The list is a rail of badges; the detail view
flips the badge over to reveal the contact details on its back.

Built to the [PRD](PRD.md).

---

## Quickstart

```bash
npm install          # also approve install scripts: npm install-scripts approve --all
cp .env.example .env # demo AI mode is on by default
npm run db:reset     # create + seed the SQLite database
npm run dev          # http://localhost:3000
```

Seeds **40 hand-written leads across 3 events** (SaaStr Annual, Web Summit, a SaaS meetup), with
notes, tags, follow-up history and 6 overdue follow-ups so the "due today" view has something to
show on first launch.

### Verify it

```bash
npm run typecheck    # tsc --noEmit (strict, noUncheckedIndexedAccess)
npm run lint         # eslint (0 errors)
npm run build        # production build
npx next start -p 3000 &
node scripts/api-check.mjs   # 24 end-to-end checks against the running server
```

---

## What it does

| Capability | Where |
| --- | --- |
| **Add** leads fast — name + event is enough, everything else optional | `/leads/new` |
| **Edit / delete** with unsaved-changes guard and 5-second undo (restores id, timestamps and follow-ups) | badge detail |
| **Search** across name, company, title, email, notes, event and tags, with matches highlighted | `/leads` (`/` to focus) |
| **Filter** by status, event, tag, follow-up timing, combined with AND/OR semantics and persisted in the URL | `/leads` → Filters |
| **Sort** by recently updated, name, event date, follow-up due, temperature | `/leads` |
| **Follow-up status** lifecycle: New → Contacted → Replied → Qualified → Won, plus Lost, changeable from rail or detail | every badge |
| **Events** as first-class records with lead counts, status mix and guarded deletion | `/events` |
| **AI summarize** — structured recall, interests, buying signals, next step and temperature | badge detail → AI assist |
| **AI draft** — streams a personalised follow-up for Email / LinkedIn / SMS, with copy and save-to-timeline | badge detail → AI assist |
| **Bulk actions** — multi-select to change status, move event, delete | `/leads` |
| **CSV export** of the current filtered view | `/leads` → Export |
| **Command palette** | `⌘K` / `Ctrl+K` |

### Keyboard

| Key | Action |
| --- | --- |
| `⌘K` / `Ctrl+K` | Command palette |
| `/` | Focus search |
| `n` | New lead |
| `Esc` | Close the topmost layer |

---

## Stack

**Next.js 16 (App Router) · React 19 · TypeScript strict · Tailwind CSS v4 · Motion ·
TanStack Query · React Hook Form + Zod · Prisma 7 + SQLite (better-sqlite3) · Vercel AI SDK**

---

## Environment

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | `file:./dev.db` | SQLite path, resolved relative to the project root (see `prisma.config.ts`) |
| `AI_PROVIDER` | `openai` | `openai` \| `anthropic` \| `google` |
| `AI_API_KEY` | *(empty)* | Enables live AI. Empty + `AI_MOCK=0` disables AI entirely. |
| `AI_MODEL` | `gpt-4o-mini` | Model id passed to the provider |
| `AI_MOCK` | `1` | `1` = deterministic local output, no network, no cost |
| `AI_RATE_LIMIT_PER_MIN` | `10` | Per-IP AI rate limit |
| `SENDER_NAME` | *(empty)* | Sign-off name in drafted messages |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | Public URL |
| `APP_PASSCODE` | *(empty)* | Reserved for an optional shared gate (not wired in v1) |

### AI modes

The AI panel always declares which mode it is in — it never passes demo output off as model output.

- **Live** — `AI_API_KEY` set, `AI_MOCK=0`. Summaries use `generateObject` (with a text-JSON
  fallback), drafts stream from `streamText`. Every call is logged to the `AiCall` table.
- **Demo** (`AI_MOCK=1`, the default) — a deterministic generator that works **from each lead's own
  notes**: it extracts the sentences, interests and signals actually present, so the feature is
  real, offline, free, and reproducible in CI and screenshots.
- **Not configured** — no key and no mock. Controls are disabled with an explanation rather than
  failing silently.

Summaries are cached by `sha256(model + kind + notes)`, so re-opening a lead never re-bills.

---

## Architecture

```
src/
  app/                    pages (RSC shells) + route handlers
    api/leads/…           CRUD, bulk, follow-ups, restore, export
    api/events/…          event CRUD
    api/ai/…              summarize (JSON), draft (stream), status
    api/stats|tags|export overview counters, tag facets, CSV
  components/             rail, badge, detail, form, AI panel, palette, primitives
  lib/
    leads.ts              where-builder, ordering, DTO mapping
    mutations.ts          writes + search-index maintenance + guarded event delete
    filters.ts            URL ⇄ filter state (URL is the source of truth)
    search.ts             index building, query parsing, highlight segments
    ai/                   provider selection, caching, rate limit, mock, prompts
  generated/prisma/       Prisma client (emitted by `prisma generate`)
prisma/                   schema.prisma, seed.ts
scripts/api-check.mjs     end-to-end smoke test
```

**Data flow:** server components render the shell; client state comes from TanStack Query against
REST route handlers; filter state lives in the URL so every view is shareable and back/forward
behaves. Mutations are optimistic where loss is recoverable and explicit where it isn't.

---

## Key decisions

**ADR-001 — One Next.js app, not Next.js + FastAPI.** The brief allows any suitable stack. A
two-service split adds CORS, a second deploy target and a second failure mode with no product
benefit for a single-user app — and one deployable means one live link that still works when a
reviewer opens it. The REST surface is complete and isolated behind `src/lib/api.ts`, so a Python
service could be extracted later without redesigning the client.

**ADR-002 — SQLite, with a documented path to PostgreSQL.** SQLite satisfies the brief, needs no
daemon (this machine has no Postgres or Docker), and gives a `git clone → npm run db:reset → dev`
quickstart that cannot fail on a reviewer's laptop. Moving to Postgres is a provider swap in
`prisma/schema.prisma` + `prisma.config.ts`, plus replacing the `search` `contains` filter with
`websearch_to_tsquery`. Prisma 7 removed `url` from schemas, so the connection lives in
`prisma.config.ts` — the CLI and the app resolve the same file.

**ADR-003 — Prisma + a driver adapter.** Typed client, migrations in-repo, and `@prisma/adapter-better-sqlite3`
keeps the query engine out of the deploy.

**ADR-004 — Server state in TanStack Query, view state in the URL.** Two domains, explicitly
separated, no global store. Theme uses `useSyncExternalStore` so SSR and hydration agree.

**ADR-005 — Order and paginate over a lightweight projection.** SQLite in Prisma cannot express
mixed `nulls-last` due-date ordering plus hot>warm>cold in one portable `orderBy`. The repository
sorts an id/sort-key projection in application code and only loads full rows for the page returned.
At the stated 5k-lead ceiling this is milliseconds against a local file, and it keeps `notes` out
of the sort pass.

**Design — "Credential".** The UI is built from badge grammar rather than a UI kit: perforated
tear-off stubs, a woven lanyard rule, 6px status tabs, procedural Code128-style barcodes, duotone
monograms instead of stock avatars, and JetBrains Mono for metadata. Type is Archivo / Public Sans /
JetBrains Mono — Inter is deliberately not used. Motion is functional: FLIP reflow on filter,
shared-element badge → detail, a 3D badge flip, and a receipt-print reveal for streaming drafts.
Every animation is gated by `prefers-reduced-motion`.

---

## Known trade-offs

- **No auth.** v1 is a single-user tool; the schema has no owner column yet. `APP_PASSCODE` is
  reserved but not wired.
- **No email sending.** Lanyard drafts; a human sends. Logging the send is a timeline entry.
- **Demo AI by default.** Output is derived from the lead's own notes, not a model, until a key is
  added. The UI labels this explicitly.
- **Bulk delete is not undoable** (single delete is). Restoring many records would need a proper
  soft-delete rather than a client-held snapshot.
- **Ordering loads the filtered id set.** Fine to ~5k leads; a SQL-level ordering pass is the next
  step beyond that.
- `scripts/api-check.mjs` needs a running server; it is not wired into `npm run check`.

## Roadmap

1. Soft deletes so bulk undo works.
2. Postgres + `websearch_to_tsquery` ranking, and a cursor over a real index.
3. Daily triage digest over the due queue (PRD FR-18) and AI temperature scoring (FR-19).
4. CSV import with column mapping (FR-11).
5. Optional shared passcode gate (FR-25).

---

## Licence

MIT.
