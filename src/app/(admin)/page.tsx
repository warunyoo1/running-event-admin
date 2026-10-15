"use client";

import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  CircleDollarSign,
  Clock3,
  Download,
  Flag,
  MapPin,
  ScanLine,
  Users,
} from "lucide-react";
import { useDemo } from "@/features/admin/demo-store";
import { date, exportCsv, money, number } from "@/features/admin/data";
import {
  Badge,
  EmptyState,
  EventArtwork,
  PageHeading,
  StatCard,
} from "@/components/ui";

export default function DashboardPage() {
  const { events, orders, eventId } = useDemo();
  const visibleOrders = orders
    .filter((o) => eventId === "all" || o.eventId === eventId)
    .toSorted((a, b) => b.createdAt.localeCompare(a.createdAt));
  const visibleEvents = events.filter(
    (e) => eventId === "all" || e.id === eventId,
  );
  const paid = visibleOrders.filter((o) => o.status === "paid");
  const waiting = visibleOrders.filter((o) => o.status === "slip_uploaded");
  const participants = visibleOrders
    .filter((o) => !["expired", "cancelled"].includes(o.status))
    .reduce((sum, o) => sum + o.participants.length, 0);
  const days = Array.from({ length: 7 }, (_, i) => ({
    label: `${9 + i} ต.ค.`,
    count: visibleOrders
      .filter(
        (o) =>
          Number(o.createdAt.slice(8, 10)) === 9 + i &&
          !["expired", "cancelled"].includes(o.status),
      )
      .reduce((s, o) => s + o.participants.length, 0),
  }));
  const max = Math.max(4, ...days.map((d) => d.count));
  const points = days
    .map((d, i) => `${44 + i * 84},${180 - (d.count / max) * 140}`)
    .join(" ");
  const amount = paid.reduce((s, o) => s + o.amount, 0);
  return (
    <>
      <PageHeading
        title="ภาพรวมการจัดงาน"
        description="ทุกความเคลื่อนไหวของงานวิ่ง ในที่เดียว"
        action={
          <>
            <span className="date-label">
              <CalendarDays size={16} aria-hidden="true" />
              15 ต.ค. 2569
            </span>
            <button
              className="button"
              onClick={() =>
                exportCsv("overview-demo.csv", [
                  ["รายการ", "จำนวน"],
                  ["ผู้สมัครที่ยังมีสิทธิ์", participants],
                  ["ยอดชำระแล้ว", amount],
                  ["สลิปรอตรวจ", waiting.length],
                ])
              }
            >
              <Download size={16} aria-hidden="true" />
              ส่งออกรายงาน
            </button>
          </>
        }
      />
      <div className="attention-banner">
        <span className="attention-icon">
          <ScanLine size={23} aria-hidden="true" />
        </span>
        <div>
          <strong>
            {waiting.length > 0
              ? `มี ${waiting.length} สลิปรอการตรวจสอบ`
              : "ตรวจสลิปครบแล้ว พร้อมสำหรับก้าวต่อไป"}
          </strong>
          <p>
            {waiting.length > 0
              ? `ยอดรอตรวจรวม ${money(waiting.reduce((s, o) => s + o.amount, 0))} · ตรวจสอบเพื่อยืนยันสิทธิ์ให้ผู้สมัคร`
              : "ติดตามจำนวนผู้สมัครและเตรียมอุปกรณ์สำหรับงานวิ่งได้เลย"}
          </p>
        </div>
        <Link className="button primary" href="/slips">
          ไปตรวจสลิป
          <ArrowRight size={17} aria-hidden="true" />
        </Link>
      </div>
      <div className="stats-grid">
        <StatCard
          title="ยอดชำระเงินแล้ว"
          value={money(amount)}
          note={`${paid.length} ออเดอร์ที่ยืนยันแล้ว`}
          icon={CircleDollarSign}
          accent
        />
        <StatCard
          title="ผู้สมัครทั้งหมด"
          value={number(participants)}
          note="ไม่รวมออเดอร์ยกเลิกและหมดอายุ"
          icon={Users}
        />
        <StatCard
          title="สลิปรอตรวจสอบ"
          value={number(waiting.length)}
          note="รอเจ้าหน้าที่ยืนยันการชำระเงิน"
          icon={Clock3}
        />
        <StatCard
          title="งานที่เปิดรับสมัคร"
          value={number(
            visibleEvents.filter((e) => e.status === "open").length,
          )}
          note={`จากทั้งหมด ${visibleEvents.length} งานวิ่ง`}
          icon={Flag}
        />
      </div>
      <div className="dashboard-middle">
        <section className="panel chart-panel">
          <div className="panel-heading">
            <div>
              <h2>แนวโน้มการสมัคร</h2>
              <p>จำนวนผู้สมัครต่อวัน · ข้อมูลสาธิต 9–15 ต.ค. 2569</p>
            </div>
            <span className="chart-legend">
              <i />
              ผู้สมัคร
            </span>
          </div>
          <div className="chart-summary">
            <strong>{days.reduce((s, d) => s + d.count, 0)}</strong>
            <span>คนในช่วง 7 วัน</span>
          </div>
          <div className="line-chart">
            <svg
              viewBox="0 0 600 220"
              role="img"
              aria-label={`กราฟจำนวนผู้สมัครรายวัน ${days.map((d) => `${d.label} ${d.count} คน`).join(", ")}`}
            >
              <defs>
                <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor="var(--primary)"
                    stopOpacity=".14"
                  />
                  <stop
                    offset="100%"
                    stopColor="var(--primary)"
                    stopOpacity="0"
                  />
                </linearGradient>
              </defs>
              {[0, 1, 2, 3].map((i) => (
                <g key={i}>
                  <line
                    x1="40"
                    x2="558"
                    y1={40 + i * 46.67}
                    y2={40 + i * 46.67}
                    stroke="var(--border)"
                    strokeDasharray="4 5"
                  />
                  <text x="5" y={44 + i * 46.67}>
                    {Math.round(max * (1 - i / 3))}
                  </text>
                </g>
              ))}
              <polygon
                points={`44,180 ${points} 548,180`}
                fill="url(#chart-fill)"
              />
              <polyline
                points={points}
                fill="none"
                stroke="var(--primary)"
                strokeWidth="3"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {days.map((d, i) => (
                <g key={d.label}>
                  <circle
                    cx={44 + i * 84}
                    cy={180 - (d.count / max) * 140}
                    r="4"
                    fill="white"
                    stroke="var(--primary)"
                    strokeWidth="2"
                  />
                  <text x={44 + i * 84} y="212" textAnchor="middle">
                    {d.label}
                  </text>
                </g>
              ))}
            </svg>
          </div>
        </section>
        <section className="panel payment-summary">
          <div className="panel-heading">
            <div>
              <h2>สถานะการชำระเงิน</h2>
              <p>ติดตามออเดอร์ในแต่ละขั้นตอน</p>
            </div>
            <ArrowUpRight size={18} aria-hidden="true" />
          </div>
          <div className="payment-total">
            <small>ออเดอร์ทั้งหมด</small>
            <strong>
              {visibleOrders.length}
              <span>ออเดอร์</span>
            </strong>
            <div className="segmented-bar" aria-hidden="true">
              {[
                "paid",
                "slip_uploaded",
                "pending",
                "rejected",
                "expired",
                "cancelled",
              ].map((status) => (
                <span
                  className={`segment-${status}`}
                  key={status}
                  style={{
                    flex: visibleOrders.filter((o) => o.status === status)
                      .length,
                  }}
                />
              ))}
            </div>
          </div>
          <div className="payment-rows">
            {[
              {
                label: "ชำระเงินแล้ว",
                count: paid.length,
                className: "green",
                icon: Check,
              },
              {
                label: "รอตรวจสลิป",
                count: waiting.length,
                className: "orange",
                icon: ScanLine,
              },
              {
                label: "รอชำระเงิน",
                count: visibleOrders.filter((o) => o.status === "pending")
                  .length,
                className: "blue",
                icon: Clock3,
              },
            ].map(({ label, count, className, icon: Icon }) => (
              <div key={label}>
                <span className={`mini-icon ${className}`}>
                  <Icon size={15} aria-hidden="true" />
                </span>
                <span>{label}</span>
                <strong>{count}</strong>
                <small>ออเดอร์</small>
              </div>
            ))}
          </div>
          <Link className="text-link summary-link" href="/orders">
            ดูออเดอร์ทั้งหมด <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </section>
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>ออเดอร์ล่าสุด</h2>
            <p>ติดตามการสมัครและสถานะการชำระเงิน</p>
          </div>
          <Link className="text-link" href="/orders">
            ดูทั้งหมด
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
        {visibleOrders.length ? (
          <div className="table-scroll">
            <table className="table-mobile-cards" role="table">
              <thead>
                <tr>
                  <th>หมายเลขออเดอร์</th>
                  <th className="table-secondary">ผู้ติดต่อ</th>
                  <th className="table-secondary">งานวิ่ง</th>
                  <th className="numeric">ยอดชำระ</th>
                  <th>สถานะ</th>
                  <th className="table-secondary">วันที่สมัคร</th>
                </tr>
              </thead>
              <tbody>
                {visibleOrders.slice(0, 5).map((order) => (
                  <tr key={order.id}>
                    <td className="mobile-record">
                      <Link
                        className="order-link"
                        href={`/orders?order=${order.id}`}
                      >
                        {order.id}
                      </Link>
                      <span className="mobile-only mobile-contact">
                        {order.contact}
                      </span>
                    </td>
                    <td className="table-secondary">
                      <span className="person-name">{order.contact}</span>
                      <small className="cell-sub">
                        {order.participants.length} ผู้สมัคร
                      </small>
                    </td>
                    <td className="table-secondary table-event">
                      {events.find((e) => e.id === order.eventId)?.name}
                    </td>
                    <td
                      className="numeric strong mobile-amount"
                      data-label="ยอดชำระ"
                    >
                      {money(order.amount)}
                    </td>
                    <td className="mobile-status">
                      <Badge status={order.status} />
                    </td>
                    <td className="muted table-secondary">
                      {date(order.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState />
        )}
      </section>
      <section className="upcoming-section">
        <div className="section-heading">
          <h2>งานวิ่งของคุณ</h2>
          <Link className="text-link" href="/events">
            จัดการงานวิ่ง
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
        <div className="upcoming-grid">
          {visibleEvents.slice(0, 3).map((event) => (
            <Link
              key={event.id}
              className="upcoming-card"
              href={`/events?event=${event.id}`}
            >
              <EventArtwork theme={event.theme} compact />
              <div>
                <Badge status={event.status} />
                <h3>{event.name}</h3>
                <p>
                  <CalendarDays size={14} aria-hidden="true" />
                  {date(event.date)}
                </p>
                <p>
                  <MapPin size={14} aria-hidden="true" />
                  {event.venue}
                </p>
              </div>
              <ArrowUpRight size={18} aria-hidden="true" />
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
