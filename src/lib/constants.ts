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
// What the API stores when category/theme are cleared. Keep in sync with the API's `config/constants.ts`.
export const DEFAULT_EVENT_CATEGORY: (typeof EVENT_CATEGORIES)[number] = "road";
export const DEFAULT_EVENT_THEME: (typeof EVENT_THEMES)[number] = "orange";

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
/** sessionStorage flag: the temporary-password nudge is shown once per browser session. */
export const MUST_CHANGE_PASSWORD_SHOWN_KEY = "runops-password-nudge-shown";
/** Length of generated temporary passwords (API minimum is 10). */
export const TEMP_PASSWORD_LENGTH = 16;

/** Entities the audit log can be filtered by. Keep in sync with the API's `AUDIT_ENTITIES`. */
export const AUDIT_ENTITIES = ["User", "Event", "Order", "Participant"] as const;

// Keep in sync with the API's provinces in config/constants.ts (address edit validates against it).
export const PROVINCES = ["กรุงเทพมหานคร", "กระบี่", "กาญจนบุรี", "กาฬสินธุ์", "กำแพงเพชร", "ขอนแก่น", "จันทบุรี", "ฉะเชิงเทรา", "ชลบุรี", "ชัยนาท", "ชัยภูมิ", "ชุมพร", "เชียงราย", "เชียงใหม่", "ตรัง", "ตราด", "ตาก", "นครนายก", "นครปฐม", "นครพนม", "นครราชสีมา", "นครศรีธรรมราช", "นครสวรรค์", "นนทบุรี", "นราธิวาส", "น่าน", "บึงกาฬ", "บุรีรัมย์", "ปทุมธานี", "ประจวบคีรีขันธ์", "ปราจีนบุรี", "ปัตตานี", "พระนครศรีอยุธยา", "พะเยา", "พังงา", "พัทลุง", "พิจิตร", "พิษณุโลก", "เพชรบุรี", "เพชรบูรณ์", "แพร่", "ภูเก็ต", "มหาสารคาม", "มุกดาหาร", "แม่ฮ่องสอน", "ยโสธร", "ยะลา", "ร้อยเอ็ด", "ระนอง", "ระยอง", "ราชบุรี", "ลพบุรี", "ลำปาง", "ลำพูน", "เลย", "ศรีสะเกษ", "สกลนคร", "สงขลา", "สตูล", "สมุทรปราการ", "สมุทรสงคราม", "สมุทรสาคร", "สระแก้ว", "สระบุรี", "สิงห์บุรี", "สุโขทัย", "สุพรรณบุรี", "สุราษฎร์ธานี", "สุรินทร์", "หนองคาย", "หนองบัวลำภู", "อ่างทอง", "อำนาจเจริญ", "อุดรธานี", "อุตรดิตถ์", "อุทัยธานี", "อุบลราชธานี"] as const;

// Internal order notes. Keep in sync with the API's ORDER_NOTE_MAX.
export const ORDER_NOTE_MAX = 1000;
