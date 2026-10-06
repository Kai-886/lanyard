# PRD — Lanyard

**AI Event Lead Manager** · v1.0 · 5 Oct 2026
Status: Approved for build · Owner: Solo engineer · Target: Veteran-grade public release

---

## 0. One-liner

> **Lanyard** turns the scribbles you make at a conference into a follow-up queue you actually clear.
> Badges in. Follow-ups out.

---

## 1. Problem & insight

### 1.1 The problem

Teams return from events with 30–80 new contacts and a phone full of half-legible notes:
*"Maya — RevOps @ Northwind — said their QBR deck is a mess, hates Salesforce reports, whiskey?"*

Three days later the context is gone, the follow-up email takes 40 minutes to write per person,
and half the list goes cold. The storage part of this problem was solved years ago. **The context
recovery and drafting part was not.**

### 1.2 Insight (the product's center of gravity)

Capture is fast and messy by definition. Value comes from the *second* interaction: pulling the raw
note back into working memory and turning it into a sendable message in under 60 seconds.

So: CRUD is table stakes, not the feature. The feature is **capture fast → recover context → ship the follow-up**.

### 1.3 Anti-thesis (what we are *not* building)

| Not this | Because |
| --- | --- |
| A CRM (HubSpot-lite) | Pipelines, deals and forecasting are out of scope. Contacts + status only. |
| A marketing site with a demo behind it | The app *is* the deliverable. No hero section, no pricing table. |
| An AI wrapper with one "✨ Summarize" button | AI is wired into the two moments it changes the job: recall and drafting. |
| A generic dashboard of rounded cards | See §8. The visual language is derived from the object: a conference badge. |

---

## 2. Goals & non-goals

### 2.1 Goals

- **G1** A user can capture a lead in ≤ 20 seconds on a phone, standing up, at a booth.
- **G2** A user can find any lead in ≤ 3 seconds from 500+ records via search or filters.
- **G3** A user can go from raw notes → a personalized, sendable follow-up in ≤ 60 seconds.
- **G4** Every required feature in the assignment brief works end-to-end against a real database.
- **G5** The interface is unmistakable — a reviewer describes it as "the badge one", not "another CRUD app".
- **G6** Zero broken states: loading, empty, error, offline and unauthorized are designed, not default.

### 2.2 Non-goals (v1)

- Multi-tenant auth, roles, invitations, orgs (see FR-25 for an optional shared passcode).
- Email sending / SMTP delivery. We **draft**; the human sends. (Marking "sent" is a logged action.)
- Calendar sync, LinkedIn automation, web enrichment, outbound sequencing.
- Native mobile apps. Responsive web only.
- Real-time multiplayer editing.

---

## 3. Users & jobs-to-be-done

**Primary — "Riley", account executive / founder (32).** Attends 6–10 events a year. Captures on a
phone between sessions, triages on the flight home, writes follow-ups that week. Judges tools on
speed and whether the output sounds like them.

**Secondary — "Sam", sales lead.** Wants the team's list in one place, filterable by event, with
visibility on who hasn't been contacted yet.

**JTBD:**
1. *When* I meet someone interesting and have 30 seconds, *help me* dump the context before I lose it.
2. *When* I'm back at my laptop with 40 leads, *help me* see who's worth contacting first.
3. *When* I'm writing the follow-up, *help me* recall what we actually talked about and draft the first pass.

---

## 4. Information architecture & routes

```
/                       Overview — today's queue, stats, recent leads, triage digest
/leads                  Lanyard rail — search, filter, sort, multi-select, list of badges
/leads/[id]             Badge detail — front (identity) / back (notes, AI, follow-ups)
/leads/[id]/edit        Edit form
/leads/new              Quick capture (also reachable via ⌘K and the FAB on mobile)
/events                  Events index — cards w/ lead counts, date range, status mix
/events/[id]            Event detail — leads for that event, export, bulk actions
/settings               Theme, AI provider status, data export/import, passcode
```

**State in the URL:** every filter, sort, query and tab on `/leads` lives in search params
(`?q=&status=new,contacted&event=ev_12&due=overdue&sort=updated`). Views are shareable and
back/forward behave correctly. This is a hard requirement, not a nicety.

