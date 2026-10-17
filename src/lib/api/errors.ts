export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields: Record<string, string> = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const UNKNOWN_ERROR_MESSAGE = "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง";

/** Field errors keyed by the API's dotted path (e.g. `races.0.quota`). */
export function fieldErrorsFor(error: unknown): Record<string, string> {
  return error instanceof ApiError ? error.fields : {};
}

/** Form-level message; empty when the error is fully explained by field errors. */
export function formMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return UNKNOWN_ERROR_MESSAGE;
  return Object.keys(error.fields).length > 0 ? "" : error.message;
}

/** Message suitable for toasts and page-level error states. */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : UNKNOWN_ERROR_MESSAGE;
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
