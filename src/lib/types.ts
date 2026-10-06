import type { Channel, Direction, LeadStatus, Temperature } from "@/lib/statuses";

export type EventDTO = {
  id: string;
  name: string;
  location: string | null;
  startsAt: string;
  endsAt: string;
  accent: string;
  leadCount?: number;
  statusMix?: Record<LeadStatus, number>;
};

export type AiSummary = {
  recall: string;
  interests: string[];
  signals: string[];
  nextStep: string;
  temperature: Temperature;
};

export type FollowUpDTO = {
  id: string;
  channel: Channel;
  direction: Direction;
  body: string;
  sentAt: string;
};

export type LeadDTO = {
  id: string;
  name: string;
  company: string | null;
  title: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  notes: string;
  status: LeadStatus;
  temperature: Temperature | null;
  tags: string[];
  event: { id: string; name: string; accent: string; startsAt: string };
  nextFollowUpAt: string | null;
  lastContactedAt: string | null;
  createdAt: string;
  updatedAt: string;
  aiSummary: AiSummary | null;
  aiGeneratedAt: string | null;
  aiModel: string | null;
  followUpCount: number;
  due: "overdue" | "today" | "upcoming" | "none";
};

export type LeadListResponse = {
  items: LeadDTO[];
  total: number;
  hasMore: boolean;
};

export type StatsDTO = {
  total: number;
  dueToday: number;
  overdue: number;
  hot: number;
  awaitingReply: number;
  won: number;
  last7: number;
  byStatus: Record<LeadStatus, number>;
  recent: LeadDTO[];
};

export type AiAvailability = "live" | "mock" | "off";
