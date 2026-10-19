"use client";

import { useState } from "react";
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
import { useToast } from "@/features/admin/toast-provider";
import { date, money, number, statusLabels } from "@/features/admin/format";
import { dashboardApi, exportsApi, ordersApi } from "@/lib/api";
import { errorMessage } from "@/lib/api/errors";
import type { OrderStatus } from "@/lib/api/types";
import { ErrorState, LoadingState } from "@/components/data-states";
import {
  Badge,
  EmptyState,
  PageHeading,
  StatCard,
} from "@/components/ui";
import { EventCover } from "@/components/event-cover";

const RECENT_ORDERS = 5;
const STATUS_ORDER: OrderStatus[] = [
  "paid",
  "slip_uploaded",
  "pending",
  "rejected",
  "expired",
  "cancelled",
];

export default function DashboardPage() {
  const { events, eventId, scopeEventId } = useScope();
  const notify = useToast();
  const [exporting, setExporting] = useState(false);
  async function exportOverview() {
    setExporting(true);
    try {
      await exportsApi.exportOverviewCsv({ eventId: scopeEventId });
    } catch (failure) {
      notify(errorMessage(failure));
    } finally {
      setExporting(false);
    }
  }
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
        title="ภาพรวม"
        description="สรุปจำนวนผู้สมัคร ยอดเงิน และสลิปที่รอตรวจ"
        action={
          <button
            className="button"
            disabled={!data || exporting}
            onClick={exportOverview}
          >
            <Download size={16} aria-hidden="true" />
            ดาวน์โหลดสรุป (CSV)
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
                  ? `มี ${number(data.pendingReview)} ออเดอร์รอตรวจสลิป`
                  : "ตรวจสลิปครบแล้ว ไม่มีรายการค้าง"}
              </strong>
              <p>
                {data.pendingReview > 0
                  ? "ตรวจสลิปแล้วกดอนุมัติ ผู้สมัครจึงจะได้สิทธิ์เข้าร่วมงาน"
                  : "ดูจำนวนผู้สมัครและเตรียมชุดวิ่งได้เลย"}
              </p>
            </div>
            <Link className="button primary" href="/slips">
              ไปตรวจสลิป
              <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </div>
          <div className="stats-grid">
            <StatCard
              title="ยอดเงินที่รับแล้ว"
              value={money(data.paidRevenue)}
              note={`จาก ${number(data.orders.paid)} ออเดอร์ที่ชำระเงินแล้ว`}
              icon={CircleDollarSign}
              accent
            />
            <StatCard
              title="จองแล้ว (คน)"
              value={number(data.participants)}
              note="นับรวมคนที่ยังไม่จ่ายเงิน ไม่นับออเดอร์ที่ยกเลิกหรือหมดเวลา"
              icon={Users}
            />
            <StatCard
              title="สลิปรอตรวจ"
              value={number(data.pendingReview)}
              note="รอเจ้าหน้าที่ตรวจและอนุมัติ"
              icon={Clock3}
            />
            <StatCard
              title="งานที่เปิดรับสมัคร"
              value={number(
                visibleEvents.filter((event) => event.status === "open").length,
              )}
              note={`จากทั้งหมด ${visibleEvents.length} งาน`}
              icon={Flag}
            />
          </div>
          <div className="dashboard-middle">
            <section className="panel chart-panel">
              <div className="panel-heading">
                <div>
                  <h2>ที่นั่งแต่ละระยะวิ่ง</h2>
                  <p>จองแล้วเทียบกับจำนวนที่รับ</p>
                </div>
              </div>
              {data.races.length ? (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>งานวิ่ง</th>
                        <th>ระยะวิ่ง</th>
                        <th className="numeric">จองแล้ว</th>
                        <th className="numeric">จำนวนที่รับ</th>
                        <th className="numeric">ที่ว่าง</th>
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
                  <h2>สถานะออเดอร์</h2>
                  <p>ออเดอร์อยู่ขั้นไหนบ้าง</p>
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
                    label: statusLabels.paid,
                    count: data.orders.paid,
                    className: "green",
                    icon: Check,
                  },
                  {
                    label: statusLabels.slip_uploaded,
                    count: data.orders.slip_uploaded,
                    className: "orange",
                    icon: ScanLine,
                  },
                  {
                    label: statusLabels.pending,
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
            <p>การสมัครที่เพิ่งเข้ามา และสถานะของแต่ละออเดอร์</p>
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
                    <th>เลขออเดอร์</th>
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
                          {order.participantCount} คน
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
              <EventCover event={event} compact />
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
