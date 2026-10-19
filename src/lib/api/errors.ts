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

export const UNKNOWN_ERROR_MESSAGE = "เกิดข้อผิดพลาด กรุณาลองอีกครั้ง ถ้ายังไม่หายให้แจ้งผู้ดูแลระบบ";

/** Field errors keyed by the API's dotted path (e.g. `races.0.quota`). */
export function fieldErrorsFor(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError)) return {};
  // The API sends 409 SLUG_TAKEN without `fields`; attach it to the slug input.
  if (error.code === "SLUG_TAKEN") return { ...error.fields, slug: "ลิงก์นี้มีงานอื่นใช้อยู่แล้ว ลองเปลี่ยนชื่อลิงก์" };
  return error.fields;
}

/** Form-level message; empty when the error is fully explained by field errors. */
export function formMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return UNKNOWN_ERROR_MESSAGE;
  if (error.code === "SLUG_TAKEN") return "";
  return Object.keys(error.fields).length > 0 ? "" : error.message;
}

/** Message suitable for toasts and page-level error states. */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : UNKNOWN_ERROR_MESSAGE;
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
