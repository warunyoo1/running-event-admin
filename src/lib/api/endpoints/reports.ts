import { get } from "../client";
import type { OrderStatus, ReportSummary, ShirtSizeReport } from "../types";

export const getReportSummary = (
  query: { eventId?: string; from?: string; to?: string },
  signal?: AbortSignal,
) => get<ReportSummary>("/reports/summary", query, signal);
export const getShirtSizes = (
  query: { eventId?: string; status?: OrderStatus },
  signal?: AbortSignal,
) => get<ShirtSizeReport>("/reports/shirt-sizes", query, signal);
