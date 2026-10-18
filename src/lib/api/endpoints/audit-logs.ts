import { getPage } from "../client";
import type { AuditLogEntry, AuditLogFilters } from "../types";

export const listAuditLogs = (filters: AuditLogFilters, signal?: AbortSignal) =>
  getPage<AuditLogEntry>("/audit-logs", filters, signal);
