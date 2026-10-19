"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Download, ArrowUpRight } from "lucide-react";
import { useScope } from "@/features/admin/scope-provider";
import { useAsync } from "@/features/admin/use-async";
import { useDebounced } from "@/features/admin/use-debounced";
import { useToast } from "@/features/admin/toast-provider";
import { date, exportLimitNotice, money, statusLabels } from "@/features/admin/format";
import { OrderDetail } from "@/features/admin/order-detail";
import { exportsApi, ordersApi } from "@/lib/api";
import { errorMessage } from "@/lib/api/errors";
import { EXPORT_LIMIT, PAGE_SIZE } from "@/lib/constants";
import type { OrderStatus } from "@/lib/api/types";
import { ErrorState, LoadingState, Pager } from "@/components/data-states";
import { Badge, EmptyState, PageHeading, SearchField } from "@/components/ui";

const ORDER_STATUSES: OrderStatus[] = [
  "pending",
  "slip_uploaded",
  "paid",
  "rejected",
  "expired",
  "cancelled",
];

export default function OrdersPage() {
  return (
    <Suspense>
      <Orders />
    </Suspense>
  );
}
function Orders() {
  const { scopeEventId } = useScope();
  const notify = useToast();
  const params = useSearchParams();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<OrderStatus | "">("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(params.get("order"));
  const [exporting, setExporting] = useState(false);
  const q = useDebounced(query.trim());
  const filters = { eventId: scopeEventId, status, q, from, to };
  const { data, error, loading, reload } = useAsync(
    (signal) =>
      ordersApi.listOrders({ ...filters, page, pageSize: PAGE_SIZE }, signal),
    [scopeEventId, status, q, from, to, page],
  );
  const rows = data?.data ?? [];

  async function download() {
    setExporting(true);
    try {
      const { rows: count } = await exportsApi.exportOrdersCsv(filters);
      if (count >= EXPORT_LIMIT) {
        notify(exportLimitNotice(EXPORT_LIMIT));
      }
    } catch (failure) {
      notify(errorMessage(failure));
    } finally {
      setExporting(false);
    }
  }
  const hasFilters = Boolean(query || status || from || to);
  function resetFilters() { setQuery(""); setStatus(""); setPage(1); setFrom(""); setTo(""); }
  function changeFilter(apply: () => void) {
    apply();
    setPage(1);
  }
  return (
    <>
      <PageHeading
        title="ออเดอร์"
        description="ออเดอร์คือการสมัคร 1 ครั้ง (อาจมีผู้สมัครหลายคน) ค้นหาและดูสถานะได้ที่นี่"
        action={
          <button
            className="button"
            onClick={download}
            disabled={!rows.length || exporting}
          >
            <Download size={16} aria-hidden="true" />
            ดาวน์โหลด CSV
          </button>
        }
      />
      <div className="panel">
        <div className="filter-bar in-panel">
          <SearchField
            value={query}
            onChange={(value) => changeFilter(() => setQuery(value))}
            placeholder="ค้นหาเลขออเดอร์ ชื่อ หรือเบอร์โทร"
          />
          <label>
            <span className="sr-only">สถานะออเดอร์</span>
            <select
              value={status}
              onChange={(e) =>
                changeFilter(() => setStatus(e.target.value as OrderStatus | ""))
              }
            >
              <option value="">ทุกสถานะ</option>
              {ORDER_STATUSES.map((s) => (
                <option value={s} key={s}>
                  {statusLabels[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="filter-date">
            <span>สมัครตั้งแต่วันที่</span>
            <input
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => changeFilter(() => setFrom(e.target.value))}
            />
          </label>
          <label className="filter-date">
            <span>สมัครถึงวันที่</span>
            <input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => changeFilter(() => setTo(e.target.value))}
            />
          </label>
          <span className="result-count">
            {data ? `${data.meta.total} ออเดอร์` : ""}
          </span>
        </div>
        {hasFilters && <div className="filter-bar in-panel"><button className="button" onClick={resetFilters}>ล้างตัวกรองทั้งหมด</button><span className="muted">กำลังแสดงผลตามตัวกรองที่เลือก</span></div>}
        {error && <ErrorState message={error} onRetry={reload} />}
        {!data && loading && <LoadingState />}
        {data &&
          (rows.length ? (
            <>
              <div className="table-scroll" tabIndex={0} role="region" aria-label="ตารางข้อมูล เลื่อนแนวนอนเพื่อดูคอลัมน์เพิ่มเติม" aria-busy={loading}>
                <table className="table-mobile-cards" role="table">
                  <thead>
                    <tr>
                      <th>เลขออเดอร์</th>
                      <th className="table-secondary">ผู้ติดต่อ</th>
                      <th className="table-secondary">งานวิ่ง</th>
                      <th className="numeric">ยอดชำระ</th>
                      <th>สถานะ</th>
                      <th className="table-secondary">วันที่สมัคร</th>
                      <th>
                        <span className="sr-only">รายละเอียด</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((o) => (
                      <tr key={o.id}>
                        <td className="mobile-record">
                          <button
                            className="order-link"
                            onClick={() => setSelected(o.id)}
                          >
                            {o.orderNo}
                          </button>
                          <span className="mobile-only mobile-contact">
                            {o.contactName}
                          </span>
                          <small className="cell-sub">
                            {o.participantCount} คน
                          </small>
                        </td>
                        <td className="table-secondary">
                          <span className="person-name">{o.contactName}</span>
                          <small className="cell-sub">{o.contactPhone}</small>
                        </td>
                        <td className="table-secondary table-event">
                          {o.eventName}
                        </td>
                        <td
                          className="numeric strong mobile-amount"
                          data-label="ยอดชำระ"
                        >
                          {money(o.amount)}
                        </td>
                        <td className="mobile-status">
                          <Badge status={o.status} />
                        </td>
                        <td className="muted table-secondary">
                          {date(o.createdAt)}
                        </td>
                        <td className="mobile-action">
                          <button
                            className="icon-button"
                            onClick={() => setSelected(o.id)}
                            aria-label={`ดูออเดอร์ ${o.orderNo}`}
                          >
                            <ArrowUpRight size={17} />
                          </button>
                          <button
                            className="button small-button mobile-only"
                            onClick={() => setSelected(o.id)}
                            aria-label={`ดูรายละเอียดออเดอร์ ${o.orderNo}`}
                          >
                            ดูรายละเอียด
                            <ArrowUpRight size={15} aria-hidden="true" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pager meta={data.meta} unit="ออเดอร์" onPage={setPage} />
            </>
          ) : (
            <EmptyState title="ไม่พบออเดอร์" action={hasFilters ? <button className="button" onClick={resetFilters}>ล้างตัวกรองทั้งหมด</button> : undefined} />
          ))}
      </div>
      {selected && (
        <OrderDetail
          orderId={selected}
          onChanged={reload}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
