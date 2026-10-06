export const LEAD_STATUSES = [
  "NEW",
  "CONTACTED",
  "REPLIED",
  "QUALIFIED",
  "WON",
  "LOST",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const TEMPERATURES = ["hot", "warm", "cold"] as const;
export type Temperature = (typeof TEMPERATURES)[number];

export const CHANNELS = ["EMAIL", "LINKEDIN", "CALL", "NOTE"] as const;
export type Channel = (typeof CHANNELS)[number];

export const DIRECTIONS = ["OUT", "IN"] as const;
export type Direction = (typeof DIRECTIONS)[number];

type Meta = {
  label: string;
  /** 6px holder-tab colour on the badge edge. */
  tab: string;
  /** Text + border colour for the chip. */
  ink: string;
  /** Soft chip background. */
  wash: string;
  key: string;
};

export const STATUS_META: Record<LeadStatus, Meta> = {
  NEW: { label: "New", tab: "#5B564C", ink: "#4A463D", wash: "#E4DFD3", key: "1" },
  CONTACTED: { label: "Contacted", tab: "#2F5FE0", ink: "#1D3F9E", wash: "#DFE6FB", key: "2" },
  REPLIED: { label: "Replied", tab: "#0B6E4F", ink: "#08543C", wash: "#DAEFE6", key: "3" },
  QUALIFIED: { label: "Qualified", tab: "#7A4BD1", ink: "#5B36A6", wash: "#EAE2FA", key: "4" },
  WON: { label: "Won", tab: "#0B6E4F", ink: "#08543C", wash: "#D5EFE3", key: "5" },
  LOST: { label: "Lost", tab: "#B3261E", ink: "#8E1F19", wash: "#F8DFDD", key: "6" },
};

export const CHANNEL_META: Record<Channel, { label: string; icon: string }> = {
  EMAIL: { label: "Email", icon: "mail" },
  LINKEDIN: { label: "LinkedIn", icon: "linkedin" },
  CALL: { label: "Call", icon: "phone" },
  NOTE: { label: "Note", icon: "sticky-note" },
};

export function isStatus(v: unknown): v is LeadStatus {
  return typeof v === "string" && (LEAD_STATUSES as readonly string[]).includes(v);
}

export function statusMeta(v: string | null | undefined): Meta {
  return STATUS_META[isStatus(v) ? v : "NEW"];
}
