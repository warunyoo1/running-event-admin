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
