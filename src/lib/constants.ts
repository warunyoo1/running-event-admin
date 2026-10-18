// Same-origin base: Next rewrites `/api/*` to the API (see next.config.ts).
export const API_BASE = "/api/v1/admin";
export const COOKIE_NAME = "rr_admin_token";
export const SELECTED_EVENT_KEY = "runops-selected-event";
export const ALL_EVENTS = "all";

export const PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
export const EXPORT_LIMIT = 50_000;
export const SEARCH_DEBOUNCE_MS = 300;

export const SHIRT_SIZES = ["XS", "S", "M", "L", "XL", "2XL", "3XL"] as const;
export const EVENT_THEMES = ["orange", "green", "blue", "pink", "navy", "sand"] as const;
export const EVENT_CATEGORIES = ["road", "trail", "fun"] as const;

// Event images. Keep in sync with the API's `config/constants.ts`.
export const EVENT_IMAGE_KINDS = [
  "cover",
  "poster",
  "gallery",
  "route_map",
  "shirt",
  "medal",
  "sponsor",
  "other",
] as const;
export const EVENT_IMAGE_KIND_LABELS: Record<(typeof EVENT_IMAGE_KINDS)[number], string> = {
  cover: "หน้าปก",
  poster: "โปสเตอร์",
  gallery: "แกลเลอรี",
  route_map: "แผนที่เส้นทาง",
  shirt: "เสื้อ",
  medal: "เหรียญ / ของรางวัล",
  sponsor: "สปอนเซอร์",
  other: "อื่นๆ",
};
export const EVENT_IMAGE_MAX_PER_EVENT = 30;
export const EVENT_IMAGE_MAX_FILES_PER_REQUEST = 10;
export const EVENT_IMAGE_MAX_MB = 5;
export const EVENT_IMAGE_MAX_BYTES = EVENT_IMAGE_MAX_MB * 1024 * 1024;
export const EVENT_IMAGE_ALT_MAX = 200;
/** Client-side pre-check only; the API verifies the real type by magic bytes. */
export const EVENT_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;