import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";
import { LEAD_STATUSES, type LeadStatus, type Temperature } from "../src/lib/statuses";
import { buildSearchIndex } from "../src/lib/search";

/**
 * Hand-written seed data (PRD Appendix C).
 * 40 leads across 3 events, notes written the way people actually scribble them.
 */

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});
const db = new PrismaClient({ adapter });

type SeedFollowUp = {
  channel: "EMAIL" | "LINKEDIN" | "CALL" | "NOTE";
  direction: "OUT" | "IN";
  body: string;
  sentAt: string;
};

type SeedLead = {
  n: string;
  c?: string;
  t?: string;
  e?: string;
  p?: string;
  s?: string;
  ev: number;
  st: LeadStatus;
  tp?: Temperature;
  tags: string[];
  notes: string;
  /** days after the event's start date */
  d: number;
  /** next follow-up, ISO date */
  fu?: string;
  f?: SeedFollowUp[];
};

const EVENTS = [
  {
    name: "SaaStr Annual 2026",
    location: "San Francisco, CA",
    startsAt: "2026-09-14",
    endsAt: "2026-09-16",
    accent: "#FF4D00",
  },
  {
    name: "Web Summit 2025",
    location: "Lisbon, PT",
    startsAt: "2025-11-11",
    endsAt: "2025-11-14",
    accent: "#2F5FE0",
  },
  {
    name: "SaaS Builders Meetup",
    location: "Oakland, CA",
    startsAt: "2026-08-06",
    endsAt: "2026-08-06",
    accent: "#0B6E4F",
  },
];

