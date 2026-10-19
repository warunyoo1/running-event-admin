"use client";

import { useState } from "react";
import {
  Clock3,
  ScanLine,
  CircleDollarSign,
  ArrowRight,
  CheckCheck,
} from "lucide-react";
import { useScope } from "@/features/admin/scope-provider";
import { useAsync } from "@/features/admin/use-async";
import { date, money, number } from "@/features/admin/format";
import { OrderDetail } from "@/features/admin/order-detail";
import { dashboardApi, slipsApi } from "@/lib/api";
import { PAGE_SIZE } from "@/lib/constants";
import type { SlipRow, SlipTab } from "@/lib/api/types";
import { ErrorState, LoadingState, Pager } from "@/components/data-states";
import {
  Badge,
  EmptyState,
  PageHeading,
  StatCard,
  handleTabKeys,
} from "@/components/ui";

export default function SlipsPage() {
  const { scopeEventId } = useScope();
  const [tab, setTab] = useState<SlipTab>("waiting");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<SlipRow | null>(null);
  const summary = useAsync(
    (signal) => dashboardApi.getDashboard(scopeEventId, signal),
    [scopeEventId],
  );
  const { data, error, loading, reload } = useAsync(
    (signal) =>
      slipsApi.listSlips(
        { eventId: scopeEventId, tab, page, pageSize: PAGE_SIZE },
        signal,
      ),
    [scopeEventId, tab, page],
  );
  const rows = data?.data ?? [];
  const next = tab === "waiting" ? rows[0] : undefined;
  const counts = summary.data;

  function changeTab(value: SlipTab) {
    setTab(value);
    setPage(1);
  }
  function changed() {
    reload();
    summary.reload();
  }
  return (
    <>
      <PageHeading
        title="ตรวจสลิป"
        description="ดูสลิปที่ผู้สมัครส่งมา แล้วอนุมัติหรือปฏิเสธ เรียงจากเก่าสุดไปใหม่สุด"
        action={
          <button
            className="button primary"
            disabled={!next}
            onClick={() => next && setSelected(next)}
          >
            <ScanLine size={17} aria-hidden="true" />
            ตรวจสลิปถัดไป
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        }
      />
      <div className="stats-grid three">
        <StatCard
          title="สลิปรอตรวจ"
          value={counts ? number(counts.pendingReview) : "–"}
          note="ยังไม่ได้ตรวจ"
          icon={ScanLine}
          accent
        />
        <StatCard
          title="ชำระเงินแล้ว"
          value={counts ? number(counts.orders.paid) : "–"}
          note="ออเดอร์ที่อนุมัติสลิปแล้ว"
          icon={CheckCheck}
        />
        <StatCard
          title="ยอดเงินที่รับแล้ว"
          value={counts ? money(counts.paidRevenue) : "–"}
          note="รวมจากออเดอร์ที่อนุมัติสลิปแล้ว"
          icon={CircleDollarSign}
        />
      </div>
      <section className="panel">
        <div
          className="tabs"
          role="tablist"
          aria-label="รายการสลิป"
          onKeyDown={handleTabKeys}
        >
          <button
            id="waiting-tab"
            role="tab"
            aria-selected={tab === "waiting"}
            tabIndex={tab === "waiting" ? 0 : -1}
            aria-controls="slips-panel"
            onClick={() => changeTab("waiting")}
          >
            รอตรวจ
            {counts && <span>{counts.pendingReview}</span>}
          </button>
          <button
            id="history-tab"
            role="tab"
            aria-selected={tab === "history"}
            tabIndex={tab === "history" ? 0 : -1}
            aria-controls="slips-panel"
            onClick={() => changeTab("history")}
          >
            ประวัติการตรวจ
            {tab === "history" && data && <span>{data.meta.total}</span>}
          </button>
        </div>
        <div id="slips-panel" role="tabpanel" aria-labelledby={`${tab}-tab`}>
          {error && <ErrorState message={error} onRetry={reload} />}
          {!data && loading && <LoadingState />}
          {data &&
            (rows.length ? (
              <>
                <div className="table-scroll" aria-busy={loading}>
                  <table className="table-mobile-cards" role="table">
                    <thead>
                      <tr>
                        <th>ผู้ติดต่อ / เลขออเดอร์</th>
                        <th className="table-secondary">งานวิ่ง</th>
                        <th>ยอดที่ต้องชำระ</th>
                        <th className="table-secondary">เวลาส่งสลิป</th>
                        <th>สถานะ</th>
                        <th>จัดการ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.orderId}>
                          <td className="mobile-record">
                            <strong>{row.contactName}</strong>
                            <small className="cell-sub">{row.orderNo}</small>
                          </td>
                          <td className="table-secondary table-event">
                            {row.eventName}
                          </td>
                          <td
                            className="strong mobile-amount"
                            data-label="ยอดที่ต้องชำระ"
                          >
                            {money(row.amount)}
                          </td>
                          <td className="table-secondary">
                            <span className="inline-icon muted">
                              <Clock3 size={14} aria-hidden="true" />
                              {row.slipUploadedAt
                                ? date(row.slipUploadedAt, true)
                                : "–"}
                            </span>
                          </td>
                          <td className="mobile-status">
                            <Badge status={row.status} />
                          </td>
                          <td className="mobile-action">
                            <button
                              className="button small-button"
                              onClick={() => setSelected(row)}
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
                <Pager meta={data.meta} unit="รายการ" onPage={setPage} />
              </>
            ) : (
              <EmptyState
                title={
                  tab === "waiting"
                    ? "ไม่มีสลิปรอตรวจแล้ว"
                    : "ยังไม่มีประวัติการตรวจ"
                }
                description={
                  tab === "waiting"
                    ? "เมื่อผู้สมัครส่งสลิปเข้ามา รายการจะแสดงที่นี่"
                    : "สลิปที่ตรวจแล้วจะแสดงที่นี่"
                }
              />
            ))}
        </div>
      </section>
      {selected && (
        <OrderDetail
          orderId={selected.orderId}
          paymentId={selected.paymentId}
          review={selected.status === "slip_uploaded"}
          onChanged={changed}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
