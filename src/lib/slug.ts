// Mirrors the API's event slug rule (running-event-api/src/validators/event.validator.ts):
// /^[a-z0-9]+(?:-[a-z0-9]+)*$/, max 120, unique (409 SLUG_TAKEN).
export const SLUG_MAX = 120;
export const SLUG_PATTERN = "[a-z0-9]+(-[a-z0-9]+)*";
export const SLUG_TAKEN_CODE = "SLUG_TAKEN";
/** A Thai name with fewer Latin letters than this (digits alone are not meaningful) uses the fallback. */
const MIN_LATIN_LETTERS = 3;

const THAI = /[\u0E00-\u0E7F]/;

export function hasThai(text: string): boolean {
  return THAI.test(text);
}

export function randomSuffix(length = 4): string {
  let out = "";
  while (out.length < length) out += Math.floor(Math.random() * 36).toString(36);
  return out;
}

function yearOf(date?: string): string {
  const match = date ? /^(\d{4})-\d{2}-\d{2}$/.exec(date) : null;
  return match ? match[1] : String(new Date().getFullYear());
}

/** Latin letters/digits only, joined by single hyphens, within SLUG_MAX. Empty when nothing usable. */
function latinSlug(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX)
    .replace(/-+$/g, "");
}

/**
 * Build a slug from an event name. Thai text is dropped (no romanisation table); when a Thai name
 * leaves too little Latin text, fall back to `event-<year>-<suffix>`. The caller keeps `suffix`
 * stable for the form session so the slug does not flicker on every keystroke.
 */
export function slugify(name: string, opts: { date?: string; suffix: string }): string {
  const base = latinSlug(name);
  if (isThaiFallback(name)) {
    return `event-${yearOf(opts.date)}-${opts.suffix}`;
  }
  return base;
}

/** True when `slugify` used the fallback because of a Thai name. */
export function isThaiFallback(name: string): boolean {
  return hasThai(name) && (latinSlug(name).match(/[a-z]/g) ?? []).length < MIN_LATIN_LETTERS;
}

/** "run" -> "run-2", "run-2" -> "run-3". Stays within SLUG_MAX. */
export function nextSlugVariant(slug: string): string {
  const match = /^(.*?)-(\d+)$/.exec(slug);
  const stem = match ? match[1] : slug;
  const n = match ? Number(match[2]) + 1 : 2;
  const tail = `-${n}`;
  return `${stem.slice(0, SLUG_MAX - tail.length).replace(/-+$/g, "")}${tail}`;
}
