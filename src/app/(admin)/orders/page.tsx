"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Download,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
} from "lucide-react";
import { useDemo } from "@/features/admin/demo-store";
import {
  date,
  exportCsv,
  money,
  statusLabels,
  type OrderStatus,
} from "@/features/admin/data";
import { OrderDetail } from "@/features/admin/order-detail";
import { Badge, EmptyState, PageHeading, SearchField } from "@/components/ui";

export default function OrdersPage() {
  return (
    <Suspense>
      <Orders />
    </Suspense>
  );
}
function Orders() {
  const { events, orders, eventId } = useDemo();
  const params = useSearchParams();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(params.get("order"));
  const filtered = orders.filter(
    (o) =>
      (eventId === "all" || o.eventId === eventId) &&
      (status === "all" || o.status === status) &&
      `${o.id} ${o.contact} ${o.phone}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / 8));
  const currentPage = Math.min(page, pages);
  function download() {
    exportCsv("orders-demo.csv", [
      [
        "หมายเลขออเดอร์",
        "ผู้ติดต่อ",
        "งานวิ่ง",
        "จำนวนผู้สมัคร",
        "ยอดชำระ",
        "สถานะ",
        "วันที่สมัคร",
      ],
      ...filtered.map((o) => [
        o.id,
        o.contact,
        events.find((e) => e.id === o.eventId)?.name ?? "",
        o.participants.length,
        o.amount,
        statusLabels[o.status],
        date(o.createdAt),
      ]),
    ]);
  }
  return (
    <>
      <PageHeading
        title="ออเดอร์"
        description="ค้นหาและติดตามการสมัคร ตั้งแต่สร้างออเดอร์จนถึงชำระเงิน"
        action={
          <button
            className="button"
            onClick={download}
            disabled={!filtered.length}
          >
            <Download size={16} aria-hidden="true" />
            ส่งออก CSV
          </button>
        }
      />
      <div className="panel">
        <div className="filter-bar in-panel">
          <SearchField
            value={query}
            onChange={(value) => {
              setQuery(value);
              setPage(1);
            }}
            placeholder="ค้นหาเลขออเดอร์ ชื่อ หรือเบอร์โทร"
          />
          <label>
            <span className="sr-only">สถานะออเดอร์</span>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">ทุกสถานะ</option>
              {(
                [
                  "pending",
                  "slip_uploaded",
                  "paid",
                  "rejected",
                  "expired",
                  "cancelled",
                ] as OrderStatus[]
              ).map((s) => (
                <option value={s} key={s}>
                  {statusLabels[s]}
                </option>
              ))}
            </select>
          </label>
          <span className="result-count">{filtered.length} ออเดอร์</span>
        </div>
        {filtered.length ? (
          <>
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
                    <th>
                      <span className="sr-only">รายละเอียด</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered
                    .slice((currentPage - 1) * 8, currentPage * 8)
                    .map((o) => (
                      <tr key={o.id}>
                        <td className="mobile-record">
                          <button
                            className="order-link"
                            onClick={() => setSelected(o.id)}
                          >
                            {o.id}
                          </button>
                          <span className="mobile-only mobile-contact">
                            {o.contact}
                          </span>
                          <small className="cell-sub">
                            {o.participants.length} ผู้สมัคร
                          </small>
                        </td>
                        <td className="table-secondary">
                          <span className="person-name">{o.contact}</span>
                          <small className="cell-sub">{o.phone}</small>
                        </td>
                        <td className="table-secondary table-event">
                          {events.find((e) => e.id === o.eventId)?.name}
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
                            aria-label={`ดูออเดอร์ ${o.id}`}
                          >
                            <ArrowUpRight size={17} />
                          </button>
                          <button
                            className="button small-button mobile-only"
                            onClick={() => setSelected(o.id)}
                            aria-label={`ดูรายละเอียดออเดอร์ ${o.id}`}
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
            <div className="pagination">
              <span>
                แสดง {(currentPage - 1) * 8 + 1}–
                {Math.min(currentPage * 8, filtered.length)} จาก{" "}
                {filtered.length} ออเดอร์
              </span>
              <div>
                <button
                  className="icon-button"
                  disabled={currentPage === 1}
                  onClick={() => setPage(currentPage - 1)}
                  aria-label="หน้าก่อนหน้า"
                >
                  <ChevronLeft size={18} />
                </button>
                <span>
                  หน้า {currentPage} / {pages}
                </span>
                <button
                  className="icon-button"
                  disabled={currentPage === pages}
                  onClick={() => setPage(currentPage + 1)}
                  aria-label="หน้าถัดไป"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <EmptyState title="ไม่พบออเดอร์" />
        )}
      </div>
      {selected && (
        <OrderDetail orderId={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}
