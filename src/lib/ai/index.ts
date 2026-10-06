import { createHash } from "node:crypto";
import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import { generateObject, generateText, streamText } from "ai";
import { db } from "@/lib/db";
import { aiAvailability, env } from "@/lib/env";
import { mockDraft, mockSummary } from "@/lib/ai/mock";
import {
  DRAFT_SYSTEM,
  SUMMARIZE_SYSTEM,
  draftUserPrompt,
  summarizeUserPrompt,
  summarySchema,
  type Summary,
} from "@/lib/ai/prompts";
import type { Channel } from "@/lib/statuses";

export type AiLeadContext = {
  id: string;
  name: string;
  company: string | null;
  title: string | null;
  notes: string;
  eventName: string;
  tags: string[];
};

export class AiNotConfiguredError extends Error {
  constructor() {
    super("AI is not configured. Add AI_API_KEY in settings to enable it.");
  }
}

export class AiRateLimitError extends Error {
  constructor() {
    super("Too many AI requests in the last minute. Try again shortly.");
  }
}

function languageModel() {
  switch (env.aiProvider) {
    case "anthropic":
      return anthropic(env.aiModel);
    case "google":
      return google(env.aiModel);
    default:
      return openai(env.aiModel);
  }
}

function hash(...parts: string[]): string {
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 32);
}

/* ------------------------------------------------------------- rate limit */

const buckets = new Map<string, number[]>();

export function checkRateLimit(ip: string): void {
  const now = Date.now();
  const windowMs = 60_000;
  const recent = (buckets.get(ip) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= env.aiRateLimit) {
    buckets.set(ip, recent);
    throw new AiRateLimitError();
  }
  recent.push(now);
  buckets.set(ip, recent);
}

async function logCall(input: {
  leadId?: string;
  kind: string;
  model: string;
  promptHash: string;
  tokensIn?: number;
  tokensOut?: number;
  latencyMs: number;
  cached: boolean;
}) {
  try {
    await db.aiCall.create({ data: { ...input, leadId: input.leadId ?? null } });
  } catch (err) {
    console.error("[ai] failed to record usage", err);
  }
}

/* -------------------------------------------------------------- summarize */

type SummarizeResult = { summary: Summary; cached: boolean; model: string };

export async function summarizeLead(
  lead: AiLeadContext,
  ip: string,
): Promise<SummarizeResult> {
  const mode = aiAvailability();
  const model = mode === "live" ? env.aiModel : "lanyard-demo";
  const prompt = summarizeUserPrompt({
    name: lead.name,
    company: lead.company,
    title: lead.title,
    event: lead.eventName,
    notes: lead.notes,
  });
  const key = hash(model, "summarize", prompt);

  // Cache hit — recorded as cached, never re-billed.
  if (lead.notes.length >= 15) {
    const existing = await db.lead.findUnique({
      where: { id: lead.id },
      select: { aiSummaryHash: true, aiSummary: true },
    });
    if (existing?.aiSummary && existing.aiSummaryHash === key) {
      try {
        const parsed = summarySchema.parse(JSON.parse(existing.aiSummary));
        await logCall({
          leadId: lead.id, kind: "summarize", model, promptHash: key,
          latencyMs: 0, cached: true,
        });
        return { summary: parsed, cached: true, model };
      } catch {
        /* stale/corrupt cache — regenerate */
      }
    }
  }

  checkRateLimit(ip);

  const started = Date.now();
  let summary: Summary;

  if (mode === "off") throw new AiNotConfiguredError();

  if (mode === "mock") {
    summary = mockSummary({ notes: lead.notes, tags: lead.tags });
  } else {
    summary = await generateSummary(prompt);
  }

  const latencyMs = Date.now() - started;

  if (lead.notes.length >= 15) {
    await db.lead.update({
      where: { id: lead.id },
      data: {
        aiSummary: JSON.stringify(summary),
        aiSummaryHash: key,
        aiModel: model,
        aiGeneratedAt: new Date(),
        temperature: summary.temperature,
      },
    });
  }

  await logCall({
    leadId: lead.id, kind: "summarize", model, promptHash: key, latencyMs, cached: false,
  });

  return { summary, cached: false, model };
}