---

## 5. Functional requirements

Priority: **P0** = ship-blocking · **P1** = should ship · **P2** = stretch.

### 5.1 CRUD & data

| ID | Req | Pri | Acceptance criteria |
| --- | --- | --- | --- |
| FR-1 | **Create lead** | P0 | Given the capture form, When name + event are provided (only `name` strictly required), Then the lead persists and appears at the top of the rail with a 400ms entrance. `email` is validated format-wise; invalid email blocks save with an inline message, not an alert. Duplicate email in the same event → non-blocking warning with a link to the existing record. |
| FR-2 | **Edit lead** | P0 | Any field editable. Unsaved-changes guard on navigate-away. Save shows optimistic update; failure reverts and shows a retry toast. |
| FR-3 | **Delete lead** | P0 | Destructive action requires confirmation *only* when the lead has follow-ups; otherwise it's optimistic with a **5-second undo toast**. Undo restores the record including its follow-ups. |
| FR-4 | **Search** | P0 | Debounced 150ms, case-insensitive, across `name, company, title, email, notes, event.name, tags`. Uses Postgres full-text search with ranking. Matched substrings are **highlighted** in results. Empty result → designed empty state with "clear filters" affordance, not a blank pane. |
| FR-5 | **Filter** | P0 | Status (multi-select), Event (multi), Tags (multi), Follow-up state (`due today` / `overdue` / `not contacted` / `has email`), Date met (range). Filters compose with AND across groups, OR within a group. Active filters render as dismissible chips with a "Clear all". State persists to URL (§4). |
| FR-6 | **Sort** | P1 | Recently updated (default) · Name A–Z · Event date · Follow-up due · Temperature. Reorders with layout animation, no re-mount flicker. |
| FR-7 | **Follow-up status lifecycle** | P0 | Statuses: `NEW → CONTACTED → REPLIED → QUALIFIED → WON`, plus `LOST` reachable from any. Transitions are allowed in any direction (real life is messy). Changing status from the list is one click + optimistic. Status is stored as a Postgres enum. |
| FR-8 | **Events are first-class** | P0 | Create/edit/delete events (name, location, start/end dates, accent color). Deleting an event with leads requires reassignment or explicit "orphan" confirmation. Event selector present in capture form; new events creatable inline from the form. |
| FR-9 | **Follow-up log** | P1 | Per lead: append-only timeline of follow-ups `{channel: email\|linkedin\|call\|note, direction, body, at}`. Creating one from a draft is one click. Timeline animates in. |
| FR-10 | **Bulk actions** | P1 | Multi-select via checkbox / `Shift+click` / `⌘A`. Bulk: change status, assign event, delete, export selected. Selection survives filtering. |
| FR-11 | **CSV import/export** | P2 | Export current filtered view (not just all rows). Import maps columns with a preview and validation before commit. |
| FR-12 | **Persistence** | P0 | All data in **PostgreSQL** via Prisma. Survives restart. Migrations committed to the repo. No data in localStorage beyond theme + UI prefs. |

### 5.2 AI features

| ID | Req | Pri | Acceptance criteria |
| --- | --- | --- | --- |
| FR-13 | **Summarize interaction notes** | P0 | Given ≥ 15 characters of notes, When triggered, Then returns a **structured** result (§7.2) rendered as: a ≤ 60-word recall paragraph, plus chips for interests, buying signals, and a recommended next step. Result is cached by content hash — a second click resolves instantly with a "cached" affordance. |
| FR-14 | **Draft a follow-up message** | P0 | Given a lead with notes, When triggered, Then a personalized message **streams** in token-by-token with a "receipt printing" treatment. Channel switch (Email / LinkedIn / SMS) changes tone and length constraints. Actions on completion: **Copy** (clipboard + confirmation), **Edit inline**, **Save to timeline as draft**, **Regenerate**. |
| FR-15 | **Graceful AI degradation** | P0 | If no API key is configured, AI controls render in an explicit "not configured" state linking to `/settings` — never a silent failure, never a crash. If the provider errors/times out (20s), show an inline retry. `AI_MOCK=1` yields deterministic output for tests, CI and screenshots. |
| FR-16 | **Hallucination guardrail** | P0 | Prompt forbids inventing facts not present in the notes; drafts that mention specifics must be traceable to input. If notes are too thin, the button is disabled with the tooltip *"Add more detail first"* rather than producing confident fiction. |
| FR-17 | **AI audit/cost log** | P1 | Every AI call records `{leadId, kind, model, promptHash, tokensIn, tokensOut, latencyMs, cached}`. Shown in `/settings` as a spend/usage strip. |
| FR-18 | **Daily triage digest** | P2 | On the Overview: "My follow-up queue today" — one AI pass over all due/hot leads producing a ranked, 3-bullet-per-lead action list. Cached for 6 hours. |
| FR-19 | **Temperature score** | P2 | AI-derived `hot\|warm\|cold` from notes signals, stored on the lead, filterable, shown as a meter on the badge. |

