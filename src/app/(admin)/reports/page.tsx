"use client";

import { useState } from "react";
import {
  Download,
  CircleDollarSign,
  Users,
  ClipboardList,
} from "lucide-react";
import { useScope } from "@/features/admin/scope-provider";
import { useAsync } from "@/features/admin/use-async";
import { useToast } from "@/features/admin/toast-provider";
import { exportLimitNotice, money, number } from "@/features/admin/format";
import { exportsApi, reportsApi } from "@/lib/api";
import { errorMessage } from "@/lib/api/errors";
import { EXPORT_LIMIT } from "@/lib/constants";
import type { OrderStatus } from "@/lib/api/types";
import { ErrorState, LoadingState } from "@/components/data-states";
import { ShirtSizeSummary } from "@/components/shirt-size-summary";
import { EmptyState, PageHeading, StatCard } from "@/components/ui";

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
  const participants = rows.reduce((sum, row) => sum + row.participants, 0);
  const raceRevenue = rows.reduce((sum, row) => sum + row.revenue, 0);
  const summaryReady = !invalidRange && !summary.loading && !summary.error && Boolean(summary.data);

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
    <div className="reports-page">
      <PageHeading title="รายงาน" description="สรุปผลการสมัครและเตรียมจำนวนเสื้อสำหรับงานที่เลือก" />
      <section className="report-registration" aria-labelledby="registration-report-title">
        <div className="report-section-heading">
          <div><h2 id="registration-report-title">สรุปการสมัคร</h2><p>กรองตามวันที่สมัครของออเดอร์</p></div>
          <button className="button" disabled={!summaryReady || exporting} onClick={downloadReport}>
            <Download size={16} aria-hidden="true" />{exporting ? "กำลังดาวน์โหลด…" : "ดาวน์โหลดรายการออเดอร์ (CSV)"}
          </button>
        </div>
        <div className="report-date-toolbar">
          <label>สมัครตั้งแต่วันที่<input type="date" value={start} max={end || undefined} aria-invalid={invalidRange} aria-describedby={invalidRange ? "report-date-error" : undefined} onChange={(e) => setStart(e.target.value)} /></label>
          <label>ถึงวันที่<input type="date" value={end} min={start || undefined} aria-invalid={invalidRange} aria-describedby={invalidRange ? "report-date-error" : undefined} onChange={(e) => setEnd(e.target.value)} /></label>
          {(start || end) && <button className="button" onClick={() => { setStart(""); setEnd(""); }}>ล้างช่วงวันที่</button>}
          <span className="report-range-note">{start || end ? "แสดงเฉพาะช่วงวันที่เลือก" : "แสดงทุกช่วงวันที่"}</span>
        </div>
        {invalidRange && <p id="report-date-error" role="alert" className="form-error">วันที่เริ่มต้องไม่เลยวันที่สิ้นสุด กรุณาเลือกใหม่</p>}
        {summary.error && !invalidRange && <ErrorState message={summary.error} onRetry={summary.reload} />}
        {summary.loading && !invalidRange && <LoadingState />}
        <div className="report-statistics" aria-busy={summary.loading}>
          <StatCard title="ยอดเงินที่รับแล้ว" value={summaryReady ? money(summary.data!.totals.paidRevenue) : "–"} note="รวมค่าจัดส่ง ยังไม่หักต้นทุน" icon={CircleDollarSign} accent />
          <StatCard title="ผู้สมัครที่ชำระเงินแล้ว" value={summaryReady ? number(paidParticipants) : "–"} note={summaryReady ? `จาก ${number(summary.data!.totals.paidOrders)} ออเดอร์ ตามช่วงวันที่สมัคร` : "ตามช่วงวันที่สมัคร"} icon={Users} />
        </div>
        <section className="panel report-races" aria-labelledby="race-report-title">
          <div className="panel-heading"><div><h2 id="race-report-title">สรุปตามระยะวิ่ง</h2><p>ยอดเงินในตารางไม่รวมค่าจัดส่ง · CSV ด้านบนเป็นรายการออเดอร์</p></div><ClipboardList size={19} aria-hidden="true" /></div>
          {summaryReady && (rows.length ? <div className="table-scroll report-table-scroll" tabIndex={0} role="region" aria-label="ตารางสรุปตามระยะวิ่ง เลื่อนเพื่อดูรายการเพิ่มเติม">
            <table><thead><tr><th scope="col">งานวิ่ง</th><th scope="col">ระยะวิ่ง</th><th scope="col" className="numeric">ผู้สมัคร</th><th scope="col" className="numeric">ชำระแล้ว</th><th scope="col" className="numeric">ยอดเงิน</th></tr></thead>
              <tbody>{rows.map((row) => <tr key={`${row.eventId}-${row.race}`}><td>{row.eventName}</td><td><span className="race-chip">{row.race}</span></td><td className="numeric">{number(row.participants)}</td><td className="numeric strong">{number(row.paidParticipants)}</td><td className="numeric">{money(row.revenue)}</td></tr>)}</tbody>
              <tfoot><tr><th scope="row" colSpan={2}>รวมทุกระยะ</th><td className="numeric">{number(participants)}</td><td className="numeric">{number(paidParticipants)}</td><td className="numeric">{money(raceRevenue)}</td></tr></tfoot>
            </table>
          </div> : <EmptyState title="ไม่พบการสมัครในช่วงวันที่นี้" description="ลองเปลี่ยนช่วงวันที่ หรือเลือกงานวิ่งอื่น" action={start || end ? <button className="button" onClick={() => { setStart(""); setEnd(""); }}>แสดงทุกช่วงวันที่</button> : undefined} />)}
          {!summaryReady && <p className="report-table-placeholder">{invalidRange ? "เลือกช่วงวันที่ให้ถูกต้องเพื่อดูข้อมูล" : summary.error ? "โหลดรายงานไม่สำเร็จ กรุณาลองอีกครั้ง" : "กำลังอัปเดตข้อมูลตามตัวกรอง…"}</p>}
        </section>
      </section>
      <section className="report-shirts" aria-labelledby="shirt-report-title">
        <div className="report-section-heading"><div><h2 id="shirt-report-title">เตรียมเสื้อสำหรับงาน</h2><p>ใช้สถานะออเดอร์ด้านล่าง · ไม่ขึ้นกับช่วงวันที่สมัครด้านบน</p></div></div>
        <ShirtSizeSummary data={shirts.loading || shirts.error ? null : shirts.data} status={shirtStatus} onStatusChange={setShirtStatus} loading={shirts.loading} error={shirts.error} onRetry={shirts.reload} exporting={exportingShirts} onDownload={downloadShirtSizes} />
      </section>
      <p className="page-note">วันที่แสดงตามเวลาประเทศไทย</p>
    </div>
  );
}
