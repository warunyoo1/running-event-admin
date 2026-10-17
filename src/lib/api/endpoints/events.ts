import { get, getPage, mutate } from "../client";
import type {
  AdminEvent,
  EventBody,
  EventCategory,
  EventStatus,
  EventTheme,
  PageQuery,
} from "../types";

export type EventFilters = PageQuery & { q?: string; status?: EventStatus | "" };

export const listEvents = (filters: EventFilters, signal?: AbortSignal) =>
  getPage<AdminEvent>("/events", filters, signal);
export const getEvent = (id: string, signal?: AbortSignal) =>
  get<AdminEvent>(`/events/${id}`, undefined, signal);
export const createEvent = (body: EventBody) => mutate<AdminEvent>("POST", "/events", body);
export const updateEvent = (id: string, body: EventBody) =>
  mutate<AdminEvent>("PUT", `/events/${id}`, body);

export type EventForm = {
  name: string;
  slug: string;
  subtitle: string;
  description: string;
  date: string;
  venue: string;
  province: string;
  category: EventCategory | "";
  theme: EventTheme | "";
  status: EventStatus;
  registrationEnds: string;
  organizer: string;
  refundPolicy: string;
  races: { id?: string; name: string; price: string; quota: string; start: string }[];
};

/**
 * PUT `$set`s the provided fields. Typed optionals (category, theme,
 * registrationEnds, race start) are omitted when empty because they cannot be
 * cleared; plain strings are sent trimmed so '' clears them.
 */
export function toEventBody(form: EventForm): EventBody {
  const body: EventBody = {
    name: form.name.trim(),
    slug: form.slug.trim().toLowerCase(),
    subtitle: form.subtitle.trim(),
    description: form.description.trim(),
    date: form.date,
    venue: form.venue.trim(),
    province: form.province.trim(),
    status: form.status,
    organizer: form.organizer.trim(),
    refundPolicy: form.refundPolicy.trim(),
    races: form.races.map((race) => ({
      ...(race.id ? { id: race.id } : {}),
      name: race.name.trim(),
      price: Number(race.price),
      quota: Number(race.quota),
      ...(race.start ? { start: race.start } : {}),
    })),
  };
  if (form.category) body.category = form.category;
  if (form.theme) body.theme = form.theme;
  if (form.registrationEnds) body.registrationEnds = form.registrationEnds;
  return body;
}
