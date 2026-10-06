import { z } from "zod";
import { CHANNELS, DIRECTIONS, LEAD_STATUSES, TEMPERATURES } from "./statuses";

const nullableText = (max: number) =>
  z
    .string()
    .max(max, `Max ${max} characters`)
    .transform((v) => (v.trim() === "" ? null : v.trim()))
    .nullable()
    .optional();

/**
 * Input and output types must be structurally identical so the same schema can
 * drive react-hook-form and API validation without generics gymnastics — hence
 * `.optional()` rather than `.default()`.
 */
export const leadInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  company: nullableText(120),
  title: nullableText(120),
  email: z
    .union([z.email("Enter a valid email"), z.literal(""), z.null()])
    .transform((v) => (v === "" || v === null ? null : v))
    .optional()
    .nullable(),
  phone: nullableText(40),
  source: nullableText(60),
  notes: z.string().max(8000).optional(),
  status: z.enum(LEAD_STATUSES).optional(),
  temperature: z.enum(TEMPERATURES).nullable().optional(),
  eventId: z.string().min(1, "Pick an event"),
  tags: z.array(z.string().trim().min(1).max(32)).max(12).optional(),
  nextFollowUpAt: z.iso.date().nullable().optional(),
});

export type LeadInput = z.infer<typeof leadInputSchema>;

export const eventInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  location: nullableText(120),
  startsAt: z.iso.date(),
  endsAt: z.iso.date(),
  accent: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Hex colour, e.g. #FF4D00")
    .default("#FF4D00"),
});

export type EventInput = z.infer<typeof eventInputSchema>;

export const followUpInputSchema = z.object({
  channel: z.enum(CHANNELS),
  direction: z.enum(DIRECTIONS),
  body: z.string().trim().min(1, "Write something").max(4000),
  sentAt: z.iso.date().optional(),
});

export const bulkActionSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(500),
  action: z.enum(["status", "event", "delete", "export"]),
  value: z.string().optional(),
});

export const searchFiltersSchema = z.object({
  q: z.string().max(200).optional(),
  status: z.array(z.enum(LEAD_STATUSES)).optional(),
  event: z.array(z.string()).optional(),
  tag: z.array(z.string()).optional(),
  due: z.enum(["today", "overdue", "uncontacted", "has-email", "none"]).optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  sort: z.enum(["updated", "name", "event", "due", "temperature"]).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export type SearchFilters = z.infer<typeof searchFiltersSchema>;

export const aiSummarizeSchema = z.object({ leadId: z.string().min(1) });
export const aiDraftSchema = z.object({
  leadId: z.string().min(1),
  channel: z.enum(["EMAIL", "LINKEDIN", "SMS"]),
});
