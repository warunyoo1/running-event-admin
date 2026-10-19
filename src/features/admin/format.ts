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
  expired: "หมดเวลาชำระเงิน",
  cancelled: "ยกเลิกแล้ว",
  draft: "ฉบับร่าง",
  open: "เปิดรับสมัคร",
  closed: "ปิดรับสมัคร",
  upcoming: "เร็วๆ นี้",
};
/** What each event status means for the public sign-up site (shown under the status field). */
export const eventStatusHints: Record<EventStatus, string> = {
  draft: "ยังไม่แสดงบนเว็บรับสมัคร",
  open: "แสดงบนเว็บ และรับสมัครได้",
  closed: "แสดงบนเว็บ แต่ปิดรับสมัครแล้ว",
  upcoming: "แสดงบนเว็บ แต่ยังรับสมัครไม่ได้",
};
export const roleLabels: Record<Role, string> = {
  super_admin: "ผู้ดูแลระบบ",
  reviewer: "เจ้าหน้าที่",
  viewer: "ดูได้อย่างเดียว",
};
/** One line on what each role can do. Keep in step with the API's route guards. */
export const roleDescriptions: Record<Role, string> = {
  super_admin: "ทำได้ทุกอย่าง รวมถึงสร้างและแก้ไขงานวิ่ง และจัดการผู้ใช้",
  reviewer:
    "ตรวจสลิป ยกเลิกออเดอร์ แก้ที่อยู่ ใส่เลขพัสดุ และกรอกเลข BIB ได้ แต่แก้ไขงานวิ่งและจัดการผู้ใช้ไม่ได้",
  viewer: "ดูข้อมูลและดาวน์โหลดไฟล์ได้อย่างเดียว แก้ไขอะไรไม่ได้",
};
/** Toast shown when a CSV download hit the row limit. */
export const exportLimitNotice = (limit: number) =>
  `ดาวน์โหลดได้สูงสุด ${limit.toLocaleString("th-TH")} รายการ ไฟล์นี้อาจมีข้อมูลไม่ครบ ลองเลือกช่วงวันที่ให้แคบลง`;
/** Thai label for every action the API writes to the audit log. */
export const auditActionLabels: Record<string, string> = {
  "auth.login": "เข้าสู่ระบบ",
  "auth.change_password": "เปลี่ยนรหัสผ่าน",
  "event.create": "สร้างงานวิ่ง",
  "event.update": "แก้ไขงานวิ่ง",
  "event.archive": "ซ่อนงานวิ่ง",
  "event.restore": "แสดงงานวิ่งอีกครั้ง",
  "event.delete": "ลบงานวิ่ง",
  "event.image.add": "เพิ่มรูปงานวิ่ง",
  "event.image.update": "แก้ไขรูปงานวิ่ง",
  "event.image.reorder": "เรียงลำดับรูปงานวิ่ง",
  "event.image.delete": "ลบรูปงานวิ่ง",
  "order.cancel": "ยกเลิกออเดอร์",
  "order.tracking": "บันทึกเลขพัสดุ",
  "order.approve": "อนุมัติสลิป",
  "order.reject": "ปฏิเสธสลิป",
  "order.note.add": "เพิ่มบันทึกทีมงานในออเดอร์",
  "order.note.delete": "ลบบันทึกทีมงานในออเดอร์",
  "order.address.update": "แก้ไขที่อยู่จัดส่ง",
  "participant.patch": "แก้ไขข้อมูลผู้สมัคร (เลข BIB / การรับชุดวิ่ง)",
  "user.create": "สร้างผู้ใช้",
  "user.update": "แก้ไขผู้ใช้ (รวมถึงเปิด/ปิดใช้งาน)",
  "user.delete": "ลบผู้ใช้",
};
export const auditEntityLabels: Record<AuditEntity, string> = {
  User: "ผู้ใช้",
  Event: "งานวิ่ง",
  Order: "ออเดอร์",
  Participant: "ผู้สมัคร",
};
/** Thai label for every order timeline entry kind. */
export const timelineLabels: Record<TimelineKind, string> = {
  created: "ผู้สมัครสร้างออเดอร์",
  slip_uploaded: "ส่งสลิป",
  slip_rejected: "ปฏิเสธสลิป",
  paid: "อนุมัติสลิป (รับเงินแล้ว)",
  cancelled: "ยกเลิกออเดอร์",
  expired: "หมดเวลาชำระเงิน",
  tracking_set: "บันทึกเลขพัสดุ",
  address_updated: "แก้ไขที่อยู่จัดส่ง",
  note: "บันทึกของทีมงาน",
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
  road: "วิ่งถนน",
  trail: "วิ่งเทรล",
  fun: "ฟันรัน (วิ่งสนุก)",
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