const LEADS: SeedLead[] = [
  // ---------------- SaaStr Annual 2026 (16) ----------------
  {
    n: "Maya Okonkwo", c: "Northwind Analytics", t: "VP Revenue Operations", e: "maya@northwind.io",
    p: "+1 415 555 0143", s: "Booth — demo corner", ev: 1, st: "QUALIFIED", tp: "hot",
    tags: ["revops", "saas", "follow-up-urgent"],
    notes: "QBR deck is a mess — 40 slides, no narrative. HATES Salesforce standard reports. Asked twice what our export looks like. Mentioned their board wants pipeline coverage weekly. Whiskey: high-standards, no ice. Said 'send me the thing you showed me' before walking off.",
    d: 0, fu: "2026-09-28",
    f: [
      { channel: "EMAIL", direction: "OUT", body: "Maya — good to meet you at SaaStr. Sending the pipeline coverage board template we walked through, plus the export sample you asked for.", sentAt: "2026-09-18" },
      { channel: "EMAIL", direction: "IN", body: "This is better than what we have. Can you do Thursday 10am PT to show how the weekly rollup gets built?", sentAt: "2026-09-21" },
    ],
  },
  {
    n: "Daniel Reyes", c: "Lumen Payments", t: "Head of Product", e: "daniel@lumenpay.com",
    s: "Talk — 'Pricing you can defend'", ev: 1, st: "CONTACTED", tp: "warm",
    tags: ["fintech", "pricing"],
    notes: "Building usage-based pricing and keeps getting burned by finance on true-ups. Wants to know if we handle seat+usage hybrid. Two kids, was rushing to a customer dinner. Asked for the calculator link.",
    d: 0, fu: "2026-10-12",
    f: [{ channel: "EMAIL", direction: "OUT", body: "Daniel — as promised, the hybrid seat+usage calculator. The true-up tab is the one your finance team will care about.", sentAt: "2026-09-19" }],
  },
  {
    n: "Priya Raghavan", c: "Beacon Health", t: "Director of Growth", e: "priya.r@beaconhealth.co",
    s: "Hallway track", ev: 1, st: "REPLIED", tp: "hot",
    tags: ["healthtech", "series-b", "referral"],
    notes: "Compliance is the blocker — HIPAA + SOC2, procurement takes 90 days minimum. Introduced me to her old colleague Tomas who runs growth at Fathom. Wants pricing that survives a security review. Very direct, hates fluff.",
    d: 1, fu: "2026-10-02",
    f: [
      { channel: "EMAIL", direction: "OUT", body: "Priya — security packet attached, plus the BAA draft. Skipping the fluff as requested.", sentAt: "2026-09-22" },
      { channel: "EMAIL", direction: "IN", body: "Passed to our CISO. He'll come back with questions next week. Also — Tomas says hi, cc'd him.", sentAt: "2026-09-25" },
    ],
  },
  {
    n: "Tomas Lindqvist", c: "Fathom Analytics", t: "Growth Lead", e: "tomas@fathom.so",
    s: "Referral from Priya", ev: 1, st: "NEW", tp: "warm", tags: ["referral", "saas"],
    notes: "Warm intro from Priya. Runs growth solo, team of 3. Asked for a Loom before any call — doesn't do discovery calls cold.",
    d: 1, fu: "2026-09-30",
  },
  {
    n: "Grace Wu", c: "Carton", t: "Co-founder & CEO", e: "grace@carton.dev",
    s: "Booth — demo corner", ev: 1, st: "WON", tp: "hot",
    tags: ["founder", "devtools", "champion"],
    notes: "Seed stage, 11 people. Signed at the booth on day 2 using a credit card, which almost never happens. Wants to be a reference customer if we help her with the launch post.",
    d: 1, fu: "",
    f: [{ channel: "EMAIL", direction: "OUT", body: "Grace — welcome aboard. Onboarding link, and I'll draft the launch post we discussed for your review Friday.", sentAt: "2026-09-17" }],
  },
  {
    n: "Omar Haddad", c: "Ridgeline Logistics", t: "CTO", e: "omar@ridgeline.co",
    s: "Talk — 'Pricing you can defend'", ev: 1, st: "NEW", tp: "cold",
    tags: ["logistics", "enterprise"],
    notes: "Very skeptical of anything that smells like a dashboard vendor. Runs everything through a data warehouse first. 'Show me the SQL.'",
    d: 0, fu: "2026-10-20",
  },
  {
    n: "Elena Vasquez", c: "Brightside HR", t: "VP Marketing", e: "elena@brightsidehr.com",
    s: "Sponsor dinner", ev: 1, st: "CONTACTED", tp: "warm",
    tags: ["hrtech", "content"],
    notes: "Wants a co-marketing webinar in Q4 — their CFO is the draw. Talked a lot about their podcast relaunch. Vegan, ordered the oat thing.",
    d: 2, fu: "2026-10-09",
    f: [{ channel: "EMAIL", direction: "OUT", body: "Elena — two windows that work for the webinar: Oct 28 or Nov 4. I'll bring the outline either way.", sentAt: "2026-09-29" }],
  },
  {
    n: "Ben Kowalski", c: "Pellet", t: "Founding AE", e: "ben@pellet.io",
    s: "Hallway track", ev: 1, st: "LOST", tp: "cold",
    tags: ["sales"],
    notes: "Nice guy, but they bought their current tool in July and are locked in until next August. Said to check back in Q3 2027.",
    d: 2, fu: "",
  },
  {
    n: "Aisha Bello", c: "Verity Labs", t: "Head of Data", e: "aisha@veritylabs.ai",
    s: "Booth — demo corner", ev: 1, st: "REPLIED", tp: "hot",
    tags: ["ai", "data", "follow-up-urgent"],
    notes: "Evaluating three vendors, decision by end of month. Needs SSO and audit logs — asked for the SOC2 report specifically. Competitor mentioned: they already have Metabase but nobody uses it.",
    d: 0, fu: "2026-09-29",
    f: [
      { channel: "EMAIL", direction: "OUT", body: "Aisha — SOC2 Type II and the SSO setup guide are attached. Audit logs ship on the Growth tier.", sentAt: "2026-09-20" },
      { channel: "LINKEDIN", direction: "IN", body: "Got it, thanks. Forwarding to our security lead today.", sentAt: "2026-09-23" },
    ],
  },
  {
    n: "Marcus Feld", c: "Tidewater Bank", t: "Director, Innovation", e: "m.feld@tidewater.bank",
    s: "Talk — 'Pricing you can defend'", ev: 1, st: "NEW", tp: "cold",
    tags: ["finserv", "enterprise", "slow"],
    notes: "Regulated. Nothing happens without a vendor risk assessment. Gave me a card with a handwritten extension, which felt like a small victory.",
    d: 0, fu: "2026-11-02",
  },
  {
    n: "Sofia Marchetti", c: "Kestrel", t: "Product Marketing Manager", e: "sofia@kestrel.app",
    s: "Booth — demo corner", ev: 1, st: "CONTACTED", tp: "warm",
    tags: ["pmm", "positioning"],
    notes: "Asked how we position against the incumbent — she's writing a battlecard and wanted our honest take. Very sharp on competitive framing.",
    d: 1, fu: "2026-10-15",
    f: [{ channel: "EMAIL", direction: "OUT", body: "Sofia — honest take below, including where we lose. Battlecard skeleton attached.", sentAt: "2026-09-24" }],
  },
  {
    n: "Ravi Menon", c: "Loopwell", t: "CEO", e: "ravi@loopwell.com",
    s: "Founder breakfast", ev: 1, st: "REPLIED", tp: "hot",
    tags: ["founder", "series-a", "friend"],
    notes: "Old contact from 2023, reconnected. Raising a Series A, closes November. Wants a term sheet–friendly annual price and a case study by then. Texts instead of email.",
    d: 0, fu: "2026-10-10",
    f: [{ channel: "NOTE", direction: "OUT", body: "Texted the annual pricing one-pager. He prefers SMS — number is on the record.", sentAt: "2026-09-16" }],
  },
  {
    n: "Chloe Adams", c: "Fernweh Travel", t: "Brand Director", e: "chloe@fernweh.travel",
    s: "Sponsor dinner", ev: 1, st: "NEW", tp: "warm",
    tags: ["brand", "travel"],
    notes: "Very design-led. Cares about how the output looks more than what it says. 'If it's ugly I won't send it.' Fair.",
    d: 2, fu: "2026-10-14",
  },
  {
    n: "Hugo Almeida", c: "Nimbus Freight", t: "VP Sales", e: "hugo@nimbusfreight.com",
    s: "Hallway track", ev: 1, st: "NEW", tp: "warm",
    tags: ["logistics", "sales"],
    notes: "Team of 9 AEs, no CRM hygiene. Wants something reps will actually use. Skeptical of 'AI' as a label — said don't call it AI in the deck.",
    d: 1, fu: "2026-10-13",
  },
  {
    n: "Nina Petrov", c: "Atlas Compliance", t: "Founder", e: "nina@atlascompliance.io",
    s: "Talk — 'Pricing you can defend'", ev: 1, st: "LOST", tp: "cold",
    tags: ["regtech"],
    notes: "Wanted a free tier for her 4-person team. Couldn't make that work. Wishing her well — genuinely good product.",
    d: 0, fu: "",
  },
  {
    n: "Jack Thornton", c: "Copperfield", t: "RevOps Manager", e: "jack@copperfield.co",
    s: "Booth — demo corner", ev: 1, st: "CONTACTED", tp: "warm",
    tags: ["revops", "saas"],
    notes: "The actual evaluator — Priya's counterpart but at a smaller shop. Needs it working before their QBR on the 20th. Asked about Salesforce sync depth.",
    d: 1, fu: "2026-10-11",
    f: [{ channel: "EMAIL", direction: "OUT", body: "Jack — field-level sync doc attached. Happy to do a 20-minute setup call before your QBR.", sentAt: "2026-09-26" }],
  },

  // ---------------- Web Summit 2025 (14) ----------------
  {
    n: "Ingrid Solberg", c: "Nordlys Energy", t: "Head of Digital", e: "ingrid@nordlys.no",
    s: "VIP dinner", ev: 2, st: "CONTACTED", tp: "warm",
    tags: ["energy", "enterprise", "eu"],
    notes: "GDPR is non-negotiable, data must stay in the EU. Mentioned a tender in March. Very formal — addressed me by surname in the follow-up.",
    d: 1, fu: "2026-10-19",
    f: [{ channel: "EMAIL", direction: "OUT", body: "Ms. Solberg — as discussed, our EU data residency documentation and the March tender timeline noted.", sentAt: "2025-11-20" }],
  },
  {
    n: "Tomás Ferreira", c: "Brisa Mobility", t: "Product Lead", e: "tomas@brisa.pt",
    s: "Startup showcase", ev: 2, st: "REPLIED", tp: "warm",
    tags: ["mobility", "lisbon"],
    notes: "Local, wants to meet in person next time I'm in Lisbon. Building fleet dashboards. Asked if we white-label.",
    d: 0, fu: "2026-11-05",
    f: [{ channel: "EMAIL", direction: "IN", body: "Are you back in Lisbon before the year ends? Coffee is on me.", sentAt: "2025-12-02" }],
  },
  {
    n: "Hannah Weiss", c: "Klarheit", t: "Growth Director", e: "hannah@klarheit.de",
    s: "Panel — PLG in Europe", ev: 2, st: "NEW", tp: "warm",
    tags: ["plg", "dach"],
    notes: "Came up after the panel, talked about DACH pricing expectations — they flinch at per-seat. Wants a euro-denominated option.",
    d: 0, fu: "2026-10-18",
  },
  {
    n: "Youssef Amrani", c: "Souk Analytics", t: "CTO", e: "youssef@souk.ma",
    s: "Hallway track", ev: 2, st: "NEW", tp: "cold",
    tags: ["data"],
    notes: "Small team, mostly curious. Asked three questions about our query layer and left before I could get his card — got it from the badge scan instead.",
    d: 1, fu: "",
  },
  {
    n: "Lucia Ferrari", c: "Piazza", t: "CMO", e: "lucia@piazza.it",
    s: "VIP dinner", ev: 2, st: "QUALIFIED", tp: "hot",
    tags: ["marketing", "europe", "follow-up-urgent"],
    notes: "Runs a 22-person marketing org, consolidating four tools into one. Budget approved for Q1, wants a proposal before Christmas. Very charming, very direct, no time for a pilot — wants a paid proof of concept.",
    d: 2, fu: "2026-10-07",
    f: [
      { channel: "EMAIL", direction: "OUT", body: "Lucia — proposal v1 attached. I've scoped it as a 60-day paid proof of concept rather than a free pilot, as you suggested.", sentAt: "2025-11-25" },
      { channel: "CALL", direction: "IN", body: "20 minutes on the phone. She wants the POC to start Jan 5 and needs a revised number for the second seat tier.", sentAt: "2025-12-04" },
    ],
  },
  {
    n: "Callum Reid", c: "Hexley", t: "Founder", e: "callum@hexley.dev",
    s: "Startup showcase", ev: 2, st: "NEW", tp: "cold",
    tags: ["devtools", "seed"],
    notes: "Pre-seed, building a CLI. Not a fit today but asked to stay in touch. Genuinely funny guy.",
    d: 0, fu: "",
  },
  {
    n: "Anneke de Vries", c: "Havenstad", t: "COO", e: "anneke@havenstad.nl",
    s: "Panel — PLG in Europe", ev: 2, st: "CONTACTED", tp: "warm",
    tags: ["ops", "enterprise", "europe"],
    notes: "Operations background, wants SLAs in writing before anything else. Asked for references in Benelux — we don't have any yet, which I said plainly.",
    d: 1, fu: "2026-10-16",
    f: [{ channel: "EMAIL", direction: "OUT", body: "Anneke — honest answer on Benelux references: we don't have one yet. Here's what we can offer instead.", sentAt: "2025-11-28" }],
  },
  {
    n: "Miguel Santos", c: "Azul Cloud", t: "VP Partnerships", e: "miguel@azulcloud.com",
    s: "VIP dinner", ev: 2, st: "NEW", tp: "warm",
    tags: ["partnerships", "latam"],
    notes: "Interested in a reseller arrangement for LATAM. Asked about margin structure twice — that's the whole conversation for him.",
    d: 2, fu: "2026-10-21",
  },
  {
    n: "Ruth Nakamura", c: "Kaido Systems", t: "Head of Ops", e: "ruth@kaido.jp",
    s: "Hallway track", ev: 2, st: "NEW", tp: "cold",
    tags: ["ops", "apac"],
    notes: "Timezone is the friction — JST. Asked whether we do async onboarding. Took a sticker, seemed politely noncommittal.",
    d: 1, fu: "",
  },
  {
    n: "Pierre Dubois", c: "Atelier Data", t: "Principal Consultant", e: "pierre@atelierdata.fr",
    s: "Talk — 'Pricing you can defend'", ev: 2, st: "NEW", tp: "warm",
    tags: ["consulting", "france"],
    notes: "Wants to rebundle us into his client engagements — effectively a services partnership. Needs a partner rate card, which we do not have yet.",
    d: 0, fu: "2026-10-22",
  },
  {
    n: "Sanne Bakker", c: "Vloed", t: "CEO", e: "sanne@vloed.nl",
    s: "Startup showcase", ev: 2, st: "REPLIED", tp: "hot",
    tags: ["founder", "europe", "champion"],
    notes: "Series A, 30 people, very fast decision maker. Asked for a call the week after Summit — we did it, she said yes verbally. Waiting on procurement paperwork since December, which is infuriating.",
    d: 0, fu: "2026-10-01",
    f: [
      { channel: "CALL", direction: "OUT", body: "Verbal yes on the Growth plan. Procurement to send paperwork 'by Friday' — that was December.", sentAt: "2025-12-05" },
      { channel: "EMAIL", direction: "OUT", body: "Sanne — gentle nudge on the paperwork. Happy to jump on with your procurement lead if that unblocks it.", sentAt: "2026-01-14" },
    ],
  },
  {
    n: "Viktor Kraus", c: "Steinbach Werk", t: "IT Director", e: "v.kraus@steinbach.de",
    s: "Hallway track", ev: 2, st: "LOST", tp: "cold",
    tags: ["dach", "enterprise"],
    notes: "Selected an incumbent with an existing framework agreement. Respectable process, wrong timing. Asked to be re-approached at contract renewal in 2027.",
    d: 2, fu: "",
  },
  {
    n: "Nadia Rahman", c: "Quill", t: "Content Lead", e: "nadia@quill.media",
    s: "Panel — PLG in Europe", ev: 2, st: "NEW", tp: "warm",
    tags: ["content"],
    notes: "Asked whether outputs can be trained on their brand voice. Answer was 'partially, with examples' — she seemed satisfied.",
    d: 0, fu: "2026-10-17",
  },
  {
    n: "Erik Halvorsen", c: "Fjordline", t: "CFO", e: "erik@fjordline.no",
    s: "VIP dinner", ev: 2, st: "CONTACTED", tp: "cold",
    tags: ["finance", "enterprise"],
    notes: "Numbers person, wants a 3-year TCO comparison against doing it in-house. Was polite but unmoved by the demo.",
    d: 2, fu: "2026-11-10",
    f: [{ channel: "EMAIL", direction: "OUT", body: "Erik — 3-year TCO model attached, with the in-house build costed at two FTEs. Tab 3 is the honest comparison.", sentAt: "2025-12-11" }],
  },

  // ---------------- SaaS Builders Meetup (10) ----------------
  {
    n: "Jordan Pike", c: "Ledgerly", t: "Co-founder", e: "jordan@ledgerly.app",
    s: "Lightning talk", ev: 3, st: "REPLIED", tp: "hot",
    tags: ["founder", "bootstrapped", "friend"],
    notes: "Gave the lightning talk on churn. Bootstrapped, profitable, allergic to enterprise sales cycles. Wants something simple and cheap. Said 'don't send me a calendar link'.",
    d: 0, fu: "@0",
    f: [
      { channel: "EMAIL", direction: "OUT", body: "Jordan — no calendar link, as promised. Three questions by email, answer whenever.", sentAt: "2026-08-08" },
      { channel: "EMAIL", direction: "IN", body: "Answers: yes, monthly, and the notes field is the only thing I actually care about.", sentAt: "2026-08-09" },
    ],
  },
  {
    n: "Amara Diallo", c: "Tessellate", t: "Engineering Manager", e: "amara@tessellate.io",
    s: "Lightning talk", ev: 3, st: "NEW", tp: "warm",
    tags: ["engineering"],
    notes: "Asked about our API rate limits and whether webhooks are at-least-once. Clearly technical, will read the docs before talking to me.",
    d: 0, fu: "2026-10-12",
  },
  {
    n: "Casey Nolan", c: "Freightbird", t: "Head of Sales", e: "casey@freightbird.com",
    s: "After drinks", ev: 3, st: "CONTACTED", tp: "warm",
    tags: ["sales", "follow-up-urgent"],
    notes: "Lost two reps last quarter and is rebuilding process from scratch. Wants something the new hires can't break. Very practical, no patience for theory.",
    d: 0, fu: "@0",
    f: [{ channel: "EMAIL", direction: "OUT", body: "Casey — the new-hire workflow doc you asked for. It assumes zero CRM knowledge on day one.", sentAt: "2026-08-12" }],
  },
  {
    n: "Devon Wu", c: "Marginal", t: "Founder", e: "devon@marginal.dev",
    s: "Lightning talk", ev: 3, st: "NEW", tp: "cold",
    tags: ["seed"],
    notes: "Just shipped, no customers yet. Wants to revisit when he has leads to manage. Fair.",
    d: 0, fu: "2026-12-01",
  },
  {
    n: "Fatima Zahra", c: "Marsad", t: "Growth Lead", e: "fatima@marsad.ma",
    s: "After drinks", ev: 3, st: "NEW", tp: "warm",
    tags: ["growth", "mena"],
    notes: "Building the first growth function at a 40-person company. Asked for a template rather than a demo — wants to see the artifact first.",
    d: 0, fu: "2026-10-15",
  },
  {
    n: "Leo Fontaine", c: "Bistrot OS", t: "CEO", e: "leo@bistrotos.com",
    s: "Lightning talk", ev: 3, st: "QUALIFIED", tp: "hot",
    tags: ["hospitality", "smb", "founder"],
    notes: "Hospitality SMB, 900 restaurant customers, all of them terrible at follow-up — literally his pitch. Wants to embed us. Asked about revenue share. Said he'd intro us to two other founders this week.",
    d: 0, fu: "2026-10-03",
    f: [
      { channel: "EMAIL", direction: "OUT", body: "Leo — revenue share sketch attached, plus the embed options you asked for.", sentAt: "2026-08-14" },
      { channel: "LINKEDIN", direction: "IN", body: "Intro'd you to Marta and Kwame — both have the same problem you're solving.", sentAt: "2026-08-17" },
    ],
  },
  {
    n: "Marta Silva", c: "Casa Verde", t: "Owner", e: "marta@casaverde.pt",
    s: "Referral from Leo", ev: 3, st: "NEW", tp: "warm",
    tags: ["hospitality", "smb", "referral"],
    notes: "Warm intro from Leo. Single-location, wants something she can use on her phone between services. Non-technical, will need hand-holding.",
    d: 2, fu: "2026-10-11",
  },
  {
    n: "Kwame Boateng", c: "Adinkra Labs", t: "Founder", e: "kwame@adinkralabs.com",
    s: "Referral from Leo", ev: 3, st: "NEW", tp: "warm",
    tags: ["founder", "referral", "africa"],
    notes: "Second of Leo's intros. Building tools for SMEs in Ghana. Payment friction is the real blocker, not features.",
    d: 2, fu: "2026-10-16",
  },
  {
    n: "Sara Lindgren", c: "Hällsten", t: "Marketing Manager", e: "sara@hallsten.se",
    s: "After drinks", ev: 3, st: "NEW", tp: "cold",
    tags: ["marketing", "nordics"],
    notes: "Was mostly there for the free pizza, honestly. Polite, took a card, no clear need. Not worth a sequence.",
    d: 0, fu: "",
  },
  {
    n: "Noah Kim", c: "Parallelle", t: "CTO", e: "noah@parallelle.ai",
    s: "Lightning talk", ev: 3, st: "WON", tp: "hot",
    tags: ["ai", "champion", "founder"],
    notes: "Went from meetup to paid in eleven days — fastest cycle I've had. Wanted the team on before their launch. Asked for a Slack channel, which we gave him.",
    d: 0, fu: "",
    f: [{ channel: "EMAIL", direction: "OUT", body: "Noah — you're live. Slack channel is set up, I'm in it all week.", sentAt: "2026-08-17" }],
  },
];

