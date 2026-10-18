import { get, mutate } from "../client";
import type { EventImage, EventImageKind, ImagePatchBody } from "../types";

export const listImages = (eventId: string, signal?: AbortSignal) =>
  get<EventImage[]>(`/events/${eventId}/images`, undefined, signal);

/**
 * One file per request so each file gets its own kind/alt result and error.
 * The body is FormData: `client.ts` leaves Content-Type to the browser (multipart boundary).
 */
export function uploadImage(
  eventId: string,
  file: File,
  kind: EventImageKind,
  alt: string,
) {
  const body = new FormData();
  body.append("files", file);
  body.append("kind", kind);
  if (alt) body.append("alt", alt);
  return mutate<EventImage[]>("POST", `/events/${eventId}/images`, body);
}

export const patchImage = (eventId: string, imageId: string, patch: ImagePatchBody) =>
  mutate<EventImage>("PATCH", `/events/${eventId}/images/${imageId}`, patch);

export const reorderImages = (eventId: string, ids: string[]) =>
  mutate<EventImage[]>("PUT", `/events/${eventId}/images/order`, { ids });

export const deleteImage = (eventId: string, imageId: string) =>
  mutate<null>("DELETE", `/events/${eventId}/images/${imageId}`);
