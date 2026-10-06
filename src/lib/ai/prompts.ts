import { z } from "zod";
import type { Channel } from "@/lib/statuses";

export const summarySchema = z.object({
  recall: z
    .string()
    .describe("60 words or fewer, first person, as if recalling the conversation from memory."),
  interests: z
    .array(z.string())
    .describe("2-5 concrete interests or topics discussed, each 2-4 words."),
  signals: z
    .array(z.string())
    .describe("Buying or pain signals found in the notes, anchored to what was actually said."),
  nextStep: z.string().describe("One concrete next action, 20 words or fewer."),
  temperature: z.enum(["hot", "warm", "cold"]).describe("Overall buying temperature."),
});

export type Summary = z.infer<typeof summarySchema>;

export const SUMMARIZE_SYSTEM = `You compress messy conference notes into working memory.
Rules:
- Use ONLY facts present in the notes. Never invent names, numbers, products or promises.
- Write like a person recalling a conversation, not like a CRM field.
- No bullet-point filler, no corporate hedging, no "the individual expressed interest in".`;

export const DRAFT_SYSTEM = `You write follow-up messages that sound like the sender, not like marketing.
Rules:
- Use ONLY facts in the notes and summary. Never fabricate specifics, outcomes, attachments or meetings.
- No "I hope this email finds you well", no "circling back", no exclamation marks, no emoji.
- Reference one specific thing from the conversation to prove it is not a template.
- Sign off with the sender's first name only, no title, no legal footer.
- Email: 90-120 words. LinkedIn: 40-60 words. SMS: 160-200 characters, casual.
- Output the message body only. No subject line, no preamble, no quotation marks.`;

export const CHANNEL_SHAPE: Record<Channel | "SMS", string> = {
  EMAIL: "a professional email body",
  LINKEDIN: "a LinkedIn connection follow-up message",
  CALL: "a short call-opening script",
  NOTE: "an internal note",
  SMS: "a text message",
};

export function summarizeUserPrompt(input: {
  name: string;
  company?: string | null;
  title?: string | null;
  event: string;
  notes: string;
}) {
  return [
    `Name: ${input.name}`,
    input.title || input.company
      ? `Role: ${[input.title, input.company].filter(Boolean).join(" at ")}`
      : null,
    `Met at: ${input.event}`,
    ``,
    `Raw notes:`,
    input.notes,
  ]
    .filter((line) => line !== null)
    .join("\n");
}

export function draftUserPrompt(input: {
  name: string;
  company?: string | null;
  title?: string | null;
  event: string;
  notes: string;
  summary?: string | null;
  channel: Channel | "SMS";
}) {
  return [
    `Write ${CHANNEL_SHAPE[input.channel]} from me to ${input.name}`,
    input.title || input.company
      ? `(${[input.title, input.company].filter(Boolean).join(" at ")})`
      : null,
    `We met at ${input.event}.`,
    ``,
    input.summary ? `What we talked about (my own summary):\n${input.summary}\n` : ``,
    `Raw notes:\n${input.notes}`,
  ]
    .filter((line) => line !== null)
    .join("\n");
}
