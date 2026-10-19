"use client";

import { useState } from "react";
import {
  Download,
  CircleDollarSign,
  Users,
  Shirt,
  ClipboardList,
} from "lucide-react";
import { useScope } from "@/features/admin/scope-provider";
import { useAsync } from "@/features/admin/use-async";
import { useToast } from "@/features/admin/toast-provider";
import { exportLimitNotice, money, number, statusLabels } from "@/features/admin/format";
import { exportsApi, reportsApi } from "@/lib/api";
import { errorMessage } from "@/lib/api/errors";
import { EXPORT_LIMIT, SHIRT_SIZES } from "@/lib/constants";
import type { OrderStatus } from "@/lib/api/types";
import { ErrorState, LoadingState } from "@/components/data-states";
import { EmptyState, PageHeading, StatCard } from "@/components/ui";

const ORDER_STATUSES: OrderStatus[] = [
  "pending",
  "slip_uploaded",
  "paid",
  "rejected",
  "expired",
  "cancelled",
];

export default function ReportsPage() {
  const { scopeEventId } = useScope();
  const notify = useToast();
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [shirtStatus, setShirtStatus] = useState<OrderStatus>("paid");
  const [exporting, setExporting] = useState(false);
  const [exportingShirts, setExportingShirts] = useState(false);
  const invalidRange = Boolean(start && end && start > end);
  const summary = useAsync(
    (signal) =>
      invalidRange
        ? Promise.resolve(null)
        : reportsApi.getReportSummary(
            { eventId: scopeEventId, from: start, to: end },
            signal,
          ),
    [scopeEventId, start, end, invalidRange],
  );
  const shirts = useAsync(
    (signal) =>
      reportsApi.getShirtSizes({ eventId: scopeEventId, status: shirtStatus }, signal),
    [scopeEventId, shirtStatus],
  );
  const rows = summary.data?.rows ?? [];
  const paidParticipants = rows.reduce((sum, row) => sum + row.paidParticipants, 0);
  const shirtTotal = shirts.data?.total ?? 0;

  async function downloadReport() {
    setExporting(true);
    try {
      const { rows: count } = await exportsApi.exportOrdersCsv({
        eventId: scopeEventId,
        from: start,
        to: end,
      });
      if (count >= EXPORT_LIMIT) {
        notify(exportLimitNotice(EXPORT_LIMIT));
      }
    } catch (failure) {
      notify(errorMessage(failure));
    } finally {
      setExporting(false);
    }
  }
  async function downloadShirtSizes() {
    setExportingShirts(true);
    try {
      await exportsApi.exportShirtSizesCsv({
        eventId: scopeEventId,
        status: shirtStatus,
      });
    } catch (failure) {
      notify(errorMessage(failure));
    } finally {
      setExportingShirts(false);
    }
  }
  return (
    <>
      <PageHeading
        title="รายงาน"
        description="สรุปผู้สมัคร ยอดเงิน และจำนวนเสื้อแต่ละไซซ์ ไว้เตรียมงาน"
        action={
          <button
            className="button"
            disabled={invalidRange || exporting}
            onClick={downloadReport}
          >
            <Download size={16} aria-hidden="true" />
            ดาวน์โหลดออเดอร์ (CSV)
          </button>
        }
      />
      <div className="report-filters">
        <label>
          วันที่สมัครตั้งแต่
          <input
            type="date"
            value={start}
            max={end || undefined}
            onChange={(e) => setStart(e.target.value)}
          />
        </label>
        <span className="date-dash" aria-hidden="true">
          —
        </span>
        <label>
          ถึงวันที่
          <input
            type="date"
            value={end}
            min={start || undefined}
            onChange={(e) => setEnd(e.target.value)}
          />
        </label>
        <p>ยอดเงินคำนวณจากออเดอร์ที่ชำระแล้ว จำนวนเสื้อไม่ขึ้นกับช่วงวันที่</p>
      </div>
      {invalidRange && (
        <p role="alert" className="form-error">
          วันที่เริ่มต้องไม่เลยวันที่สิ้นสุด กรุณาเลือกใหม่
        </p>
      )}
      {summary.error && (
        <ErrorState message={summary.error} onRetry={summary.reload} />
      )}
      {!summary.data && summary.loading && <LoadingState />}
      <div className="stats-grid three">
        <StatCard
          title="ยอดเงินที่รับแล้ว"
          value={summary.data ? money(summary.data.totals.paidRevenue) : "–"}
          note="รวมค่าจัดส่ง ยังไม่หักต้นทุน"
          icon={CircleDollarSign}
          accent
        />
        <StatCard
          title="ผู้สมัครที่ชำระเงินแล้ว"
          value={summary.data ? number(paidParticipants) : "–"}
          note={`จาก ${summary.data ? number(summary.data.totals.paidOrders) : "–"} ออเดอร์`}
          icon={Users}
        />
        <StatCard
          title="เสื้อที่ต้องเตรียม"
          value={shirts.data ? `${number(shirtTotal)} ตัว` : "–"}
          note={`นับเฉพาะออเดอร์สถานะ “${statusLabels[shirtStatus]}”`}
          icon={Shirt}
        />
      </div>
      <div className="reports-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>สรุปตามระยะวิ่ง</h2>
              <p>จำนวนผู้สมัครและจำนวนที่ชำระเงินแล้วของแต่ละระยะ</p>
            </div>
            <ClipboardList size={19} aria-hidden="true" />
          </div>
          {summary.data &&
            (rows.length ? (
              <div className="table-scroll" aria-busy={summary.loading}>
                <table>
                  <thead>
                    <tr>
                      <th>งานวิ่ง</th>
                      <th>ระยะวิ่ง</th>
                      <th className="numeric">ผู้สมัคร</th>
                      <th className="numeric">ชำระแล้ว</th>
                      <th className="numeric">ยอดเงิน</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={`${row.eventId}-${row.race}`}>
                        <td>{row.eventName}</td>
                        <td>
                          <span className="race-chip">{row.race}</span>
                        </td>
                        <td className="numeric">{number(row.participants)}</td>
                        <td className="numeric strong">
                          {number(row.paidParticipants)}
                        </td>
                        <td className="numeric muted">{money(row.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState />
            ))}
        </section>
        <section className="panel shirt-summary">
          <div className="panel-heading">
            <div>
              <h2>จำนวนเสื้อตามไซซ์</h2>
              <p>รวมทุกระยะวิ่งของงานที่เลือก</p>
            </div>
            <Shirt size={19} aria-hidden="true" />
          </div>
          <label>
            สถานะออเดอร์
            <select
              value={shirtStatus}
              onChange={(e) => setShirtStatus(e.target.value as OrderStatus)}
            >
              {ORDER_STATUSES.map((s) => (
                <option value={s} key={s}>
                  {statusLabels[s]}
                </option>
              ))}
            </select>
          </label>
          {shirts.error && (
            <ErrorState message={shirts.error} onRetry={shirts.reload} />
          )}
          {!shirts.data && shirts.loading && <LoadingState />}
          {shirts.data && (
            <>
              {SHIRT_SIZES.map((size) => {
                const count =
                  shirts.data?.sizes.find((item) => item.size === size)?.count ?? 0;
                return (
                  <div className="shirt-row" key={size}>
                    <span className="size-box">{size}</span>
                    <div>
                      <progress
                        value={count}
                        max={Math.max(1, shirtTotal)}
                        aria-label={`เสื้อไซซ์ ${size} ${count} ตัว`}
                      />
                    </div>
                    <strong>
                      {number(count)}
                      <small>ตัว</small>
                    </strong>
                  </div>
                );
              })}
              <button
                className="button"
                disabled={exportingShirts}
                onClick={downloadShirtSizes}
              >
                <Download size={15} aria-hidden="true" />
                ดาวน์โหลดจำนวนเสื้อ (CSV)
              </button>
            </>
          )}
        </section>
      </div>
      <p className="page-note">วันที่แสดงตามเวลาประเทศไทย</p>
    </>
  );
}
