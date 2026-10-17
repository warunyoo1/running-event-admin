import { getPage } from "../client";
import type { PageQuery, ShippingMethod, ShippingRow } from "../types";

export type ShippingFilters = PageQuery & { eventId?: string; method: ShippingMethod };

export const listShipping = (filters: ShippingFilters, signal?: AbortSignal) =>
  getPage<ShippingRow>("/shipping", filters, signal);
