/**
 * End-to-end smoke test for the Lanyard API.
 *
 *   npm run build && npx next start -p 3000
 *   node scripts/api-check.mjs
 *
 * Exercises every core capability from the brief against a running server:
 * create / edit / delete / search / filter, persistence, AI summarize + draft,
 * undo-restore, and CSV export.
 */

const BASE = process.env.BASE_URL ?? "http://localhost:3000";

let failures = 0;
let createdId = null;
const cleanupIds = [];

function check(name, condition, detail = "") {
  if (!condition) failures += 1;
  console.log(`${condition ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

const json = (method, body) => ({
  method,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

async function main() {
  const events = await (await fetch(`${BASE}/api/events`)).json();
  const eventId = events.items[0]?.id;
  check("list events", events.items.length === 3, `count=${events.items.length}`);
  if (!eventId) throw new Error("No events — run `npm run db:seed` first.");

  /* ------------------------------------------------------------ validation */
  let res = await fetch(`${BASE}/api/leads`, json("POST", { name: "", eventId: "" }));
  let body = await res.json();
  check(
    "rejects invalid lead with field errors",
    res.status === 422 && Boolean(body.error?.fields?.name),
    `status=${res.status}`,
  );

  /* ----------------------------------------------------------------- create */
  const payload = {
    name: "Zoe Testwright",
    company: "Acme QA",
    title: "Principal SRE",
    email: "zoe@acme.dev",
    source: "Hallway track",
    notes:
      "Said their on-call rotation is a mess. Evaluated three vendors last quarter and wants pricing before Friday.",
    status: "NEW",
    eventId,
    tags: ["sre", "testing"],
    nextFollowUpAt: new Date().toISOString().slice(0, 10),
  };
  res = await fetch(`${BASE}/api/leads`, json("POST", payload));
  body = await res.json();
  createdId = body.lead?.id ?? null;
  check("creates a lead", res.status === 201 && Boolean(createdId), `status=${res.status}`);

  res = await fetch(`${BASE}/api/leads`, json("POST", { ...payload, name: "Zoe Dup" }));
  const dup = await res.json();
  if (dup.lead?.id) cleanupIds.push(dup.lead.id);
  check("warns on duplicate email but still saves", res.status === 201 && dup.duplicate?.id === createdId);

  /* -------------------------------------------------- search, filter, sort */
  res = await fetch(`${BASE}/api/leads?q=on-call`);
  let list = await res.json();
  check("searches note text", list.items.some((i) => i.id === createdId), `hits=${list.items.length}`);

  res = await fetch(`${BASE}/api/leads?q=${encodeURIComponent("acme sre")}&status=NEW`);
  list = await res.json();
  check("combines search with a status filter", list.items.some((i) => i.id === createdId));

  res = await fetch(`${BASE}/api/leads?due=today`);
  list = await res.json();
  check(
    "filters by follow-up due today",
    list.items.length > 0 && list.items.every((i) => i.due === "today"),
    `n=${list.items.length}`,
  );

  res = await fetch(`${BASE}/api/leads?event=${eventId}`);
  list = await res.json();
  check("filters by event", list.items.every((i) => i.event.id === eventId));

  res = await fetch(`${BASE}/api/leads?sort=name&limit=5`);
  list = await res.json();
  const names = list.items.map((i) => i.name);
  const sorted = [...names].sort((a, b) => a.localeCompare(b));
  check("sorts by name", JSON.stringify(names) === JSON.stringify(sorted), names[0] ?? "");

  /* ------------------------------------------------------------------ edit */
  res = await fetch(`${BASE}/api/leads/${createdId}`, json("PATCH", { status: "CONTACTED" }));
  body = await res.json();
  check("status-only patch", res.status === 200 && body.lead?.status === "CONTACTED");

  const edited = { ...payload, status: "CONTACTED", tags: ["sre", "testing", "priority"], notes: payload.notes + " Also asked about SSO." };
  res = await fetch(`${BASE}/api/leads/${createdId}`, json("PATCH", edited));
  body = await res.json();
  check(
    "full edit including tags",
    res.status === 200 && Array.isArray(body.lead?.tags) && body.lead.tags.includes("priority"),
    `status=${res.status} tags=${body.lead?.tags?.join(",") ?? "-"}`,
  );

  res = await fetch(`${BASE}/api/leads`, json("POST", payload));
  const second = await res.json();
  if (second.lead?.id) cleanupIds.push(second.lead.id);
  res = await fetch(`${BASE}/api/leads/${second.lead.id}`, json("PATCH", edited));
  body = await res.json();
  check("persists across re-read", body.lead?.notes?.includes("SSO"));

  /* --------------------------------------------------------------- history */
  res = await fetch(`${BASE}/api/leads/${createdId}/followups`, json("POST", { channel: "EMAIL", direction: "OUT", body: "Sent the pricing one-pager." }));
  const followUp = await res.json();
  check("logs a follow-up", res.status === 201 && Boolean(followUp.item?.id), `status=${res.status}`);

  /* -------------------------------------------------------------------- AI */
  res = await fetch(`${BASE}/api/ai/summarize`, json("POST", { leadId: createdId }));
  const summary = await res.json();
  check(
    "AI: structured summary",
    res.status === 200 && Boolean(summary.summary?.recall) && Boolean(summary.summary?.temperature),
    `temp=${summary.summary?.temperature} model=${summary.model}`,
  );
  check("AI: returns interests", Array.isArray(summary.summary?.interests) && summary.summary.interests.length > 0, JSON.stringify(summary.summary?.interests ?? []));
  check("AI: no sentence-start junk", !(summary.summary?.interests ?? []).some((i) => /^(said|wants|asked|needs)$/i.test(i)), JSON.stringify(summary.summary?.interests ?? []));

  res = await fetch(`${BASE}/api/ai/summarize`, json("POST", { leadId: createdId }));
  const cached = await res.json();
  check("AI: summary is cached", cached.cached === true);

  res = await fetch(`${BASE}/api/ai/draft`, json("POST", { leadId: createdId, channel: "EMAIL" }));
  const draft = await res.text();
  check("AI: draft streams", res.status === 200 && draft.length > 80 && draft.includes("Hi Zoe"), `len=${draft.length}`);
  console.log("--- draft ---\n" + draft.trim() + "\n-------------");

  const thin = await (await fetch(`${BASE}/api/leads`, json("POST", { name: "Thin", notes: "short", eventId }))).json();
  if (thin.lead?.id) cleanupIds.push(thin.lead.id);
  res = await fetch(`${BASE}/api/ai/summarize`, json("POST", { leadId: thin.lead.id }));
  check("AI: refuses thin notes", res.status === 422, `status=${res.status}`);

  /* ---------------------------------------------------------- delete/undo */
  res = await fetch(`${BASE}/api/leads/${createdId}`, { method: "DELETE" });
  check("deletes a lead", res.status === 204, `status=${res.status}`);

  res = await fetch(`${BASE}/api/leads/${createdId}`);
  check("404 after delete", res.status === 404, `status=${res.status}`);

  res = await fetch(`${BASE}/api/leads/restore`, json("POST", {
    ...edited,
    id: createdId,
    createdAt: new Date().toISOString(),
    followUps: [{ channel: "EMAIL", direction: "OUT", body: "Sent the pricing one-pager.", sentAt: new Date().toISOString() }],
  }));
  const restored = await res.json();
  check("undo restores record with history", res.status === 200 && restored.lead?.followUpCount === 1, `fus=${restored.lead?.followUpCount}`);

  /* ---------------------------------------------------------------- export */
  res = await fetch(`${BASE}/api/export`);
  const csv = await res.text();
  check("CSV export", res.status === 200 && csv.startsWith('"Name"') && csv.split("\r\n").length > 40, `rows=${csv.split("\r\n").length}`);

  /* --------------------------------------------------------------- cleanup */
  const before = (await (await fetch(`${BASE}/api/leads?limit=1`)).json()).total;
  for (const id of [createdId, ...cleanupIds]) {
    if (id) await fetch(`${BASE}/api/leads/${id}`, { method: "DELETE" });
  }
  const after = (await (await fetch(`${BASE}/api/leads?limit=1`)).json()).total;
  check("leaves the database as it found it", after === before - cleanupIds.length - 1, `${before} → ${after}`);

  console.log(failures === 0 ? "\nALL API CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("THREW", err);
  process.exit(1);
});
