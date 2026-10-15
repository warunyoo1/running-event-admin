"use client";

import { useState, type FormEvent } from "react";
import { Download, PackageCheck, Save, Truck } from "lucide-react";
import { useDemo } from "@/features/admin/demo-store";
import { exportCsv } from "@/features/admin/data";
import {
  EmptyState,
  Modal,
  PageHeading,
  SearchField,
  handleTabKeys,
} from "@/components/ui";

export default function ShippingPage() {
  const { orders, events, eventId, updateOrder, notify } = useDemo();
  const [tab, setTab] = useState("pickup");
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tracking, setTracking] = useState("");
  const paid = orders.filter(
    (o) => o.status === "paid" && (eventId === "all" || o.eventId === eventId),
  );
  const filtered = paid.filter(
    (o) =>
      o.delivery === tab &&
      `${o.contact} ${o.id} ${o.tracking} ${o.participants.map((p) => `${p.name} ${p.bib}`).join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (editingId) updateOrder(editingId, { tracking: tracking.trim() });
    notify("บันทึกเลขพัสดุสาธิตแล้ว");
    setEditingId(null);
  }
  return (
    <>
      <PageHeading
        title="รับอุปกรณ์และจัดส่ง"
        description="จัดการเสื้อและบิบสำหรับออเดอร์ที่ชำระเงินแล้ว"
        action={
          <button
            className="button"
            disabled={!filtered.length}
            onClick={() =>
              exportCsv("fulfillment-demo.csv", [
                [
                  "ออเดอร์",
                  "ผู้ติดต่อ",
                  "งานวิ่ง",
                  "วิธีรับ",
                  "ที่อยู่",
                  "เลขพัสดุ",
                  "ผู้สมัคร",
                  "ไซซ์เสื้อ",
                  "รับอุปกรณ์แล้ว",
                ],
                ...filtered.flatMap((o) =>
                  o.participants.map((p) => [
                    o.id,
                    o.contact,
                    events.find((e) => e.id === o.eventId)?.name ?? "",
                    o.delivery === "pickup" ? "รับด้วยตนเอง" : "จัดส่ง",
                    o.address,
                    o.tracking,
                    p.name,
                    p.size,
                    p.collected ? "รับแล้ว" : "ยังไม่รับ",
                  ]),
                ),
              ])
            }
          >
            <Download size={16} aria-hidden="true" />
            ส่งออกรายการ
          </button>
        }
      />
      <section className="panel">
        <div
          className="tabs"
          role="tablist"
          aria-label="วิธีรับอุปกรณ์"
          onKeyDown={handleTabKeys}
        >
          <button
            id="pickup-tab"
            role="tab"
            aria-selected={tab === "pickup"}
            tabIndex={tab === "pickup" ? 0 : -1}
            aria-controls="fulfillment-panel"
            onClick={() => setTab("pickup")}
          >
            <PackageCheck size={17} aria-hidden="true" />
            รับด้วยตนเอง
            <span>{paid.filter((o) => o.delivery === "pickup").length}</span>
          </button>
          <button
            id="shipping-tab"
            role="tab"
            aria-selected={tab === "shipping"}
            tabIndex={tab === "shipping" ? 0 : -1}
            aria-controls="fulfillment-panel"
            onClick={() => setTab("shipping")}
          >
            <Truck size={17} aria-hidden="true" />
            จัดส่งพัสดุ
            <span>{paid.filter((o) => o.delivery === "shipping").length}</span>
          </button>
        </div>
        <div className="filter-bar in-panel">
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder="ค้นหาชื่อ เลข BIB ออเดอร์ หรือเลขพัสดุ"
          />
          <span className="result-count">{filtered.length} ออเดอร์</span>
        </div>
        <div
          id="fulfillment-panel"
          role="tabpanel"
          aria-labelledby={`${tab}-tab`}
        >
          {filtered.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>ออเดอร์</th>
                    <th>
                      {tab === "pickup"
                        ? "ผู้สมัคร / ไซซ์เสื้อ"
                        : "ผู้ติดต่อ / ที่อยู่จัดส่ง"}
                    </th>
                    <th>งานวิ่ง</th>
                    <th>{tab === "pickup" ? "สถานะรับอุปกรณ์" : "เลขพัสดุ"}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((order) => (
                    <tr key={order.id}>
                      <td className="strong">{order.id}</td>
                      <td>
                        {tab === "pickup" ? (
                          order.participants.map((p) => (
                            <div className="pickup-person" key={p.id}>
                              <strong>{p.name}</strong>
                              <small>
                                {p.race} · เสื้อ {p.size} · BIB{" "}
                                {p.bib || "ยังไม่กำหนด"}
                              </small>
                            </div>
                          ))
                        ) : (
                          <>
                            <strong>{order.contact}</strong>
                            <small className="cell-sub address">
                              {order.address}
                            </small>
                          </>
                        )}
                      </td>
                      <td>
                        {events.find((e) => e.id === order.eventId)?.name}
                      </td>
                      <td>
                        {tab === "pickup" ? (
                          order.participants.map((p) => (
                            <label
                              className="checkbox-label pickup-check"
                              key={p.id}
                            >
                              <input
                                type="checkbox"
                                checked={p.collected}
                                onChange={() => {
                                  updateOrder(order.id, {
                                    participants: order.participants.map(
                                      (person) =>
                                        person.id === p.id
                                          ? {
                                              ...person,
                                              collected: !person.collected,
                                            }
                                          : person,
                                    ),
                                  });
                                  notify(
                                    p.collected
                                      ? "ยกเลิกสถานะรับอุปกรณ์สาธิตแล้ว"
                                      : "บันทึกการรับอุปกรณ์สาธิตแล้ว",
                                  );
                                }}
                              />
                              {p.collected
                                ? "รับอุปกรณ์แล้ว"
                                : "ยังไม่รับอุปกรณ์"}
                            </label>
                          ))
                        ) : (
                          <button
                            className="text-link"
                            onClick={() => {
                              setEditingId(order.id);
                              setTracking(order.tracking);
                            }}
                          >
                            {order.tracking || "เพิ่มเลขพัสดุ"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="ไม่มีรายการรับอุปกรณ์ในตัวกรองนี้"
              description="หน้านี้จะแสดงเฉพาะออเดอร์ที่ชำระเงินแล้ว"
            />
          )}
        </div>
      </section>
      {editingId && (
        <Modal title="บันทึกเลขพัสดุ" onClose={() => setEditingId(null)}>
          <form onSubmit={save}>
            <div className="modal-body form-grid">
              <p className="full muted">ออเดอร์ {editingId}</p>
              <label className="full">
                เลขพัสดุ
                <input
                  autoFocus
                  required
                  maxLength={60}
                  pattern="[a-zA-Z0-9\- ]+"
                  title="ใช้ตัวอักษรอังกฤษ ตัวเลข ช่องว่าง หรือขีดกลาง"
                  value={tracking}
                  onChange={(e) => setTracking(e.target.value)}
                />
                <small>
                  บันทึกเพื่อการสาธิต ไม่มีการส่งข้อมูลให้ผู้ให้บริการขนส่ง
                </small>
              </label>
            </div>
            <div className="modal-actions">
              <button
                className="button"
                type="button"
                onClick={() => setEditingId(null)}
              >
                ยกเลิก
              </button>
              <button className="button primary" type="submit">
                <Save size={16} aria-hidden="true" />
                บันทึกเลขพัสดุ
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
