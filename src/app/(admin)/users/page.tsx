"use client";

import { useState, type FormEvent } from "react";
import { Pencil, Plus, Save, ShieldCheck } from "lucide-react";
import { useDemo } from "@/features/admin/demo-store";
import { roleLabels, type AdminUser, type Role } from "@/features/admin/data";
import { EmptyState, Modal, PageHeading, SearchField } from "@/components/ui";

export default function UsersPage() {
  const { users, saveUser, notify } = useDemo();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [error, setError] = useState("");
  const filtered = users.filter((u) =>
    `${u.name} ${u.email}`.toLowerCase().includes(query.toLowerCase()),
  );
  function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing) return;
    if (!editing.name.trim()) {
      setError("กรุณาระบุชื่อที่แสดง");
      return;
    }
    if (
      users.some(
        (u) =>
          u.id !== editing.id &&
          u.email.toLowerCase() === editing.email.trim().toLowerCase(),
      )
    ) {
      setError("อีเมลนี้มีอยู่แล้ว กรุณาใช้อีเมลอื่น");
      return;
    }
    if (
      (!editing.active || editing.role !== "super_admin") &&
      !users.some(
        (u) => u.id !== editing.id && u.active && u.role === "super_admin",
      )
    ) {
      setError("ต้องมีผู้ดูแลระบบที่เปิดใช้งานอย่างน้อย 1 คน");
      return;
    }
    saveUser({
      ...editing,
      name: editing.name.trim(),
      email: editing.email.trim().toLowerCase(),
    });
    notify("บันทึกผู้ใช้สาธิตแล้ว ไม่มีการส่งคำเชิญจริง");
    setEditing(null);
  }
  return (
    <>
      <PageHeading
        title="ผู้ใช้และสิทธิ์"
        scope="global"
        description="กำหนดบทบาทของทีมที่เข้ามาจัดการงานวิ่ง"
        action={
          <button
            className="button primary"
            onClick={() => {
              setEditing({
                id: crypto.randomUUID(),
                name: "",
                email: "",
                role: "viewer",
                active: true,
              });
              setError("");
            }}
          >
            <Plus size={17} aria-hidden="true" />
            เพิ่มผู้ใช้
          </button>
        }
      />
      <div className="permission-notice">
        <ShieldCheck size={20} aria-hidden="true" />
        <p>
          <strong>แสดงตัวอย่างในมุมมองผู้ดูแลระบบ</strong>
          <span>
            การกำหนดสิทธิ์จริงต้องตรวจสอบที่ backend
            การเปลี่ยนบทบาทที่นี่เป็นการแก้ข้อมูลสาธิตเท่านั้น
          </span>
        </p>
      </div>
      <section className="panel">
        <div className="filter-bar in-panel">
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder="ค้นหาชื่อหรืออีเมล"
          />
          <span className="result-count">{filtered.length} ผู้ใช้</span>
        </div>
        {filtered.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>ผู้ใช้</th>
                  <th>อีเมล</th>
                  <th>บทบาท</th>
                  <th>สถานะ</th>
                  <th>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className="person-cell">
                        <span className="avatar">{user.name.slice(0, 1)}</span>
                        <strong>{user.name}</strong>
                      </div>
                    </td>
                    <td>{user.email}</td>
                    <td>{roleLabels[user.role]}</td>
                    <td>
                      <span
                        className={`badge ${user.active ? "badge-paid" : "badge-closed"}`}
                      >
                        <span aria-hidden="true" />
                        {user.active ? "เปิดใช้งาน" : "ปิดใช้งาน"}
                      </span>
                    </td>
                    <td>
                      <button
                        className="button small-button"
                        onClick={() => {
                          setEditing(user);
                          setError("");
                        }}
                      >
                        <Pencil size={14} aria-hidden="true" />
                        แก้ไข
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="ไม่พบผู้ใช้" />
        )}
      </section>
      <div className="role-guide">
        {Object.entries(roleLabels).map(([role, label]) => (
          <div key={role}>
            <ShieldCheck size={19} aria-hidden="true" />
            <h2>{label}</h2>
            <p>
              {role === "super_admin"
                ? "จัดการทุกโมดูล รวมถึงผู้ใช้และสิทธิ์"
                : role === "reviewer"
                  ? "ดูออเดอร์ ตรวจสลิป และยืนยันการชำระเงิน"
                  : "ดูข้อมูลและส่งออกรายงาน โดยไม่แก้ไขข้อมูล"}
            </p>
          </div>
        ))}
      </div>
      {editing && (
        <Modal
          title={
            users.some((u) => u.id === editing.id)
              ? "แก้ไขผู้ใช้"
              : "เพิ่มผู้ใช้สาธิต"
          }
          onClose={() => setEditing(null)}
        >
          <form onSubmit={save}>
            <div className="modal-body form-grid">
              {error && (
                <p className="form-error full" role="alert">
                  {error}
                </p>
              )}
              <label className="full">
                ชื่อที่แสดง
                <input
                  autoFocus
                  required
                  maxLength={80}
                  value={editing.name}
                  onChange={(e) =>
                    setEditing({ ...editing, name: e.target.value })
                  }
                />
              </label>
              <label className="full">
                อีเมล
                <input
                  required
                  type="email"
                  value={editing.email}
                  onChange={(e) =>
                    setEditing({ ...editing, email: e.target.value })
                  }
                />
              </label>
              <label>
                บทบาท
                <select
                  value={editing.role}
                  onChange={(e) =>
                    setEditing({ ...editing, role: e.target.value as Role })
                  }
                >
                  {Object.entries(roleLabels).map(([role, label]) => (
                    <option value={role} key={role}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                สถานะ
                <select
                  value={String(editing.active)}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      active: e.target.value === "true",
                    })
                  }
                >
                  <option value="true">เปิดใช้งาน</option>
                  <option value="false">ปิดใช้งาน</option>
                </select>
              </label>
              <p className="form-notice full">
                ไม่มีการสร้างบัญชีล็อกอินหรือส่งอีเมลจริง
              </p>
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
                บันทึกผู้ใช้
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
