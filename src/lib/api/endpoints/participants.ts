import { getPage, mutate } from "../client";
import type { OrderStatus, PageQuery, ParticipantPatch, ParticipantRow } from "../types";

export type ParticipantFilters = PageQuery & {
  eventId?: string;
  q?: string;
  race?: string;
  status?: OrderStatus | "";
};

export const listParticipants = (filters: ParticipantFilters, signal?: AbortSignal) =>
  getPage<ParticipantRow>("/participants", filters, signal);
export const patchParticipant = (id: string, body: ParticipantPatch) =>
  mutate<ParticipantRow>("PATCH", `/participants/${id}`, body);