### 5.3 Interface & experience

| ID | Req | Pri | Acceptance criteria |
| --- | --- | --- | --- |
| FR-20 | **Responsive** | P0 | Works 360px → 2560px. Mobile: rail becomes a stacked list, filters move to a bottom sheet, a sticky capture FAB is always reachable. No horizontal scroll at any breakpoint. |
| FR-21 | **Keyboard-first** | P1 | Full key map (Appendix A). Focus is always visible; no keyboard traps; `Esc` unwinds layers in order. |
| FR-22 | **Command palette** | P1 | `⌘K` / `Ctrl+K`: fuzzy search over leads, events and actions (`new lead`, `export`, `toggle theme`). Zero results state included. |
| FR-23 | **Accessibility** | P0 | WCAG 2.1 AA: contrast ≥ 4.5:1 body / 3:1 large, visible focus, ARIA on dialogs + focus trap, `aria-live` for toasts and AI streaming status, all icon-only buttons labeled, `prefers-reduced-motion` respected globally (Appendix B). |
| FR-24 | **Designed states** | P0 | Skeletons match final layout (no spinner-only screens), empty states are illustrated with a next action, error boundary with retry + copy-diagnostics, offline banner on `navigator.onLine` false. |

---

## 6. Data model

```prisma
model Event {
  id        String   @id @default(cuid())
  name      String
  location  String?
  startsAt  DateTime
  endsAt    DateTime
  accent    String   @default("#FF4D00")   // badge tab color
  leads     Lead[]
  createdAt DateTime @default(now())
}

model Lead {
  id            String    @id @default(cuid())
  name          String
  company       String?
  title         String?
  email         String?
  phone         String?
  source        String?                    // how/where met: "booth", "talk", "dinner"
  notes         String    @default("")     // raw capture — the primary AI input
  status        LeadStatus @default(NEW)
  temperature   Temperature?               // AI-derived (FR-19)
  tags          String[]
  eventId       String
  event         Event     @relation(...)
  nextFollowUpAt DateTime?                 // drives due/overdue filters
  lastContactedAt DateTime?
  aiSummary     Json?                      // cached structured summary
  aiSummaryHash String?                    // cache key
  followUps     FollowUp[]
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  @@index([status, nextFollowUpAt])
  @@fulltext([name, company, notes])
}

model FollowUp {
  id        String   @id @default(cuid())
  leadId    String
  lead      Lead     @relation(...)
  channel   Channel  // EMAIL | LINKEDIN | CALL | NOTE
  direction Direction // OUT | IN
  body      String
  sentAt    DateTime
  createdAt DateTime @default(now())
}

model AiCall {
  id         String  @id @default(cuid())
  leadId     String?
  kind       String  // summarize | draft | triage
  model      String
  promptHash String
  tokensIn   Int
  tokensOut  Int
  latencyMs  Int
  cached     Boolean @default(false)
  createdAt  DateTime @default(now())
}
```

**Decisions:** `@@fulltext` needs Prisma's `postgresqlFullTextSearch` +
`postgresqlFullTextTextConfig` preview features enabled; if that proves brittle, drop to a raw
`ILIKE`/trigram query behind the same `lib/search.ts` interface — no caller changes.

Notes are one free-text field (matches how people actually capture) with tags as a `text[]` — no
join table until filtering proves slow. Summary cached as `Json` + hash so re-opening
a lead costs nothing. `AiCall` is what makes cost visible; it is deliberately *not* a full audit log.

