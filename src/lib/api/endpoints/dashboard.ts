import { get } from "../client";
import type { DashboardData } from "../types";

export const getDashboard = (eventId?: string, signal?: AbortSignal) =>
  get<DashboardData>("/dashboard", { eventId }, signal);
