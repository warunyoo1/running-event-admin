import type { Role } from "@/lib/api/types";

export const canWrite = (role: Role) => role === "super_admin" || role === "reviewer";
export const isSuper = (role: Role) => role === "super_admin";
