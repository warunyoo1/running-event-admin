import type {
  Address,
  AuditEntity,
  EventCategory,
  EventStatus,
  EventTheme,
  OrderStatus,
  Role,
  TimelineKind,
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
/** Thai label for every action the API writes to the audit log. */
export const auditActionLabels: Record<string, string> = {
  "auth.login": "เข้าสู่ระบบ",
  "auth.change_password": "เปลี่ยนรหัสผ่าน",
  "event.create": "สร้างงานวิ่ง",
  "event.update": "แก้ไขงานวิ่ง",
  "event.archive": "เก็บถาวรงานวิ่ง",
  "event.restore": "กู้คืนงานวิ่ง",
  "event.delete": "ลบงานวิ่งถาวร",
  "event.image.add": "เพิ่มรูปงานวิ่ง",
  "event.image.update": "แก้ไขรูปงานวิ่ง",
  "event.image.reorder": "จัดลำดับรูปงานวิ่ง",
  "event.image.delete": "ลบรูปงานวิ่ง",
  "order.cancel": "ยกเลิกออเดอร์",
  "order.tracking": "บันทึกเลขพัสดุ",
  "order.approve": "อนุมัติสลิป",
  "order.reject": "ปฏิเสธสลิป",
  "order.note.add": "เพิ่มบันทึกภายในออเดอร์",
  "order.note.delete": "ลบบันทึกภายในออเดอร์",
  "order.address.update": "แก้ไขที่อยู่จัดส่ง",
  "participant.patch": "แก้ไขข้อมูลผู้สมัคร",
  "user.create": "สร้างผู้ใช้",
  "user.update": "แก้ไขผู้ใช้",
  "user.delete": "ลบผู้ใช้ถาวร",
};
export const auditEntityLabels: Record<AuditEntity, string> = {
  User: "ผู้ใช้",
  Event: "งานวิ่ง",
  Order: "ออเดอร์",
  Participant: "ผู้สมัคร",
};
/** Thai label for every order timeline entry kind. */
export const timelineLabels: Record<TimelineKind, string> = {
  created: "สร้างออเดอร์",
  slip_uploaded: "อัปโหลดสลิป",
  slip_rejected: "สลิปไม่ผ่าน",
  paid: "ชำระเงินแล้ว",
  cancelled: "ยกเลิกออเดอร์",
  expired: "ออเดอร์หมดอายุ",
  tracking_set: "บันทึกเลขพัสดุ",
  address_updated: "แก้ไขที่อยู่จัดส่ง",
  note: "บันทึกภายใน",
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
