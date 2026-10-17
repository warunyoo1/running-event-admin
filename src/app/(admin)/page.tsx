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
import { useScope } from "@/features/admin/scope-provider";
import { useAsync } from "@/features/admin/use-async";
import { clientCsv } from "@/features/admin/client-csv";
import { artTheme, date, money, number } from "@/features/admin/format";
import { dashboardApi, ordersApi } from "@/lib/api";
import type { DashboardData, OrderStatus } from "@/lib/api/types";
import { ErrorState, LoadingState } from "@/components/data-states";
import {
  Badge,
  EmptyState,
  EventArtwork,
  PageHeading,
  StatCard,
} from "@/components/ui";

const RECENT_ORDERS = 5;
const STATUS_ORDER: OrderStatus[] = [
  "paid",
  "slip_uploaded",
  "pending",
  "rejected",
  "expired",
  "cancelled",
];

function exportOverview(data: DashboardData) {
  clientCsv("overview.csv", [
    ["รายการ", "จำนวน"],
    ["ที่นั่งที่จอง", data.participants],
    ["ยอดชำระแล้ว", data.paidRevenue],
    ["สลิปรอตรวจ", data.pendingReview],
    ...data.races.map((race): (string | number)[] => [
      `${race.eventName} · ${race.name} (จอง/โควตา)`,
      `${race.reserved}/${race.quota}`,
    ]),
  ]);
}

export default function DashboardPage() {
  const { events, eventId, scopeEventId } = useScope();
  const summary = useAsync(
    (signal) => dashboardApi.getDashboard(scopeEventId, signal),
    [scopeEventId],
  );
  const recent = useAsync(
    (signal) =>
      ordersApi.listOrders(
        { eventId: scopeEventId, page: 1, pageSize: RECENT_ORDERS },
        signal,
      ),
    [scopeEventId],
  );
  const data = summary.data;
  const visibleEvents = events.filter(
    (event) => eventId === "all" || event.id === eventId,
  );
  const recentOrders = recent.data?.data ?? [];
  return (
    <>
      <PageHeading
        title="ภาพรวมการจัดงาน"
        description="ทุกความเคลื่อนไหวของงานวิ่ง ในที่เดียว"
        action={
          <button
            className="button"
            disabled={!data}
            onClick={() => data && exportOverview(data)}
          >
            <Download size={16} aria-hidden="true" />
            ส่งออกรายงาน
          </button>
        }
      />
      {summary.error && (
        <ErrorState message={summary.error} onRetry={summary.reload} />
      )}
      {!data && summary.loading && <LoadingState />}
      {data && (
        <>
          <div className="attention-banner">
            <span className="attention-icon">
              <ScanLine size={23} aria-hidden="true" />
            </span>
            <div>
              <strong>
                {data.pendingReview > 0
                  ? `มี ${number(data.pendingReview)} สลิปรอการตรวจสอบ`
                  : "ตรวจสลิปครบแล้ว พร้อมสำหรับก้าวต่อไป"}
              </strong>
              <p>
                {data.pendingReview > 0
                  ? "ตรวจสอบเพื่อยืนยันสิทธิ์ให้ผู้สมัคร"
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
              value={money(data.paidRevenue)}
              note={`${number(data.orders.paid)} ออเดอร์ที่ยืนยันแล้ว`}
              icon={CircleDollarSign}
              accent
            />
            <StatCard
              title="ที่นั่งที่จอง"
              value={number(data.participants)}
              note="ไม่รวมออเดอร์ยกเลิกและหมดอายุ"
              icon={Users}
            />
            <StatCard
              title="สลิปรอตรวจสอบ"
              value={number(data.pendingReview)}
              note="รอเจ้าหน้าที่ยืนยันการชำระเงิน"
              icon={Clock3}
            />
            <StatCard
              title="งานที่เปิดรับสมัคร"
              value={number(
                visibleEvents.filter((event) => event.status === "open").length,
              )}
              note={`จากทั้งหมด ${visibleEvents.length} งานวิ่ง`}
              icon={Flag}
            />
          </div>
          <div className="dashboard-middle">
            <section className="panel chart-panel">
              <div className="panel-heading">
                <div>
                  <h2>ที่นั่งตามระยะ</h2>
                  <p>จำนวนที่จองเทียบกับโควตาของแต่ละระยะ</p>
                </div>
              </div>
              {data.races.length ? (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>งานวิ่ง</th>
                        <th>ระยะ</th>
                        <th className="numeric">ที่นั่งที่จอง</th>
                        <th className="numeric">โควตา</th>
                        <th className="numeric">คงเหลือ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.races.map((race) => (
                        <tr key={race.raceId}>
                          <td>{race.eventName}</td>
                          <td>
                            <span className="race-chip">{race.name}</span>
                          </td>
                          <td className="numeric strong">
                            {number(race.reserved)}
                          </td>
                          <td className="numeric muted">{number(race.quota)}</td>
                          <td className="numeric muted">
                            {number(race.remaining)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState title="ยังไม่มีระยะวิ่ง" />
              )}
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
                  {number(data.totalOrders)}
                  <span>ออเดอร์</span>
                </strong>
                <div className="segmented-bar" aria-hidden="true">
                  {STATUS_ORDER.map((status) => (
                    <span
                      className={`segment-${status}`}
                      key={status}
                      style={{ flex: data.orders[status] }}
                    />
                  ))}
                </div>
              </div>
              <div className="payment-rows">
                {[
                  {
                    label: "ชำระเงินแล้ว",
                    count: data.orders.paid,
                    className: "green",
                    icon: Check,
                  },
                  {
                    label: "รอตรวจสลิป",
                    count: data.orders.slip_uploaded,
                    className: "orange",
                    icon: ScanLine,
                  },
                  {
                    label: "รอชำระเงิน",
                    count: data.orders.pending,
                    className: "blue",
                    icon: Clock3,
                  },
                ].map(({ label, count, className, icon: Icon }) => (
                  <div key={label}>
                    <span className={`mini-icon ${className}`}>
                      <Icon size={15} aria-hidden="true" />
                    </span>
                    <span>{label}</span>
                    <strong>{number(count)}</strong>
                    <small>ออเดอร์</small>
                  </div>
                ))}
              </div>
              <Link className="text-link summary-link" href="/orders">
                ดูออเดอร์ทั้งหมด <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </section>
          </div>
        </>
      )}
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
        {recent.error && (
          <ErrorState message={recent.error} onRetry={recent.reload} />
        )}
        {!recent.data && recent.loading && <LoadingState />}
        {recent.data &&
          (recentOrders.length ? (
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
                  {recentOrders.map((order) => (
                    <tr key={order.id}>
                      <td className="mobile-record">
                        <Link
                          className="order-link"
                          href={`/orders?order=${order.id}`}
                        >
                          {order.orderNo}
                        </Link>
                        <span className="mobile-only mobile-contact">
                          {order.contactName}
                        </span>
                      </td>
                      <td className="table-secondary">
                        <span className="person-name">{order.contactName}</span>
                        <small className="cell-sub">
                          {order.participantCount} ผู้สมัคร
                        </small>
                      </td>
                      <td className="table-secondary table-event">
                        {order.eventName}
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
            <EmptyState title="ยังไม่มีออเดอร์" />
          ))}
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
              <EventArtwork theme={artTheme(event.theme)} compact />
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
