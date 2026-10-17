import type {
  Address,
  EventCategory,
  EventStatus,
  EventTheme,
  OrderStatus,
  Role,
} from "@/lib/api/types";

export const statusLabels: Record<OrderStatus | EventStatus, string> = {
  pending: "รอชำระเงิน",
  slip_uploaded: "รอตรวจสลิป",
  paid: "ชำระเงินแล้ว",
  rejected: "สลิปไม่ผ่าน",
  expired: "หมดอายุ",
  cancelled: "ยกเลิกแล้ว",
  draft: "แบบร่าง",
  open: "เปิดรับสมัคร",
  closed: "ปิดรับสมัคร",
  upcoming: "เร็วๆ นี้",
};
export const roleLabels: Record<Role, string> = {
  super_admin: "ผู้ดูแลระบบ",
  reviewer: "เจ้าหน้าที่ตรวจสลิป",
  viewer: "ผู้ดูข้อมูล",
};
export const number = (value: number) =>
  new Intl.NumberFormat("th-TH").format(value);
export const money = (value: number) =>
  new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0,
  }).format(value);
export const date = (value: string, withTime = false) =>
  new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Bangkok",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(new Date(value));

export const formatAddress = (address: Address) =>
  [address.street, address.subdistrict, address.district, address.province, address.postalCode]
    .filter(Boolean)
    .join(" ");

export const categoryLabels: Record<EventCategory, string> = {
  road: "ถนน",
  trail: "เทรล",
  fun: "ฟันรัน",
};

export const themeLabels: Record<EventTheme, string> = {
  orange: "ส้ม",
  green: "เขียว",
  blue: "ฟ้า",
  pink: "ชมพู",
  navy: "กรมท่า",
  sand: "ทราย",
};

/** Artwork only has three palettes; other themes fall back to orange. */
export function artTheme(theme?: string) {
  return theme === "green" || theme === "blue" ? theme : "orange";
}