---

## 7. AI design

### 7.1 Provider

Vercel AI SDK (`ai` package) with a provider selected by env var. Default: `gpt-4o-mini` (cheap,
fast, good enough at structured extraction). Anthropic and Google adapters supported by swapping one
line. Model and temperature are env-driven so the demo can be retuned without a deploy.

**Justification:** the assignment grades *that AI works reliably in a deployed demo*. A cheap,
high-availability model with structured output beats a frontier model that costs money and rate-limits
the reviewer.

### 7.2 Contracts

**Summarize** — `generateObject` (non-streaming, ~1–2s, cacheable):

```ts
{
  recall: string;        // ≤ 60 words, first person, "what we talked about"
  interests: string[];   // 2–5, each ≤ 4 words
  signals: string[];     // buying/pain signals found in the notes, verbatim-anchored
  nextStep: string;      // one concrete action, ≤ 20 words
  temperature: 'hot'|'warm'|'cold'
}
```

**Draft** — `streamText` (streaming, feels alive):

```
System: You are Riley's follow-up writer. Use ONLY facts in the notes.
        No invented specifics, no "I hope this email finds you well",
        no exclamation marks, ≤ 120 words for email / ≤ 40 for LinkedIn.
Context: {name, title, company, event, interests[], nextStep, channel}
Input:   raw notes
```

### 7.3 Guardrails & cost control

- **Cache** by `sha256(model + kind + normalizedInput)`; a cached summary renders instantly with a
  subtle "recalled" label. Never re-bill for the same note.
- **Rate limit** 10 AI requests/min/IP, surfaced as a friendly "slow down" state.
- **Timeout** 20s → inline retry; the UI never hangs on a spinner.
- **PII**: notes contain personal data. Payloads are never written to application logs; `AiCall`
  stores hashes and counts only. Disclosed in the README.
- **Mock mode** (`AI_MOCK=1`): deterministic fixture output so tests, CI and screenshots never hit
  a network or spend money.

---

## 8. Design direction — "Credential"

### 8.1 The idea

The artifact this product manages is a **conference badge**. So the interface is built from badge
grammar: ticket stock, perforated edges, a woven lanyard rule, a status tab on the holder clip, a
procedurally drawn barcode, thermal-printer mono for metadata. Every lead *is* a badge; the list is a
rail of badges; the detail view is the badge **flipped over** to reveal the notes and AI on its back.

This is the anti-slop mechanism: the design derives from a physical object rather than from a UI kit.

### 8.2 Tokens

```
--paper        #F2EFE7   canvas (light)
--paper-2      #E8E3D7   raised surface / ticket stock
--ink          #14120F   text, rules
--ink-2        #5B564C   secondary text
--backstage    #0E0D0C   canvas (dark)
--signal       #FF4D00   primary action, HOT, lanyard rule
--tab-new       #5B564C   --tab-contacted #2F5FE0   --tab-replied #0B6E4F
--tab-qualified #7A4BD1   --tab-won #0B6E4F          --tab-lost #B3261E
```

Rule: **one accent does the work.** Status colors appear only as 6px tabs and chips — never as
card backgrounds.

### 8.3 Type

| Role | Family | Use |
| --- | --- | --- |
| Display | **Archivo** 700–800, tracking `-0.03em` | Page titles, badge names, oversized numerals |
| Body | **Public Sans** 400–600 | Prose, forms, tables |
| Meta | **JetBrains Mono** 500, uppercase, tracking `.12em` | IDs, dates, event codes, labels, barcode text |

Loaded via `next/font/google` with a single request and `font-display: swap`. **Inter is banned** —
it is the house font of generic AI-built apps.

### 8.4 Signature details (each is buildable, none are decoration)

1. **Perforated edge** — badge cards use CSS radial-gradient notches + a dashed rule, like tear-off
   ticket stock.
2. **Woven lanyard rule** — a 6px `repeating-linear-gradient` diagonal band separates header from
   content; the accent color tracks the active event.
3. **Status tab** — a 6px colored strip on the badge's left edge, animating width on change.
4. **Barcode** — an SVG Code128-style strip generated from the lead id, `aria-hidden`, on every badge
   footer. Cheap, distinctive, unmistakably "credential".
