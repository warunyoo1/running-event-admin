"use client";

import { Download, Shirt } from "lucide-react";
import type { OrderStatus } from "@/lib/api/types";
import { SHIRT_SIZES } from "@/lib/constants";
import { number, statusLabels } from "@/features/admin/format";
import { ErrorState, LoadingState } from "./data-states";

const STATUSES: OrderStatus[] = ["pending", "slip_uploaded", "paid", "rejected", "expired", "cancelled"];

export function ShirtSizeSummary({ data, status, onStatusChange, loading, error, onRetry, exporting, onDownload }: {
  data: { total: number; sizes: { size: string; count: number }[] } | null;
  status: OrderStatus;
  onStatusChange: (status: OrderStatus) => void;
  loading: boolean;
  error: string;
  onRetry: () => void;
  exporting: boolean;
  onDownload: () => void;
}) {
  return <section className="panel shirt-summary" aria-label="จำนวนเสื้อตามไซซ์" aria-busy={loading}>
    <div className="panel-heading">
      <div><h2>จำนวนเสื้อตามไซซ์</h2><p>รวมทุกระยะวิ่งของงานที่เลือก</p></div>
      <Shirt size={19} aria-hidden="true" />
    </div>
    <div className="shirt-summary-content">
      <div className="shirt-summary-controls">
        <label>สถานะออเดอร์<select value={status} onChange={(event) => onStatusChange(event.target.value as OrderStatus)}>
          {STATUSES.map((value) => <option key={value} value={value}>{statusLabels[value]}</option>)}
        </select></label>
        <div className="shirt-total"><span>รวมทั้งหมด</span><strong>{data ? number(data.total) : "–"}<small>ตัว</small></strong></div>
      </div>
      {error && <ErrorState message={error} onRetry={onRetry} />}
      {!data && loading && <LoadingState />}
      {data && !error && (data.total > 0 ? <div className="shirt-size-list">
        {SHIRT_SIZES.map((size) => {
          const count = data.sizes.find((item) => item.size === size)?.count ?? 0;
          return <div className={`shirt-row ${count === 0 ? "is-zero" : ""}`} key={size}>
            <span className="size-box">{size}</span>
            <div><progress value={count} max={Math.max(1, data.total)} aria-label={`เสื้อไซซ์ ${size} ${number(count)} ตัว`} /></div>
            <strong>{number(count)}<small>ตัว</small></strong>
          </div>;
        })}
      </div> : <div className="shirt-empty" role="status">
        <span><Shirt size={24} aria-hidden="true" /></span>
        <strong>ยังไม่มีจำนวนเสื้อในสถานะนี้</strong>
        <p>ลองเลือกสถานะอื่น หรือกลับมาดูเมื่อมีผู้สมัคร</p>
      </div>)}
    </div>
    <div className="shirt-summary-footer">
      <button className="button" disabled={!data || data.total === 0 || loading || Boolean(error) || exporting} onClick={onDownload}>
        <Download size={16} aria-hidden="true" />{exporting ? "กำลังดาวน์โหลด…" : "ดาวน์โหลดจำนวนเสื้อ (CSV)"}
      </button>
    </div>
  </section>;
}