/** generateObject, with a plain-text JSON fallback if the structured path rejects. */
async function generateSummary(prompt: string): Promise<Summary> {
  try {
    const r = await generateObject({
      model: languageModel(),
      system: SUMMARIZE_SYSTEM,
      prompt,
      schema: summarySchema,
      temperature: 0.2,
    });
    return summarySchema.parse(r.object);
  } catch (primary) {
    console.warn("[ai] generateObject failed, falling back to text", primary);
    const r = await generateText({
      model: languageModel(),
      system: `${SUMMARIZE_SYSTEM}\nRespond with a single JSON object and nothing else.`,
      prompt,
      temperature: 0.2,
    });
    const start = r.text.indexOf("{");
    const end = r.text.lastIndexOf("}");
    if (start === -1 || end === -1) throw new Error("Model returned no JSON object");
    return summarySchema.parse(JSON.parse(r.text.slice(start, end + 1)));
  }
}

/* ------------------------------------------------------------------ draft */

export async function draftFollowUp(
  lead: AiLeadContext,
  channel: Channel | "SMS",
  ip: string,
): Promise<{ text: string; stream: ReadableStream<string> }> {
  const mode = aiAvailability();
  checkRateLimit(ip);

  const summary = lead.notes.length >= 15 ? mockSummary({ notes: lead.notes, tags: lead.tags }) : null;
  const prompt = draftUserPrompt({
    name: lead.name,
    company: lead.company,
    title: lead.title,
    event: lead.eventName,
    notes: lead.notes,
    summary: summary?.recall ?? null,
    channel,
  });

  const signature = env.senderName;

  if (mode === "off") throw new AiNotConfiguredError();

  if (mode === "mock") {
    const mockChannel = channel === "SMS" ? "SMS" : channel === "LINKEDIN" ? "LINKEDIN" : "EMAIL";
    const text = mockDraft({
      name: lead.name,
      event: lead.eventName,
      summary: summary ?? mockSummary({ notes: lead.notes, tags: lead.tags }),
      channel: mockChannel,
      signature,
    });
    const model = "lanyard-demo";
    void logCall({
      leadId: lead.id, kind: "draft", model,
      promptHash: hash(model, "draft", prompt), latencyMs: 0, cached: false,
    });
    return { text, stream: textToStream(text) };
  }

  const model = env.aiModel;
  const started = Date.now();

  const result = streamText({
    model: languageModel(),
    system: DRAFT_SYSTEM,
    prompt,
    temperature: 0.6,
  });

  // Tee the stream: the client gets one half, usage logging gets the other.
  const [forClient, forLog] = result.textStream.tee();

  void (async () => {
    let text = "";
    try {
      const reader = forLog.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        text += value;
      }
      await logCall({
        leadId: lead.id,
        kind: "draft",
        model,
        promptHash: hash(model, "draft", prompt),
        latencyMs: Date.now() - started,
        cached: false,
      });
    } catch (err) {
      console.error("[ai] draft stream failed", err);
    }
    void text;
  })();

  return { text: "", stream: forClient };
}

/** Chunk a completed string into a slow-ish stream so the UI can animate it. */
export function textToStream(
  text: string,
  chunkSize = 3,
  delayMs = 16,
): ReadableStream<string> {
  let i = 0;
  return new ReadableStream<string>({
    async pull(controller) {
      if (i >= text.length) {
        controller.close();
        return;
      }
      await new Promise((r) => setTimeout(r, delayMs));
      controller.enqueue(text.slice(i, i + chunkSize));
      i += chunkSize;
    },
  });
}
