"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import {
  CalendarDays,
  MapPin,
  Plus,
  ArrowUpRight,
  Users,
  Save,
} from "lucide-react";
import { useDemo } from "@/features/admin/demo-store";
import {
  date,
  money,
  number,
  type EventStatus,
  type RunningEvent,
} from "@/features/admin/data";
import {
  Badge,
  EmptyState,
  EventArtwork,
  Modal,
  PageHeading,
  SearchField,
} from "@/components/ui";

export default function EventsPage() {
  return (
    <Suspense>
      <Events />
    </Suspense>
  );
}

function Events() {
  const { events, orders, saveEvent, notify } = useDemo();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [editing, setEditing] = useState<RunningEvent | null>(
    () => events.find((e) => e.id === searchParams.get("event")) ?? null,
  );
  const [error, setError] = useState("");
  const filtered = events.filter(
    (e) =>
      (status === "all" || e.status === status) &&
      `${e.name} ${e.venue}`.toLowerCase().includes(query.toLowerCase()),
  );
  function createEvent() {
    setError("");
    setEditing({
      id: crypto.randomUUID(),
      name: "",
      slug: "",
      date: "",
      venue: "",
      status: "draft",
      theme: "orange",
      races: [{ name: "5 KM", price: 399, quota: 500 }],
    });
  }
  function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing) return;
    if (
      !editing.name.trim() ||
      !editing.venue.trim() ||
      editing.races.some((race) => !race.name.trim())
    ) {
      setError("กรุณาระบุชื่องานวิ่ง สถานที่ และชื่อระยะให้ครบถ้วน");
      return;
    }
    if (
      events.some(
        (event) => event.slug === editing.slug && event.id !== editing.id,
      )
    ) {
      setError("ลิงก์งานวิ่งนี้ถูกใช้แล้ว กรุณาเปลี่ยนลิงก์");
      return;
    }
    const existing = events.find((event) => event.id === editing.id);
    const hasOrders = orders.some((order) => order.eventId === editing.id);
    if (
      hasOrders &&
      existing &&
      JSON.stringify(existing.races) !== JSON.stringify(editing.races)
    ) {
      setError("งานนี้มีออเดอร์แล้ว กรุณาคงราคาและโควตาเดิมในเวอร์ชันสาธิต");
      return;
    }
    saveEvent({
      ...editing,
      name: editing.name.trim(),
      venue: editing.venue.trim(),
    });
    notify("บันทึกข้อมูลงานวิ่งสาธิตแล้ว");
    setEditing(null);
  }
  return (
    <>
      <PageHeading
        title="จัดการงานวิ่ง"
        scope="global"
        description="ดูงานวิ่งทั้งหมด สร้างงาน และตั้งค่าการรับสมัครในที่เดียว"
        action={
          <button className="button primary" onClick={createEvent}>
            <Plus size={17} aria-hidden="true" />
            สร้างงานวิ่ง
          </button>
        }
      />
      <div className="filter-bar">
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="ค้นหาชื่องานวิ่งหรือสถานที่"
        />
        <label>
          <span className="sr-only">สถานะงานวิ่ง</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">ทุกสถานะ</option>
            <option value="open">เปิดรับสมัคร</option>
            <option value="draft">แบบร่าง</option>
            <option value="closed">ปิดรับสมัคร</option>
          </select>
        </label>
        <span className="result-count">{filtered.length} งานวิ่ง</span>
      </div>
      {filtered.length ? (
        <div className="event-grid">
          {filtered.map((event) => {
            const count = orders
              .filter(
                (o) =>
                  o.eventId === event.id &&
                  !["expired", "cancelled"].includes(o.status),
              )
              .reduce((s, o) => s + o.participants.length, 0);
            const quota = event.races.reduce((s, r) => s + r.quota, 0);
            return (
              <article className="event-card" key={event.id}>
                <EventArtwork theme={event.theme} />
                <div className="event-card-body">
                  <div className="event-card-meta">
                    <Badge status={event.status} />
                    <span>{event.races.map((r) => r.name).join(" / ")}</span>
                  </div>
                  <h2>{event.name}</h2>
                  <p>
                    <CalendarDays size={16} aria-hidden="true" />
                    {date(event.date)}
                  </p>
                  <p>
                    <MapPin size={16} aria-hidden="true" />
                    {event.venue}
                  </p>
                  <div className="quota">
                    <div>
                      <span>
                        <Users size={15} aria-hidden="true" />
                        ผู้สมัคร
                      </span>
                      <strong>
                        {count}
                        <span> / {number(quota)} คน</span>
                      </strong>
                    </div>
                    <progress
                      value={count}
                      max={Math.max(1, quota)}
                      aria-label={`ผู้สมัคร ${count} จากโควตา ${quota} คน`}
                    />
                  </div>
                  <div className="event-card-footer">
                    <span>
                      เริ่มต้น{" "}
                      {money(Math.min(...event.races.map((r) => r.price)))}
                    </span>
                    <button
                      className="text-link"
                      onClick={() => {
                        setEditing(event);
                        setError("");
                      }}
                    >
                      จัดการงาน
                      <ArrowUpRight size={16} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState title="ไม่พบงานวิ่ง" />
      )}
      {editing && (
        <Modal
          title={
            events.some((e) => e.id === editing.id)
              ? "ตั้งค่างานวิ่ง"
              : "สร้างงานวิ่ง"
          }
          onClose={() => setEditing(null)}
        >
          <form onSubmit={save}>
            <div className="modal-body form-grid">
              <p className="form-notice full">
                ข้อมูลสาธิต · การบันทึกไม่มีผลต่อการรับสมัครจริง
              </p>
              {error && (
                <p className="form-error full" role="alert">
                  {error}
                </p>
              )}
              <label className="full">
                ชื่องานวิ่ง
                <input
                  autoFocus
                  required
                  maxLength={120}
                  value={editing.name}
                  onChange={(e) =>
                    setEditing({ ...editing, name: e.target.value })
                  }
                />
              </label>
              <label className="full">
                ลิงก์งานวิ่ง (slug)
                <input
                  required
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                  title="ใช้ตัวอักษรอังกฤษพิมพ์เล็ก ตัวเลข และขีดกลาง เช่น bangkok-run-2027"
                  value={editing.slug}
                  onChange={(e) =>
                    setEditing({ ...editing, slug: e.target.value })
                  }
                />
                <small>ใช้ตัวอักษรอังกฤษพิมพ์เล็ก ตัวเลข และขีดกลาง</small>
              </label>
              <label>
                วันที่จัดงาน
                <input
                  required
                  type="date"
                  value={editing.date}
                  onChange={(e) =>
                    setEditing({ ...editing, date: e.target.value })
                  }
                />
              </label>
              <label>
                สถานะ
                <select
                  value={editing.status}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      status: e.target.value as EventStatus,
                    })
                  }
                >
                  <option value="draft">แบบร่าง</option>
                  <option value="open">เปิดรับสมัคร</option>
                  <option value="closed">ปิดรับสมัคร</option>
                </select>
              </label>
              <label className="full">
                สถานที่
                <input
                  required
                  value={editing.venue}
                  onChange={(e) =>
                    setEditing({ ...editing, venue: e.target.value })
                  }
                />
              </label>
              <fieldset className="full race-fields">
                <legend>ระยะและราคา</legend>
                {orders.some((o) => o.eventId === editing.id) && (
                  <p className="muted">
                    งานนี้มีออเดอร์แล้ว จึงแสดงราคาและโควตาเพื่ออ่านเท่านั้น
                  </p>
                )}
                {editing.races.map((race, index) => (
                  <div className="race-field-row" key={index}>
                    <label>
                      ระยะ
                      <input
                        required
                        disabled={orders.some((o) => o.eventId === editing.id)}
                        value={race.name}
                        onChange={(e) =>
                          setEditing({
                            ...editing,
                            races: editing.races.map((r, i) =>
                              i === index ? { ...r, name: e.target.value } : r,
                            ),
                          })
                        }
                      />
                    </label>
                    <label>
                      ราคา (บาท)
                      <input
                        type="number"
                        min="0"
                        step="1"
                        required
                        disabled={orders.some((o) => o.eventId === editing.id)}
                        value={race.price}
                        onChange={(e) =>
                          setEditing({
                            ...editing,
                            races: editing.races.map((r, i) =>
                              i === index
                                ? { ...r, price: Number(e.target.value) }
                                : r,
                            ),
                          })
                        }
                      />
                    </label>
                    <label>
                      โควตา (คน)
                      <input
                        type="number"
                        min="1"
                        required
                        disabled={orders.some((o) => o.eventId === editing.id)}
                        value={race.quota}
                        onChange={(e) =>
                          setEditing({
                            ...editing,
                            races: editing.races.map((r, i) =>
                              i === index
                                ? { ...r, quota: Number(e.target.value) }
                                : r,
                            ),
                          })
                        }
                      />
                    </label>
                  </div>
                ))}
                {!orders.some((o) => o.eventId === editing.id) && (
                  <button
                    type="button"
                    className="button small-button"
                    onClick={() =>
                      setEditing({
                        ...editing,
                        races: [
                          ...editing.races,
                          { name: "", price: 0, quota: 100 },
                        ],
                      })
                    }
                  >
                    <Plus size={15} aria-hidden="true" />
                    เพิ่มระยะ
                  </button>
                )}
              </fieldset>
            </div>
            <div className="modal-actions">
              <button
                className="button"
                type="button"
                onClick={() => setEditing(null)}
              >
                ยกเลิก
              </button>
              <button className="button primary" type="submit">
                <Save size={16} aria-hidden="true" />
                บันทึกงานวิ่ง
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