5. **Monogram, not avatar** — initials in a duotone orange/ink plate. No fake stock faces, no AI
   headshots.
6. **Receipt printing** — AI drafts reveal behind a left-to-right mask line, as if printing.

### 8.5 Anti-slop rules (binding on every PR)

- ❌ gradient mesh / aurora blobs, ❌ purple-indigo "AI" palettes, ❌ glassmorphism without reason
- ❌ emoji as icons (use Lucide or inline SVG), ❌ lorem ipsum, ❌ "Unlock …" marketing copy
- ❌ three-column feature grids, ❌ rounded-2xl-on-everything, ❌ untouched shadcn default theme
- ❌ animations > 400ms, ❌ motion that delays access to content
- ✅ Real copy with a voice: terse, backstage-crew. "42 badges. 6 due today." not "You have 42 leads!"
- ✅ Real seed data: 40 believable leads across 3 events (SaaStr Annual, Web Summit, a local SaaS
  meetup) with notes a human would actually scribble.

### 8.6 Motion specification

Toolkit: **Motion** (`motion/react`) for layout & presence, CSS transitions for micro-states.

| Trigger | Motion | Duration | Reduced-motion |
| --- | --- | --- | --- |
| Rail reflow on filter/sort/search | FLIP layout, shared `layout` on badge | 260ms spring (stiffness 380, damping 34) | Instant reorder |
| Badge entrance | Stagger fade+8px rise, 18ms apart, capped at 12 | 220ms | Opacity only, no stagger |
| Badge → detail | Shared-element expand + card `rotateY` flip | 380ms | Cross-fade |
| Detail front/back | 3D `rotateY` with perspective 1200px | 400ms | Cross-fade |
| Status change | Tab width + color; chip pops | 180ms | Instant |
| Filter chip add/remove | `AnimatePresence` height/opacity | 160ms | Instant |
| AI draft | Mask-line print + caret blink | streaming, ~1.5–4s | Plain text as it arrives |
| Toast / undo | Rise 12px + fade; undo bar drains | 5s / 160ms | Fade only |
| Route change | Slide 16px + fade | 220ms | Fade 100ms |

Every motion above is gated by a single `useReducedMotion()` check at the animation boundary — not
scattered conditionals.

---

## 9. Architecture & stack

### 9.1 Decision: single Next.js full-stack app

```
┌────────────────────────────────────────────┐
│  Next.js 15 (App Router, TypeScript strict)│
│  ├─ React Server Components (list, detail) │
│  ├─ Route Handlers = REST API (§9.3)       │
│  ├─ Server Actions for mutations           │
│  └─ Vercel AI SDK (streaming)              │
├────────────────────────────────────────────┤
│  Prisma → PostgreSQL (Neon, free tier)     │
└────────────────────────────────────────────┘
```

**ADR-001 — Monolith over Next.js + FastAPI.**
The brief allows *any* suitable stack. A two-service split adds CORS, a second deploy target, a
second failure mode and a longer README — with zero product benefit for a single-user app. One
deployable = one live link that actually works when a reviewer opens it. The REST API surface
(§9.3) is preserved anyway, so a Python service can be extracted later without redesign.
*Risk:* if a rubric explicitly wants a Python backend, the fallback is a thin FastAPI service
holding `/api/leads*` and `/api/ai*`; the frontend's data layer is isolated in `lib/api.ts` so the
swap touches one file. **Recorded, accepted.**

**ADR-002 — PostgreSQL over SQLite/MongoDB.** Full-text search, enums, `text[]` tags and
transactions without an ORM workaround. Neon gives free serverless Postgres, branching for PRs, and
a stable public URL. SQLite would force a different driver for prod; Mongo adds no value here.

**ADR-003 — Prisma.** Typed client, migrations in-repo, `$transaction` for bulk actions, first-class
Neon support.

**ADR-004 — Server state via TanStack Query, filter state via URL.** Two state domains, explicitly
separated: server cache (Query) and shareable view state (search params). No global store; React
context covers only theme and toast.

