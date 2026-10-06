/**
 * Search index + query helpers.
 *
 * SQLite has no full-text index in Prisma, so each lead carries a pre-lowercased
 * `search` haystack built at write time. Queries split the user's input on
 * whitespace and AND the terms together, which behaves better than a single
 * substring match for multi-word searches like "northwind revops".
 */

export type SearchSource = {
  name: string;
  company?: string | null;
  title?: string | null;
  email?: string | null;
  source?: string | null;
  notes?: string | null;
  tags?: string[];
  eventName?: string | null;
};

export function buildSearchIndex(s: SearchSource): string {
  return [
    s.name,
    s.company,
    s.title,
    s.email,
    s.source,
    s.notes,
    s.eventName,
    ...(s.tags ?? []),
  ]
    .filter(Boolean)
    .join(" \n ")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\s+/g, " ")
    .trim();
}

/** Split a raw query into lowercase terms; quotes force an exact phrase. */
export function parseQuery(q: string | undefined | null): string[] {
  if (!q) return [];
  const phrases = q.match(/"([^"]+)"/g) ?? [];
  const rest = q.replace(/"([^"]+)"/g, " ");
  const terms = [...phrases.map((p) => p.slice(1, -1).trim()), ...rest.split(/\s+/)]
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 0);
  return [...new Set(terms)];
}

/**
 * Highlight ranges for a single term inside `text`.
 * Returns `[start, end]` pairs, already merged when overlaps occur.
 */
export function highlightRanges(text: string, terms: string[]): [number, number][] {
  if (terms.length === 0) return [];
  const lower = text.toLowerCase();
  const ranges: [number, number][] = [];
  for (const term of terms) {
    if (!term) continue;
    let from = 0;
    for (;;) {
      const i = lower.indexOf(term, from);
      if (i === -1) break;
      ranges.push([i, i + term.length]);
      from = i + term.length;
    }
  }
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([r[0], r[1]]);
  }
  return merged;
}

/** Split text into highlighted / plain segments for rendering. */
export function segments(
  text: string,
  terms: string[],
): { text: string; hit: boolean }[] {
  const ranges = highlightRanges(text, terms);
  if (ranges.length === 0) return [{ text, hit: false }];
  const out: { text: string; hit: boolean }[] = [];
  let cursor = 0;
  for (const [start, end] of ranges) {
    if (start > cursor) out.push({ text: text.slice(cursor, start), hit: false });
    out.push({ text: text.slice(start, end), hit: true });
    cursor = end;
  }
  if (cursor < text.length) out.push({ text: text.slice(cursor), hit: false });
  return out;
}
