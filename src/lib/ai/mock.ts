import { type Summary } from "@/lib/ai/prompts";

/**
 * Deterministic, content-aware fallback used when no AI key is configured.
 *
 * This is not canned text: every sentence, interest and signal is lifted from the
 * lead's actual notes, so the feature demonstrates real behaviour offline. The UI
 * labels the result as demo mode — it never passes itself off as model output.
 */

const STOP = new Set(
  `a an and are as at be but by for from has have i if in is it its me my of on or our so that the their them then there they this to was we were what when which who will with you your not no yes very just also about after before during over under out up down`.split(
    /\s+/,
  ),
);

/** Words that are common in notes but never describe an interest. */
const GENERIC = new Set(
  `said says wants wanted asked asks needs needed mentioned mentions told gave gave take took come came get got make made go went know think hope next back more less really quite even still just only than then them they their there what when where which while about into onto than that this with from have been were will would could should can may might must send sent share shared email emailed call called meet met book introduce introduction demo please thanks thank hi hello best regards`.split(
    /\s+/,
  ),
);

/** Tags that describe triage state rather than the person. */
const META_TAGS = new Set(["follow-up-urgent", "slow", "priority", "hot", "warm", "cold"]);

/** Terms people lowercase in tags that deserve their real casing. */
const ACRONYMS: Record<string, string> = {
  ai: "AI", saas: "SaaS", revops: "RevOps", pmm: "PMM", plg: "PLG", dach: "DACH",
  smb: "SMB", apac: "APAC", latam: "LATAM", mena: "MENA", eu: "EU", icp: "ICP",
  arr: "ARR", crm: "CRM", nps: "NPS", sre: "SRE", gtm: "GTM", seo: "SEO",
  cx: "CX", ux: "UX", api: "API", sdk: "SDK", ui: "UI", b2b: "B2B",
  salesforce: "Salesforce", hubspot: "HubSpot", marketo: "Marketo", outreach: "Outreach",
  salesloft: "Salesloft", intercom: "Intercom", zendesk: "Zendesk", notion: "Notion",
  slack: "Slack", jira: "Jira", stripe: "Stripe", pipedrive: "Pipedrive",
  airtable: "Airtable", gong: "Gong", amplitude: "Amplitude", mixpanel: "Mixpanel",
};