**ADR-005 — Motion (`motion/react`)** for `layout`, `AnimatePresence` and shared-element
transitions — the rail reflow and badge flip are not practical in pure CSS.

### 9.2 Frontend stack

`next@15` · `react@19` · `typescript` (strict, `noUncheckedIndexedAccess`) · `motion` ·
`@tanstack/react-query` · `react-hook-form` + `zod` (forms & API validation, one schema source) ·
`lucide-react` · `cmdk` (palette + combobox) · `sonner` (toasts with undo) · `tailwindcss@4`.

### 9.3 API surface (REST, route handlers)

```
GET    /api/leads?q=&status=&event=&tag=&due=&sort=&cursor=
POST   /api/leads
GET    /api/leads/:id
PATCH  /api/leads/:id
DELETE /api/leads/:id
POST   /api/leads/bulk                 { ids, action, value }
GET    /api/events  · POST /api/events · PATCH|DELETE /api/events/:id
GET    /api/leads/:id/followups · POST /api/leads/:id/followups
POST   /api/ai/summarize               { leadId }         → JSON (cached)
POST   /api/ai/draft                   { leadId, channel }→ SSE stream
GET    /api/stats                      → counters for Overview
GET    /api/export.csv?{filters}       · POST /api/import.csv
```

Validation: Zod schemas shared between the form and the handler. Errors return
`{ error: { code, message, fields? } }` — the client renders field-level messages, never `alert()`.

### 9.4 Environment

```
DATABASE_URL=postgresql://…
AI_PROVIDER=openai|anthropic|google
AI_API_KEY=…
AI_MODEL=gpt-4o-mini
AI_MOCK=0|1
APP_PASSCODE=            # optional gate, FR-25
NEXT_PUBLIC_APP_URL=…
```

---

## 10. Non-functional requirements

- **Performance:** LCP < 2.0s on 4G, CLS < 0.05, list interactions feel instant (< 100ms to
  visual feedback). Rail of 500 leads scrolls at 60fps — virtualize with `@tanstack/react-virtual`
  only if the DOM node count measures > ~300.
- **Scale target:** 5,000 leads / 50 events without UX degradation.
- **Reliability:** every mutation optimistic with rollback; every network call has an error path.
- **Security:** all inputs Zod-validated; Prisma parameterizes queries; `Secret`-scoped env vars;
  no API key ever exposed to the client; optional passcode in an httpOnly cookie; no note content in
  logs.
- **Browser support:** last 2 versions of Chrome/Safari/Firefox/Edge. iOS Safari is a first-class
  target (people capture on phones at events).
- **SEO/OG:** metadata API, OG image generated from the app name — minimal, since it's an app, not a
  site.

---

## 11. Testing & quality gates

| Layer | Tool | Scope |
| --- | --- | --- |
| Unit | Vitest | `lib/` — search ranking, filter → query builder, CSV map, AI prompt builders |
| API | Vitest + test DB | Route handlers happy/sad paths, validation, undo/restore |
| AI | Vitest w/ `AI_MOCK=1` | Contract shape of summarize/draft, refusal on thin notes |
| E2E | Playwright | The five journeys below, run in CI |
| Static | `tsc --noEmit`, ESLint, Prettier | Pre-commit via husky + lint-staged; CI-blocking |
| A11y | `@axe-core/playwright` | `/leads` and `/leads/:id`, zero serious violations |

**E2E journeys (the Definition of Working):**
1. Create lead → appears in rail → persists after reload.
2. Search "northwind" + filter `status=contacted` → correct subset, URL reflects state, back restores.
3. Edit → save → values persisted; unsaved-changes guard fires on navigate.
4. Delete → undo → record restored with follow-ups intact.
5. Open lead → summarize (mock) renders chips → draft streams → Copy writes to clipboard.

---

## 12. Delivery

- **Repo:** public GitHub, conventional commits, README below, MIT license, `.env.example`,
  no secrets, no `node_modules`, no build artifacts.
- **CI:** GitHub Actions — install → typecheck → lint → unit → build → E2E (Neon branch as test DB).
- **Deploy:** Vercel (production) + Neon (database). Single live URL recorded in the README badge.
- **README must contain:** screenshot/GIF, quickstart (≤ 5 commands), env var table, architecture
  diagram, **key decisions** (summarize ADR-001…005), known trade-offs, roadmap.
