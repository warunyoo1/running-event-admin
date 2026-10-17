const LOGIN_PATH = "/login";

/** Returns a same-origin path to redirect to after login, else `/`. */
export function safeNext(
  next: string | null | undefined,
  origin: string = window.location.origin,
): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return "/";
  try {
    const url = new URL(next, origin);
    if (url.origin !== origin) return "/";
    if (url.pathname === LOGIN_PATH || url.pathname.startsWith(`${LOGIN_PATH}/`)) return "/";
  } catch {
    return "/";
  }
  return next;
}
