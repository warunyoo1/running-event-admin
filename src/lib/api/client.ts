import { API_BASE } from "../constants";
import { ApiError, isAbortError } from "./errors";
import { buildQuery } from "./query";
import type { PageMeta, Paginated, Query } from "./types";

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
type RequestOptions = { query?: Query; body?: unknown; signal?: AbortSignal };
type ErrorBody = {
  error?: { code?: string; message?: string; fields?: Record<string, string> };
};

const LOGIN_PATH = "/auth/login";
let unauthorizedHandler: (() => void) | null = null;
let unauthorizedHandled = false;

/** Registered by the auth provider; fired at most once until the next login. */
export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}
export function resetUnauthorized() {
  unauthorizedHandled = false;
}

async function toApiError(res: Response): Promise<ApiError> {
  const body = (await res.json().catch(() => null)) as ErrorBody | null;
  const error = body?.error;
  if (!error) return new ApiError(res.status, `HTTP_${res.status}`, res.statusText);
  return new ApiError(
    res.status,
    error.code ?? `HTTP_${res.status}`,
    error.message ?? res.statusText,
    error.fields ?? {},
  );
}

/** Shared by JSON and CSV calls: network, non-2xx and 401 handling. */
async function send(
  method: Method,
  path: string,
  { query, body, signal }: RequestOptions = {},
): Promise<Response> {
  const headers: Record<string, string> = {};
  let payload: BodyInit | undefined;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}${buildQuery(query)}`, {
      method,
      headers,
      body: payload,
      signal,
      credentials: "same-origin",
    });
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw new ApiError(0, "NETWORK_ERROR", "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
  }
  if (res.ok) return res;
  const apiError = await toApiError(res);
  if (res.status === 401 && path !== LOGIN_PATH && !unauthorizedHandled) {
    unauthorizedHandled = true;
    unauthorizedHandler?.();
  }
  throw apiError;
}

export async function request<T>(
  method: Method,
  path: string,
  options?: RequestOptions,
): Promise<{ data: T; meta?: PageMeta }> {
  const res = await send(method, path, options);
  if (res.status === 204) return { data: undefined as T };
  return (await res.json()) as { data: T; meta?: PageMeta };
}

export async function get<T>(path: string, query?: Query, signal?: AbortSignal) {
  return (await request<T>("GET", path, { query, signal })).data;
}

export async function getPage<T>(
  path: string,
  query?: Query,
  signal?: AbortSignal,
): Promise<Paginated<T>> {
  const { data, meta } = await request<T[]>("GET", path, { query, signal });
  if (!meta) throw new ApiError(0, "BAD_RESPONSE", "ข้อมูลจากเซิร์ฟเวอร์ไม่ถูกต้อง");
  return { data, meta };
}

export async function mutate<T>(
  method: Exclude<Method, "GET">,
  path: string,
  body?: unknown,
): Promise<T> {
  return (await request<T>(method, path, { body })).data;
}

function filenameFrom(res: Response, fallback: string): string {
  const header = res.headers.get("Content-Disposition") ?? "";
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(header);
  return match ? decodeURIComponent(match[1]) : fallback;
}

/** Downloads a CSV; returns the data row count so callers can warn on truncation. */
export async function downloadCsv(
  path: string,
  query: Query,
  fallbackName: string,
): Promise<{ rows: number }> {
  const res = await send("GET", path, { query });
  const blob = await res.blob();
  const text = await blob.text();
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "").length;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filenameFrom(res, fallbackName);
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { rows: Math.max(lines - 1, 0) };
}
