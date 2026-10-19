import { get, getPage, mutate } from "../client";
import type {
  AdminEvent,
  EventBody,
  EventCategory,
  EventStatus,
  EventTheme,
  PageQuery,
} from "../types";

export type EventFilters = PageQuery & {
  q?: string;
  status?: EventStatus | "";
  /** `true` lists archived events; the API default is active events only. */
  archived?: boolean;
};

export const listEvents = (filters: EventFilters, signal?: AbortSignal) =>
  getPage<AdminEvent>("/events", filters, signal);
export const getEvent = (id: string, signal?: AbortSignal) =>
  get<AdminEvent>(`/events/${id}`, undefined, signal);
export const createEvent = (body: EventBody) => mutate<AdminEvent>("POST", "/events", body);
export const updateEvent = (id: string, body: EventBody) =>
  mutate<AdminEvent>("PUT", `/events/${id}`, body);
export const archiveEvent = (id: string) =>
  mutate<AdminEvent>("POST", `/events/${id}/archive`);
export const restoreEvent = (id: string) =>
  mutate<AdminEvent>("POST", `/events/${id}/restore`);
/** Hard delete; the API refuses (409 EVENT_HAS_ORDERS) when the event has any order. */
export const deleteEvent = (id: string) => mutate<null>("DELETE", `/events/${id}`);

export type EventForm = {
  name: string;
  slug: string;
  subtitle: string;
  description: string;
  contactPhones: string[];
  websiteUrl: string;
  locationUrl: string;
  shirtPickupUrl: string;
  date: string;
  venue: string;
  startPoint: string;
  shirtPickupPoint: string;
  province: string;
  category: EventCategory | "";
  theme: EventTheme | "";
  status: EventStatus;
  registrationStarts: string;
  registrationEnds: string;
  organizer: string;
  refundPolicy: string;
  races: { id?: string; name: string; price: string; quota: string; unlimitedQuota: boolean; start: string; benefits: string[]; extraDetails: string; prizes: { rank: string; amount: string; trophy: boolean }[] }[];
};

/**
 * Typed optionals (category, theme, registrationEnds, race start) are sent as
 * `null` when empty so PUT clears them (category/theme fall back to the API
 * defaults; the API ignores nulls on create). Plain strings are sent trimmed
 * so '' clears them.
 */
export function toEventBody(form: EventForm): EventBody {
  const body: EventBody = {
    name: form.name.trim(),
    slug: form.slug.trim().toLowerCase(),
    subtitle: form.subtitle.trim(),
    description: form.description.trim(),
    websiteUrl: form.websiteUrl.trim(),
    locationUrl: form.locationUrl.trim(),
    shirtPickupUrl: form.shirtPickupUrl.trim(),
    contactPhones: form.contactPhones.map((phone) => phone.trim()).filter(Boolean),
    date: form.date,
    venue: form.venue.trim(),
    startPoint: form.startPoint.trim(),
    shirtPickupPoint: form.shirtPickupPoint.trim(),
    province: form.province.trim(),
    status: form.status,
    organizer: form.organizer.trim(),
    refundPolicy: form.refundPolicy.trim(),
    races: form.races.map((race) => ({
      ...(race.id ? { id: race.id } : {}),
      name: race.name.trim(),
      price: Number(race.price),
      quota: race.unlimitedQuota ? 1 : Number(race.quota),
      unlimitedQuota: race.unlimitedQuota,
      start: race.start || null,
      benefits: race.benefits.map((value) => value.trim()).filter(Boolean),
      extraDetails: race.extraDetails.trim(),
      prizes: race.prizes.map((prize) => ({ rank: Number(prize.rank), amount: Number(prize.amount), trophy: prize.trophy })),
    })),
    category: form.category || null,
    theme: form.theme || null,
    registrationStarts: form.registrationStarts || null,
    registrationEnds: form.registrationEnds || null,
  };
  return body;
}
