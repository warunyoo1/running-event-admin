import { API_BASE } from "../../constants";
import { getPage } from "../client";
import type { PageQuery, SlipRow, SlipTab } from "../types";

export type SlipFilters = PageQuery & { eventId?: string; tab: SlipTab };

export const listSlips = (filters: SlipFilters, signal?: AbortSignal) =>
  getPage<SlipRow>("/slips", filters, signal);
/** Same-origin URL for an <img>; the auth cookie is sent automatically. */
export const slipImageUrl = (paymentId: string) => `${API_BASE}/payments/${paymentId}/slip`;
