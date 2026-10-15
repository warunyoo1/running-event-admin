export type OrderStatus =
  "pending" | "slip_uploaded" | "paid" | "rejected" | "expired" | "cancelled";
export type EventStatus = "draft" | "open" | "closed";
export type Role = "super_admin" | "reviewer" | "viewer";
export type Race = { name: string; price: number; quota: number };
export type RunningEvent = {
  id: string;
  name: string;
  slug: string;
  date: string;
  venue: string;
  status: EventStatus;
  theme: "orange" | "green" | "blue";
  races: Race[];
};
export type Participant = {
  id: string;
  name: string;
  race: string;
  size: string;
  bib: string;
  collected: boolean;
};
export type Order = {
  id: string;
  eventId: string;
  contact: string;
  phone: string;
  amount: number;
  status: OrderStatus;
  createdAt: string;
  reference: string;
  participants: Participant[];
  delivery: "pickup" | "shipping";
  address: string;
  tracking: string;
  rejectionReason?: string;
  reviewedAt?: string;
  reviewedBy?: string;
};
export type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
};
export type DemoState = {
  events: RunningEvent[];
  orders: Order[];
  users: AdminUser[];
};

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

const events: RunningEvent[] = [
  {
    id: "evt-1",
    name: "Bangkok Morning Run 2027",
    slug: "bangkok-morning-2027",
    date: "2027-01-17",
    venue: "สวนหลวง ร.9 กรุงเทพมหานคร",
    status: "open",
    theme: "orange",
    races: [
      { name: "5 KM", price: 399, quota: 600 },
      { name: "10 KM", price: 599, quota: 400 },
    ],
  },
  {
    id: "evt-2",
    name: "Khao Yai Trail & Run",
    slug: "khaoyai-trail-2027",
    date: "2027-02-07",
    venue: "ปากช่อง นครราชสีมา",
    status: "open",
    theme: "green",
    races: [
      { name: "10 KM", price: 799, quota: 300 },
      { name: "21 KM", price: 1299, quota: 200 },
    ],
  },
  {
    id: "evt-3",
    name: "Chiang Mai Sunset Run",
    slug: "chiangmai-sunset-2027",
    date: "2027-03-14",
    venue: "อ่างแก้ว เชียงใหม่",
    status: "draft",
    theme: "blue",
    races: [{ name: "5 KM", price: 499, quota: 500 }],
  },
];
const names = [
  "ปณิธาน ใจดี",
  "ณัฐชา รักวิ่ง",
  "ธนกฤต มีสุข",
  "กมลชนก สดใส",
  "พีรพล วิ่งไกล",
  "ศิรินทร์ แสงทอง",
  "อธิชา สายลม",
  "กิตติพงษ์ สุขใจ",
  "พรนภา ใจสู้",
  "วรัญญา รุ่งเรือง",
  "นที พงษ์ไพร",
  "ชลธิชา ยิ้มแย้ม",
  "ภูริณัฐ ตั้งใจ",
  "อริสา แก้วใส",
  "ธีรภัทร ก้าวไกล",
  "ภัทรวดี พูนสุข",
  "นภัสสร อรุณ",
  "ธนวัฒน์ เพียรดี",
];
const statuses: OrderStatus[] = [
  "slip_uploaded",
  "paid",
  "slip_uploaded",
  "pending",
  "paid",
  "paid",
  "slip_uploaded",
  "paid",
  "rejected",
  "paid",
  "pending",
  "paid",
  "slip_uploaded",
  "paid",
  "expired",
  "paid",
  "cancelled",
  "paid",
];
const orders: Order[] = names.map((name, index) => {
  const event = events[index % 3 === 1 ? 1 : 0];
  const race = event.races[index % 2];
  const count = index % 4 === 0 ? 2 : 1;
  return {
    id: `RR2610-${String(1048 - index).padStart(4, "0")}`,
    eventId: event.id,
    contact: name,
    phone: `080000${String(index).padStart(4, "0")}`,
    amount: race.price * count + (index % 3 === 0 ? 50 : 0),
    status: statuses[index],
    createdAt: `2026-10-${String(15 - Math.floor(index / 3)).padStart(2, "0")}T${String(10 + (index % 8)).padStart(2, "0")}:20:00+07:00`,
    reference: `DEMO-REF-${1048 - index}`,
    participants: Array.from({ length: count }, (_, p) => ({
      id: `p-${index}-${p}`,
      name: p ? names[(index + 5) % names.length] : name,
      race: race.name,
      size: ["S", "M", "L", "XL"][index % 4],
      bib: statuses[index] === "paid" ? String(1001 + index * 2 + p) : "",
      collected: false,
    })),
    delivery: index % 3 === 0 ? "shipping" : "pickup",
    address:
      index % 3 === 0
        ? "99 ถนนตัวอย่าง แขวงสวนหลวง เขตสวนหลวง กรุงเทพมหานคร 10250"
        : "",
    tracking: "",
    ...(statuses[index] === "rejected"
      ? { rejectionReason: "ยอดเงินในสลิปไม่ตรงกับยอดออเดอร์" }
      : {}),
  };
});
export const initialState: DemoState = {
  events,
  orders,
  users: [
    {
      id: "u-1",
      name: "ผู้ดูแลระบบสาธิต",
      email: "admin@example.com",
      role: "super_admin",
      active: true,
    },
    {
      id: "u-2",
      name: "เจ้าหน้าที่สาธิต",
      email: "reviewer@example.com",
      role: "reviewer",
      active: true,
    },
    {
      id: "u-3",
      name: "ผู้ดูข้อมูลสาธิต",
      email: "viewer@example.com",
      role: "viewer",
      active: true,
    },
  ],
};

export function exportCsv(filename: string, rows: (string | number)[][]) {
  // Quote all values and neutralize spreadsheet formula prefixes in text fields.
  const csv = rows
    .map((row) =>
      row
        .map((value) => {
          const text = String(value);
          const safe =
            typeof value === "string" && /^[\s]*[=+\-@]/.test(text)
              ? `'${text}`
              : text;
          return `"${safe.replaceAll('"', '""')}"`;
        })
        .join(","),
    )
    .join("\r\n");
  const url = URL.createObjectURL(
    new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
