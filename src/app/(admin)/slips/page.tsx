"use client";

import { useState } from "react";
import {
  Clock3,
  ScanLine,
  CircleDollarSign,
  ArrowRight,
  CheckCheck,
} from "lucide-react";
import { useDemo } from "@/features/admin/demo-store";
import { date, money, type Order } from "@/features/admin/data";
import { OrderDetail } from "@/features/admin/order-detail";
import {
  Badge,
  EmptyState,
  PageHeading,
  StatCard,
  handleTabKeys,
} from "@/components/ui";

export default function SlipsPage() {
  const { orders, events, eventId } = useDemo();
  const [tab, setTab] = useState("waiting");
  const [selected, setSelected] = useState<string | null>(null);
  const scoped = orders.filter(
    (o) => eventId === "all" || o.eventId === eventId,
  );
  const waiting = scoped.filter((o) => o.status === "slip_uploaded");
  const history = scoped.filter((o) => o.reviewedAt);
  const nextWaiting = waiting.toSorted((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  )[0];
  const filtered = (tab === "waiting" ? waiting : history).toSorted(
    (a: Order, b: Order) => a.createdAt.localeCompare(b.createdAt),
  );
  return (
    <>
      <PageHeading
        title="ตรวจสลิป"
        description="ตรวจสอบหลักฐานและยืนยันสิทธิ์ผู้สมัคร เรียงจากออเดอร์เก่าไปใหม่"
        action={
          <button
            className="button primary"
            disabled={!nextWaiting}
            onClick={() => setSelected(nextWaiting.id)}
          >
            <ScanLine size={17} aria-hidden="true" />
            ตรวจรายการถัดไป
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        }
      />
      <div className="stats-grid three">
        <StatCard
          title="สลิปรอตรวจ"
          value={String(waiting.length)}
          note="รายการที่ยังไม่ได้ตรวจสอบ"
          icon={ScanLine}
          accent
        />
        <StatCard
          title="ยอดเงินรอตรวจ"
          value={money(waiting.reduce((s, o) => s + o.amount, 0))}
          note="ยังไม่รวมในยอดรับเงิน"
          icon={CircleDollarSign}
        />
        <StatCard
          title="ตรวจสอบแล้วในพื้นที่สาธิต"
          value={String(history.length)}
          note="ดูผลตรวจได้ที่ประวัติการตรวจ"
          icon={CheckCheck}
        />
      </div>
      <section className="panel">
        <div
          className="tabs"
          role="tablist"
          aria-label="คิวตรวจสลิป"
          onKeyDown={handleTabKeys}
        >
          <button
            id="waiting-tab"
            role="tab"
            aria-selected={tab === "waiting"}
            tabIndex={tab === "waiting" ? 0 : -1}
            aria-controls="slips-panel"
            onClick={() => setTab("waiting")}
          >
            รอตรวจสอบ <span>{waiting.length}</span>
          </button>
          <button
            id="history-tab"
            role="tab"
            aria-selected={tab === "history"}
            tabIndex={tab === "history" ? 0 : -1}
            aria-controls="slips-panel"
            onClick={() => setTab("history")}
          >
            ประวัติการตรวจ <span>{history.length}</span>
          </button>
        </div>
        <div id="slips-panel" role="tabpanel" aria-labelledby={`${tab}-tab`}>
          {filtered.length ? (
            <div className="table-scroll">
              <table className="table-mobile-cards" role="table">
                <thead>
                  <tr>
                    <th>ออเดอร์ / ผู้ติดต่อ</th>
                    <th className="table-secondary">งานวิ่ง</th>
                    <th>ยอดที่ต้องชำระ</th>
                    <th className="table-secondary">เวลาสร้างออเดอร์</th>
                    <th>สถานะ</th>
                    <th>การตรวจสอบ</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((order) => (
                    <tr key={order.id}>
                      <td className="mobile-record">
                        <strong>{order.contact}</strong>
                        <small className="cell-sub">{order.id}</small>
                      </td>
                      <td className="table-secondary table-event">
                        {events.find((e) => e.id === order.eventId)?.name}
                      </td>
                      <td
                        className="strong mobile-amount"
                        data-label="ยอดที่ต้องชำระ"
                      >
                        {money(order.amount)}
                      </td>
                      <td className="table-secondary">
                        <span className="inline-icon muted">
                          <Clock3 size={14} aria-hidden="true" />
                          {date(order.createdAt, true)}
                        </span>
                      </td>
                      <td className="mobile-status">
                        <Badge status={order.status} />
                      </td>
                      <td className="mobile-action">
                        <button
                          className="button small-button"
                          onClick={() => setSelected(order.id)}
                        >
                          {tab === "waiting" ? "ตรวจสลิป" : "ดูผลตรวจ"}
                          <ArrowRight size={15} aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title={
                tab === "waiting"
                  ? "ไม่มีสลิปรอตรวจแล้ว"
                  : "ยังไม่มีประวัติการตรวจ"
              }
              description={
                tab === "waiting"
                  ? "เมื่อมีผู้สมัครส่งหลักฐาน รายการจะปรากฏที่นี่"
                  : "ลองตรวจสลิปสาธิตสักรายการเพื่อดูผลการตรวจ"
              }
            />
          )}
        </div>
      </section>
      <p className="page-note">
        สลิปในหน้านี้เป็นแบบจำลองเพื่อทดสอบ UX/UI
        ไม่มีการตรวจสอบธุรกรรมธนาคารจริง
      </p>
      {selected && (
        <OrderDetail
          orderId={selected}
          review={
            orders.find((order) => order.id === selected)?.status ===
            "slip_uploaded"
          }
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
