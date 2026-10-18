import { get, getPage, mutate } from "../client";
import type { AddressBody, AdminOrderRow, OrderDetail, OrderStatus, PageQuery, TrackingBody } from "../types";

export type OrderFilters = PageQuery & {
  eventId?: string;
  status?: OrderStatus | "";
  q?: string;
  from?: string;
  to?: string;
};

export const listOrders = (filters: OrderFilters, signal?: AbortSignal) =>
  getPage<AdminOrderRow>("/orders", filters, signal);
export const getOrder = (id: string, signal?: AbortSignal) =>
  get<OrderDetail>(`/orders/${id}`, undefined, signal);
export const cancelOrder = (id: string, reason?: string) =>
  mutate<OrderDetail>("POST", `/orders/${id}/cancel`, { reason: reason || undefined });
export const approveOrder = (id: string, transactionRef: string) =>
  mutate<OrderDetail>("POST", `/orders/${id}/approve`, { transactionRef });
export const rejectOrder = (id: string, reason: string) =>
  mutate<OrderDetail>("POST", `/orders/${id}/reject`, { reason });
export const setTracking = (id: string, body: TrackingBody) =>
  mutate<OrderDetail>("PATCH", `/orders/${id}/tracking`, body);
export const addNote = (id: string, text: string) =>
  mutate<OrderDetail>("POST", `/orders/${id}/notes`, { text });
export const deleteNote = (id: string, noteId: string) =>
  mutate<OrderDetail>("DELETE", `/orders/${id}/notes/${noteId}`);
export const updateAddress = (id: string, body: AddressBody) =>
  mutate<OrderDetail>("PATCH", `/orders/${id}/address`, body);
