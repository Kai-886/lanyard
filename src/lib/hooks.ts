"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import { api, qs, RequestError } from "@/lib/api";
import type { SearchFilters } from "@/lib/validation";
import type {
  AiAvailability,
  EventDTO,
  FollowUpDTO,
  LeadDTO,
  LeadListResponse,
  StatsDTO,
} from "@/lib/types";

const K = {
  leads: (f: SearchFilters) => ["leads", f] as const,
  lead: (id: string) => ["lead", id] as const,
  events: () => ["events"] as const,
  stats: () => ["stats"] as const,
  followUps: (id: string) => ["follow-ups", id] as const,
  aiStatus: () => ["ai-status"] as const,
};

export function useLeads(filters: SearchFilters): UseQueryResult<LeadListResponse> {
  return useQuery({
    queryKey: K.leads(filters),
    queryFn: () => api.get<LeadListResponse>(`/api/leads${qs(filters as Record<string, unknown>)}`),
    placeholderData: (prev) => prev,
  });
}

export function useLead(id: string) {
  return useQuery({
    queryKey: K.lead(id),
    queryFn: () => api.get<{ lead: LeadDTO }>(`/api/leads/${id}`).then((r) => r.lead),
    enabled: Boolean(id),
  });
}

export function useEvents() {
  return useQuery({
    queryKey: K.events(),
    queryFn: () => api.get<{ items: EventDTO[] }>("/api/events").then((r) => r.items),
  });
}

export function useStats() {
  return useQuery({ queryKey: K.stats(), queryFn: () => api.get<StatsDTO>("/api/stats") });
}

export function useFollowUps(id: string) {
  return useQuery({
    queryKey: K.followUps(id),
    queryFn: () =>
      api
        .get<{ items: FollowUpDTO[] }>(`/api/leads/${id}/followups`)
        .then((r) => r.items),
    enabled: Boolean(id),
  });
}

export function useTags() {
  return useQuery({
    queryKey: ["tags"] as const,
    queryFn: () =>
      api
        .get<{ items: { tag: string; count: number }[] }>("/api/tags")
        .then((r) => r.items),
    staleTime: 60_000,
  });
}

export function useAiStatus() {
  return useQuery({
    queryKey: K.aiStatus(),
    queryFn: () =>
      api.get<{ availability: AiAvailability; calls: number; recent: unknown[] }>(
        "/api/ai/status",
      ),
    staleTime: 60_000,
  });
}

export function useInvalidate(...keys: string[][]) {
  const qc = useQueryClient();
  return () => {
    for (const key of keys) void qc.invalidateQueries({ queryKey: key });
  };
}

export function useDeleteLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<void>(`/api/leads/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["leads"] });
      void qc.invalidateQueries({ queryKey: ["stats"] });
    },
  });
}

export { RequestError };