/** Strip trailing punctuation and restore conventional casing. */
function displayName(term: string): string {
  const clean = term.replace(/[.,;:!?"']+$/, "").trim();
  if (!clean) return clean;
  const parts = clean.split(/\s+/);
  const rendered = parts.map((p) => ACRONYMS[p.toLowerCase()] ?? p);
  return rendered.length === 1
    ? rendered[0]!.length <= 4 && rendered[0] === rendered[0]!.toUpperCase()
      ? rendered[0]!
      : rendered[0]!
    : rendered.join(" ");
}

const HOT_WORDS = [
  "budget", "buy", "signed", "decision", "proposal", "pricing", "procurement",
  "evaluating", "vendor", "wants", "send me", "deadline", "qbr", "reference",
  "contract", "paperwork", "paid", "series a", "series b",
];
const WARM_WORDS = [
  "interested", "asked", "wants", "needs", "follow", "call", "demo", "link",
  "template", "calculator", "documentation", "docs", "pricing", "soon",
];

const SIGNAL_SENTENCES = [
  /budget/i, /decision/i, /evaluat/i, /wants? (to|a)/i, /ask(ed|ing)/i,
  /send (me|us)/i, /procurement/i, /sign/i, /pricing/i, /before (the|their|christmas|q)/i,
  /deadline/i, /right (away|now)/i, /reference/i, /case study/i, /renew/i,
];

function sentences(notes: string): string[] {
  return notes
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 2);
}

function tidy(s: string): string {
  return s.replace(/\s+/g, " ").replace(/^[—–\-•\s]+/, "").trim();
}

function words(s: string): string[] {
  return s.split(/[^A-Za-z0-9'’+#.-]+/).filter(Boolean);
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function clampWords(s: string, max: number): string {
  const w = words(s);
  if (w.length <= max) return s.replace(/[.,;]$/, "");
  return w.slice(0, max).join(" ").replace(/[.,;]$/, "") + "…";
}

function extractInterests(sents: string[], tags: string[]): string[] {
  const found: { term: string; score: number }[] = [];

  // Multi-word proper-noun phrases away from a sentence start read as real
  // topics (product names, teams, tools). Sentence-initial capitals are skipped:
  // they are almost always just the first word of a note.
  for (const s of sents) {
    for (const m of s.matchAll(/\b([A-Z][a-z0-9]{2,}(?:\s+[A-Z][a-z0-9]{2,}){1,2})\b/g)) {
      const idx = m.index ?? 0;
      const prefix = s.slice(0, idx);
      if (prefix.trim() === "" || /[.!?]\s*$/.test(prefix)) continue;
      found.push({ term: m[0].trim(), score: 6 });
    }
  }

  for (const t of tags) {
    const clean = t.replace(/-/g, " ");
    if (!META_TAGS.has(t)) found.push({ term: clean, score: 3 });
  }

  const freq = new Map<string, number>();
  const content = new Set<string>();
  for (const s of sents) {
    for (const w of words(s.toLowerCase())) {
      if (w.length < 4 || STOP.has(w) || GENERIC.has(w)) continue;
      freq.set(w, (freq.get(w) ?? 0) + 1);
      if (!/ed$|ing$|ly$/.test(w)) content.add(w);
    }
  }
  for (const [w, n] of freq) if (n >= 2) found.push({ term: w, score: n });

  // Fill from remaining content words, longest first — in practice these are
  // the nouns people actually scribble down.
  const fill = [...content].sort((a, b) => b.length - a.length);
  for (const w of fill) found.push({ term: w, score: 1 });

  found.sort((a, b) => b.score - a.score);
  const out: string[] = [];
  for (const f of found) {
    const term = f.term.toLowerCase();
    if (out.some((o) => o.toLowerCase().includes(term) || term.includes(o.toLowerCase()))) continue;
    const rendered = displayName(f.term);
    if (!rendered) continue;
    out.push(rendered.length > 34 ? rendered.slice(0, 34) : rendered);
    if (out.length >= 5) break;
  }
  return out;
}

function extractSignals(sents: string[]): string[] {
  const hits = sents.filter((s) => SIGNAL_SENTENCES.some((re) => re.test(s)));
  const source = hits.length > 0 ? hits : sents.slice(0, 2);
  return source
    .slice(0, 3)
    .map((s) => clampWords(tidy(s), 14))
    .filter(Boolean);
}

function scoreTemperature(notes: string, signals: number): Summary["temperature"] {
  const lower = notes.toLowerCase();
  const hot = HOT_WORDS.reduce((n, w) => n + (lower.includes(w) ? 1 : 0), 0);
  const warm = WARM_WORDS.reduce((n, w) => n + (lower.includes(w) ? 1 : 0), 0);
  if (hot >= 3 || (hot >= 2 && signals >= 2)) return "hot";
  if (hot >= 1 || warm >= 3) return "warm";
  return "cold";
}

function nextStepFor(
  sents: string[],
  interests: string[],
  temp: Summary["temperature"],
): string {
  // Only treat a sentence as *my* action if it isn't a request addressed to me.
  const ask = sents.find(
    (s) => /\b(send|share|email|forward|post)\b/i.test(s) && !/\bsend (me|us)\b/i.test(s),
  );
  if (ask) return clampWords(titleCase(tidy(ask)), 20);
  if (interests[0]) {
    const topic = pickTopic(interests, []);
    return temp === "cold"
      ? `Short note referencing ${topic}`
      : `Follow up about ${topic} this week`;
  }
  return temp === "cold"
    ? "Send a short note and park it for next quarter"
    : "Send a short, specific follow-up this week";
}

export function mockSummary(input: {
  notes: string;
  tags: string[];
}): Summary {
  const sents = sentences(input.notes);
  const interests = extractInterests(sents, input.tags);
  const signals = extractSignals(sents);
  const temperature = scoreTemperature(input.notes, signals.length);

  const head = sents.slice(0, 2).map(tidy).join(" ");
  const recall = head
    ? clampWords(head, 60)
    : "Notes are too thin to reconstruct — add a sentence or two about what you discussed.";

  return {
    recall,
    interests,
    signals,
    nextStep: nextStepFor(sents, interests, temperature),
    temperature,
  };
}

/**
 * Prefer a topic that reads like a subject: hyphenated, multi-word or carrying
 * digits/capitals ("on-call", "SOC2", "RevOps") over a bare lowercase tag.
 */
function pickTopic(interests: string[], signals: string[]): string {
  // Prefer a hyphenated or multi-word subject, then anything already cased
  // properly ("AI", "SaaS"), and only then a plain word.
  const hyphenated = interests.find((t) => /[\s-]/.test(t));
  const cased = interests.find((t) => t !== t.toLowerCase());
  return (
    hyphenated ??
    cased ??
    interests[0] ??
    signals[0]?.slice(0, 40) ??
    "what you're working on"
  );
}

const OPENERS: Record<string, string[]> = {
  hot: [
    "You mentioned {topic} — that's the part I kept thinking about after {event}.",
    "Still turning over what you said about {topic} at {event}.",
  ],
  warm: [
    "Good to meet you at {event}. I wanted to send the thing about {topic} rather than another vague hello.",
    "Thanks for the conversation at {event} — particularly the bit about {topic}.",
  ],
  cold: [
    "We crossed paths at {event}. Keeping this short in case it's useful.",
    "Met you briefly at {event} — no pitch, just a note.",
  ],
};

export function mockDraft(input: {
  name: string;
  event: string;
  summary: Summary;
  channel: "EMAIL" | "LINKEDIN" | "SMS";
  signature: string;
}): string {
  const firstName = input.name.split(/\s+/)[0] ?? input.name;
  const topic = pickTopic(input.summary.interests, input.summary.signals);
  const opener =
    OPENERS[input.summary.temperature]?.[
      (input.name.length + input.event.length) %
        (OPENERS[input.summary.temperature]?.length ?? 1)
    ] ??
    OPENERS.warm?.[0] ??
    "Good to meet you at {event}.";

  const line1 = opener.replace("{topic}", topic).replace("{event}", input.event);

  const detail = input.summary.signals[0]
    ? `You put it well: "${clampWords(tidy(input.summary.signals[0]), 16).replace(/…$/, "")}".`
    : `Happy to be useful on that.`;

  const body =
    input.channel === "SMS"
      ? `${line1} ${detail}`.replace(/\s+/g, " ")
      : [
          `Hi ${firstName},`,
          line1,
          detail,
          input.summary.nextStep
            ? `On that — ${input.summary.nextStep.replace(/^\w/, (c) => c.toLowerCase())}.`
            : `No agenda, just wanted to close the loop.`,
          `Best,${input.signature ? `\n${input.signature}` : ""}`,
        ].join("\n\n");

  if (input.channel === "SMS") return body.slice(0, 200);
  if (input.channel === "LINKEDIN") {
    return [
      `Hi ${firstName} — good to meet you at ${input.event}.`,
      `${line1} ${detail}`,
      input.summary.nextStep ? input.summary.nextStep : `Let's stay in touch.`,
    ].join(" ");
  }
  return body;
}
