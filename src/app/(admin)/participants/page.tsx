"use client";

import { useState } from "react";
import { Download, Users } from "lucide-react";
import { useDemo } from "@/features/admin/demo-store";
import { exportCsv, statusLabels } from "@/features/admin/data";
import { Badge, EmptyState, PageHeading, SearchField } from "@/components/ui";

export default function ParticipantsPage() {
  const { events, orders, eventId } = useDemo();
  const [query, setQuery] = useState("");
  const [onlyPaid, setOnlyPaid] = useState(false);
  const participants = orders
    .filter(
      (o) =>
        (eventId === "all" || o.eventId === eventId) &&
        !["expired", "cancelled"].includes(o.status) &&
        (!onlyPaid || o.status === "paid"),
    )
    .flatMap((order) => order.participants.map((p) => ({ ...p, order })));
  const filtered = participants.filter((p) =>
    `${p.name} ${p.bib} ${p.order.id}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <>
      <PageHeading
        title="ผู้สมัคร"
        description="รายชื่อผู้สมัครที่ยังมีสิทธิ์ แยกตามงานวิ่ง ระยะ และไซซ์เสื้อ"
        action={
          <button
            className="button"
            disabled={!filtered.length}
            onClick={() =>
              exportCsv("participants-demo.csv", [
                [
                  "ชื่อผู้สมัคร",
                  "งานวิ่ง",
                  "ระยะ",
                  "ไซซ์เสื้อ",
                  "เลข BIB",
                  "ออเดอร์",
                  "สถานะ",
                ],
                ...filtered.map((p) => [
                  p.name,
                  events.find((e) => e.id === p.order.eventId)?.name ?? "",
                  p.race,
                  p.size,
                  p.bib,
                  p.order.id,
                  statusLabels[p.order.status],
                ]),
              ])
            }
          >
            <Download size={16} aria-hidden="true" />
            ส่งออกรายชื่อ
          </button>
        }
      />
      <div className="section-info">
        <Users size={20} aria-hidden="true" />
        <span>
          ทั้งหมด <strong>{filtered.length} คน</strong> ในตัวกรองนี้
        </span>
        <span className="muted">ไม่รวมออเดอร์ที่ยกเลิกหรือหมดอายุ</span>
      </div>
      <section className="panel">
        <div className="filter-bar in-panel">
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder="ค้นหาชื่อ เลข BIB หรือออเดอร์"
          />
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={onlyPaid}
              onChange={(e) => setOnlyPaid(e.target.checked)}
            />
            เฉพาะผู้ชำระเงินแล้ว
          </label>
        </div>
        {filtered.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>ผู้สมัคร</th>
                  <th>งานวิ่ง</th>
                  <th>ระยะ</th>
                  <th>ไซซ์เสื้อ</th>
                  <th>เลข BIB</th>
                  <th>ออเดอร์</th>
                  <th>สถานะชำระเงิน</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div className="person-cell">
                        <span className="avatar small">
                          {p.name.slice(0, 1)}
                        </span>
                        <strong>{p.name}</strong>
                      </div>
                    </td>
                    <td>
                      {events.find((e) => e.id === p.order.eventId)?.name}
                    </td>
                    <td>
                      <span className="race-chip">{p.race}</span>
                    </td>
                    <td>{p.size}</td>
                    <td className="numeric-left">{p.bib || "ยังไม่กำหนด"}</td>
                    <td className="muted">{p.order.id}</td>
                    <td>
                      <Badge status={p.order.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="ไม่พบผู้สมัคร" />
        )}
      </section>
      <p className="page-note">
        ข้อมูลส่วนบุคคลในพื้นที่นี้เป็นข้อมูลสมมติ รายการ export
        ไม่รวมข้อมูลสุขภาพหรือเลขประจำตัว
      </p>
    </>
  );
}
