"use client";

import { useState } from "react";
import {
  Download,
  CircleDollarSign,
  Users,
  Shirt,
  ClipboardList,
} from "lucide-react";
import { useDemo } from "@/features/admin/demo-store";
import { exportCsv, money, statusLabels } from "@/features/admin/data";
import { EmptyState, PageHeading, StatCard } from "@/components/ui";

export default function ReportsPage() {
  const { orders, events, eventId } = useDemo();
  const [start, setStart] = useState("2026-10-01");
  const [end, setEnd] = useState("2026-10-31");
  const invalidRange = Boolean(start && end && start > end);
  const scoped = orders.filter(
    (o) =>
      !invalidRange &&
      (eventId === "all" || o.eventId === eventId) &&
      (!start || o.createdAt.slice(0, 10) >= start) &&
      (!end || o.createdAt.slice(0, 10) <= end),
  );
  const paid = scoped.filter((o) => o.status === "paid");
  const participants = paid.flatMap((o) => o.participants);
  const sizes = ["S", "M", "L", "XL"];
  const raceRows = events
    .filter((e) => eventId === "all" || e.id === eventId)
    .flatMap((e) =>
      e.races.map((r) => ({
        event: e.name,
        race: r.name,
        count: paid
          .filter((o) => o.eventId === e.id)
          .flatMap((o) => o.participants)
          .filter((p) => p.race === r.name).length,
        quota: r.quota,
      })),
    );
  const amount = paid.reduce((sum, o) => sum + o.amount, 0);
  return (
    <>
      <PageHeading
        title="รายงาน"
        description="สรุปยอดสมัคร ยอดรับเงิน และจำนวนเสื้อเพื่อเตรียมงาน"
        action={
          <button
            className="button"
            disabled={!scoped.length}
            onClick={() =>
              exportCsv("report-demo.csv", [
                [
                  "ออเดอร์",
                  "งานวิ่ง",
                  "วันที่สมัคร",
                  "ผู้สมัคร",
                  "ยอดชำระ",
                  "สถานะ",
                ],
                ...scoped.map((o) => [
                  o.id,
                  events.find((e) => e.id === o.eventId)?.name ?? "",
                  o.createdAt.slice(0, 10),
                  o.participants.length,
                  o.amount,
                  statusLabels[o.status],
                ]),
              ])
            }
          >
            <Download size={16} aria-hidden="true" />
            ส่งออกรายงาน
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
        <p>ยอดเงินและจำนวนเสื้อคำนวณจากออเดอร์ที่ชำระแล้ว</p>
      </div>
      {invalidRange && (
        <p role="alert" className="form-error">
          วันที่เริ่มต้นต้องไม่อยู่หลังวันที่สิ้นสุด
        </p>
      )}
      <div className="stats-grid three">
        <StatCard
          title="ยอดชำระเงินแล้ว"
          value={money(amount)}
          note="รวมค่าจัดส่ง ไม่ใช่กำไรสุทธิ"
          icon={CircleDollarSign}
          accent
        />
        <StatCard
          title="ผู้สมัครที่ชำระเงินแล้ว"
          value={String(participants.length)}
          note={`จาก ${paid.length} ออเดอร์`}
          icon={Users}
        />
        <StatCard
          title="เสื้อที่ต้องเตรียม"
          value={`${participants.length} ตัว`}
          note="สำหรับผู้สมัครที่ชำระเงินแล้ว"
          icon={Shirt}
        />
      </div>
      <div className="reports-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>สรุปผู้สมัครตามระยะ</h2>
              <p>จำนวนที่ยืนยันการชำระเงินแล้ว</p>
            </div>
            <ClipboardList size={19} aria-hidden="true" />
          </div>
          {raceRows.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>งานวิ่ง</th>
                    <th>ระยะ</th>
                    <th className="numeric">ยืนยันแล้ว</th>
                    <th className="numeric">โควตา</th>
                  </tr>
                </thead>
                <tbody>
                  {raceRows.map((row) => (
                    <tr key={`${row.event}-${row.race}`}>
                      <td>{row.event}</td>
                      <td>
                        <span className="race-chip">{row.race}</span>
                      </td>
                      <td className="numeric strong">{row.count}</td>
                      <td className="numeric muted">{row.quota}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState />
          )}
        </section>
        <section className="panel shirt-summary">
          <div className="panel-heading">
            <div>
              <h2>จำนวนเสื้อตามไซซ์</h2>
              <p>รวมทุกระยะในตัวกรองนี้</p>
            </div>
            <Shirt size={19} aria-hidden="true" />
          </div>
          {sizes.map((size) => {
            const count = participants.filter((p) => p.size === size).length;
            return (
              <div className="shirt-row" key={size}>
                <span className="size-box">{size}</span>
                <div>
                  <progress
                    value={count}
                    max={Math.max(1, participants.length)}
                    aria-label={`เสื้อไซซ์ ${size} ${count} ตัว`}
                  />
                </div>
                <strong>
                  {count}
                  <small>ตัว</small>
                </strong>
              </div>
            );
          })}
          <button
            className="button"
            onClick={() =>
              exportCsv("shirt-sizes-demo.csv", [
                ["ไซซ์เสื้อ", "จำนวน"],
                ...sizes.map((size) => [
                  size,
                  participants.filter((p) => p.size === size).length,
                ]),
              ])
            }
          >
            <Download size={15} aria-hidden="true" />
            ส่งออกจำนวนเสื้อ
          </button>
        </section>
      </div>
      <p className="page-note">
        วันที่ใช้เขตเวลาประเทศไทย ·
        รายงานนี้เป็นข้อมูลสาธิตเพื่อเตรียมรูปแบบการเชื่อมต่อ API
      </p>
    </>
  );
}