- **Demo video (optional, 60–90s):** capture → search/filter → summarize → draft → send-mark →
  delete/undo. Silent, no voiceover needed, captions burned in.

### 12.1 Build tooling & delegation

Work splits cleanly for parallel agents — each gets this PRD plus its own slice:

- **Slice A** — data layer: schema, migrations, seed, route handlers, tests.
- **Slice B** — design system: tokens, fonts, badge components, motion primitives, Storybook-ish preview route.
- **Slice C** — AI: provider adapter, contracts, mock mode, caching, rate limit, tests.
- **Slice D** — screens: rail, detail, capture, overview, settings — wiring A+B+C.
- **Slice E** — QA: a11y pass, E2E, perf audit, README + video.

Ordering: A → (B ∥ C) → D → E. Skills worth pulling in: UI design-system generation for §8,
code-review for the AI slice, README/doc generation for §12.

---

## 13. Milestones

| M | Scope | Exit criteria |
| --- | --- | --- |
| **M0** Scaffold | Next.js, Tailwind, Prisma, CI, deploy pipeline green | Empty app deployed to a real URL |
| **M1** Data + CRUD | Schema, seed, list/create/edit/delete/search/filter/sort | E2E 1, 2, 3, 4 pass against Postgres |
| **M2** AI | Summarize, draft, cache, mock, degradation | E2E 5 passes; buttons behave with and without a key |
| **M3** Design | Tokens, badge system, motion, responsive, a11y | Axe clean; §8.5 self-audit passes; no layout shift |
| **M4** Polish + ship | Palette, bulk, overview, README, video, perf pass | DoD below |

**Definition of done:** every P0 acceptance criterion verifiable in the deployed app; `tsc`, lint,
unit, E2E and axe all green in CI; README's quickstart works from a clean clone in ≤ 5 commands;
the app is memorable after a 30-second look.

---

## 14. Risks

| Risk | Mitigation |
| --- | --- |
| AI output quality varies → bad demo | Structured output for summaries; strict prompt; mock fallback; regenerate button. |
| Vercel/Ollama key absent at review time | FR-15 degradation + seeded pre-generated summaries so the feature reads even offline. |
| Design gets "corrected" back to generic | §8.5 is binding; PR checklist includes an anti-slop review. |
| Scope creep (auth, pipelines, email send) | Non-goals §2.2; anything new goes to roadmap, not v1. |
| FTS quirks on small tables | `websearch_to_tsquery` + `ts_rank`; fall back to `ILIKE` if ranking misbehaves < 100 rows. |
| Two-service expectation from grader | ADR-001 documents the trade-off and the one-file extraction path. |

---

## Appendix A — Keyboard map

| Key | Action |
| --- | --- |
| `⌘K` / `Ctrl+K` | Command palette |
| `/` | Focus search |
| `n` | New lead |
| `j` / `k` | Move selection down / up |
| `Enter` | Open selected |
| `e` | Edit selected |
| `⌘⌫` / `Delete` | Delete selected (with undo) |
| `1`–`6` | Set status on selected |
| `s` | Summarize · `d` draft |
| `Esc` | Close topmost layer |
| `?` | Shortcut overlay |

## Appendix B — Reduced-motion contract

When `prefers-reduced-motion: reduce` is set: all transforms, staggers, 3D flips and shared-element
transitions are replaced with ≤ 100ms opacity fades or instant state changes; the AI draft still
streams (content, not decoration) but without the mask animation; smooth scrolling is disabled
globally. Nothing becomes unreachable.

## Appendix C — Seed data

40 leads / 3 events, written by hand, not generated:
**SaaStr Annual 2026** (San Francisco, 16), **Web Summit 2025** (Lisbon, 14), **SaaS Builders Meetup**
(Oakland, 10). Notes read like real scrawl — specific pains, half-finished thoughts, one inside joke
each. Status distribution mirrors reality: 40% `NEW`, 25% `CONTACTED`, 15% `REPLIED`, 10% `QUALIFIED`,
5% `WON`, 5% `LOST`. 6 leads have overdue follow-ups so the "due today" view has something to show
on first launch.