function isoDaysAfter(start: string, days: number): string {
  const d = new Date(`${start}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Follow-up dates.
 *
 * `"@0"` means today, `"@-3"` three days ago — relative on purpose. A hard-coded
 * "today" in seed data silently rots: the demo would ship with an empty queue the
 * first time the date rolls over. Absolute dates are kept where they must stay
 * absolute (everything genuinely in the past or the future).
 */
function followUpDate(value: string | undefined): Date | null {
  if (!value) return null;
  if (value.startsWith("@")) {
    const offset = Number.parseInt(value.slice(1), 10) || 0;
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() + offset);
    return d;
  }
  return new Date(`${value}T12:00:00Z`);
}

async function main() {
  console.log("Seeding Lanyard…");

  // Wipe in dependency order so re-seeding is idempotent.
  await db.followUp.deleteMany();
  await db.aiCall.deleteMany();
  await db.leadTag.deleteMany();
  await db.lead.deleteMany();
  await db.event.deleteMany();

  const createdEvents = [];
  for (const e of EVENTS) {
    createdEvents.push(
      await db.event.create({
        data: {
          name: e.name,
          location: e.location,
          startsAt: new Date(`${e.startsAt}T12:00:00Z`),
          endsAt: new Date(`${e.endsAt}T12:00:00Z`),
          accent: e.accent,
        },
      }),
    );
  }

  let created = 0;
  for (const row of LEADS) {
    const event = createdEvents[row.ev - 1];
    if (!event) throw new Error(`Lead ${row.n} references missing event ${row.ev}`);

    const metAt = isoDaysAfter(EVENTS[row.ev - 1]!.startsAt, row.d);
    const tags = [...new Set(row.tags)];

    await db.lead.create({
      data: {
        name: row.n,
        company: row.c ?? null,
        title: row.t ?? null,
        email: row.e ?? null,
        phone: row.p ?? null,
        source: row.s ?? null,
        notes: row.notes,
        status: row.st,
        temperature: row.tp ?? null,
        eventId: event.id,
        nextFollowUpAt: followUpDate(row.fu),
        lastContactedAt: row.f?.length
          ? new Date(`${row.f[row.f.length - 1]!.sentAt}T12:00:00Z`)
          : null,
        createdAt: new Date(`${metAt}T12:00:00Z`),
        search: buildSearchIndex({
          name: row.n,
          company: row.c,
          title: row.t,
          email: row.e,
          source: row.s,
          notes: row.notes,
          tags,
          eventName: event.name,
        }),
        tags: { create: tags.map((tag) => ({ tag })) },
        followUps: {
          create: (row.f ?? []).map((f) => ({
            channel: f.channel,
            direction: f.direction,
            body: f.body,
            sentAt: new Date(`${f.sentAt}T12:00:00Z`),
          })),
        },
      },
    });
    created++;
  }

  const counts: Record<string, number> = {};
  for (const s of LEAD_STATUSES) counts[s] = LEADS.filter((l) => l.st === s).length;

  const total = await db.lead.count();
  const followUps = await db.followUp.count();
  const tags = await db.leadTag.count();

  console.log(`Events:  ${createdEvents.length}`);
  console.log(`Leads:   ${total} (seeded ${created})`);
  console.log(`Tags:    ${tags}`);
  console.log(`History: ${followUps} follow-ups`);
  console.log(
    "Status:  " + LEAD_STATUSES.map((s) => `${s}=${counts[s] ?? 0}`).join("  "),
  );
}

main()
  .then(() => db.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await db.$disconnect();
    process.exit(1);
  });
