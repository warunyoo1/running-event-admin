import { downloadCsv } from "../client";
import type { OrderStatus, ShippingMethod } from "../types";

export const exportOrdersCsv = (query: {
  eventId?: string;
  status?: OrderStatus | "";
  q?: string;
  from?: string;
  to?: string;
}) => downloadCsv("/export/orders.csv", query, "orders.csv");
export const exportParticipantsCsv = (query: {
  eventId?: string;
  q?: string;
  race?: string;
  status?: OrderStatus | "";
}) => downloadCsv("/export/participants.csv", query, "participants.csv");
export const exportFulfillmentCsv = (query: { eventId?: string; method?: ShippingMethod }) =>
  downloadCsv("/export/fulfillment.csv", query, "fulfillment.csv");
