"use client";

import { useState, type FormEvent } from "react";
import { Pencil, Plus, Save, ShieldCheck } from "lucide-react";
import { useAuth } from "@/features/admin/auth-provider";
import { useAsync } from "@/features/admin/use-async";
import { useToast } from "@/features/admin/toast-provider";
import { isSuper } from "@/features/admin/permissions";
import { roleLabels } from "@/features/admin/format";
import { usersApi } from "@/lib/api";
import { fieldErrorsFor, formMessage } from "@/lib/api/errors";
import type { Role, User, UserPatchBody } from "@/lib/api/types";
import { ErrorState, LoadingState } from "@/components/data-states";
import { EmptyState, Modal, PageHeading, SearchField } from "@/components/ui";

const NAME_MAX = 100;
const EMAIL_MAX = 200;
const MIN_PASSWORD = 10;
const MAX_PASSWORD = 200;
const ROLES = Object.keys(roleLabels) as Role[];

type UserForm = {
  id: string | null;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  password: string;
};

const blankForm: UserForm = {
  id: null,
  name: "",
  email: "",
  role: "viewer",
  active: true,
  password: "",
};

const formFrom = (user: User): UserForm => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  active: user.active,
  password: "",
});

function FieldError({ message }: { message?: string }) {
  return message ? <span className="form-error">{message}</span> : null;
}

export default function UsersPage() {
  const { user } = useAuth();
  if (!isSuper(user.role)) {
    return (
      <EmptyState
        title="ไม่มีสิทธิ์เข้าถึง"
        description="เฉพาะผู้ดูแลระบบเท่านั้นที่จัดการผู้ใช้ได้"
      />
    );
  }
  return <Users />;
}

function Users() {
  const notify = useToast();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<UserForm | null>(null);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const { data, error: loadError, loading, reload } = useAsync(
    (signal) => usersApi.listUsers(signal),
    [],
  );
  const needle = query.trim().toLowerCase();
  const filtered = (data ?? []).filter((u) =>
    `${u.name} ${u.email}`.toLowerCase().includes(needle),
  );

  function open(next: UserForm) {
    setError("");
    setFields({});
    setEditing(next);
  }

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing) return;
    setPending(true);
    setError("");
    setFields({});
    try {
      if (editing.id) {
        const body: UserPatchBody = {
          name: editing.name.trim(),
          role: editing.role,
          active: editing.active,
        };
        if (editing.password) body.password = editing.password;
        await usersApi.updateUser(editing.id, body);
      } else {
        await usersApi.createUser({
          name: editing.name.trim(),
          email: editing.email.trim().toLowerCase(),
          password: editing.password,
          role: editing.role,
        });
      }
      notify("บันทึกผู้ใช้แล้ว");
      setEditing(null);
      reload();
    } catch (failure) {
      setFields(fieldErrorsFor(failure));
      setError(formMessage(failure));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <PageHeading
        title="ผู้ใช้และสิทธิ์"
        scope="global"
        description="กำหนดบทบาทของทีมที่เข้ามาจัดการงานวิ่ง"
        action={
          <button className="button primary" onClick={() => open(blankForm)}>
            <Plus size={17} aria-hidden="true" />
            เพิ่มผู้ใช้
          </button>
        }
      />
      <section className="panel">
        <div className="filter-bar in-panel">
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder="ค้นหาชื่อหรืออีเมล"
          />
          <span className="result-count">{data ? `${filtered.length} ผู้ใช้` : ""}</span>
        </div>
        {loadError && <ErrorState message={loadError} onRetry={reload} />}
        {!data && loading && <LoadingState />}
        {data &&
          (filtered.length ? (
            <div className="table-scroll" aria-busy={loading}>
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
                  {filtered.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <div className="person-cell">
                          <span className="avatar">{u.name.slice(0, 1)}</span>
                          <strong>{u.name}</strong>
                        </div>
                      </td>
                      <td>{u.email}</td>
                      <td>{roleLabels[u.role]}</td>
                      <td>
                        <span
                          className={`badge ${u.active ? "badge-paid" : "badge-closed"}`}
                        >
                          <span aria-hidden="true" />
                          {u.active ? "เปิดใช้งาน" : "ปิดใช้งาน"}
                        </span>
                      </td>
                      <td>
                        <button
                          className="button small-button"
                          onClick={() => open(formFrom(u))}
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
          ))}
      </section>
      <div className="role-guide">
        {ROLES.map((role) => (
          <div key={role}>
            <ShieldCheck size={19} aria-hidden="true" />
            <h2>{roleLabels[role]}</h2>
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
          title={editing.id ? "แก้ไขผู้ใช้" : "เพิ่มผู้ใช้"}
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
                  maxLength={NAME_MAX}
                  value={editing.name}
                  aria-invalid={Boolean(fields.name)}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                />
                <FieldError message={fields.name} />
              </label>
              <label className="full">
                อีเมล
                <input
                  required
                  type="email"
                  maxLength={EMAIL_MAX}
                  readOnly={Boolean(editing.id)}
                  value={editing.email}
                  aria-invalid={Boolean(fields.email)}
                  onChange={(e) => setEditing({ ...editing, email: e.target.value })}
                />
                {editing.id && <small>ไม่สามารถแก้ไขอีเมลได้</small>}
                <FieldError message={fields.email} />
              </label>
              <label className="full">
                {editing.id
                  ? `รหัสผ่านใหม่ (เว้นว่างหากไม่เปลี่ยน, อย่างน้อย ${MIN_PASSWORD} ตัวอักษร)`
                  : `รหัสผ่าน (อย่างน้อย ${MIN_PASSWORD} ตัวอักษร)`}
                <input
                  type="password"
                  autoComplete="new-password"
                  required={!editing.id}
                  minLength={MIN_PASSWORD}
                  maxLength={MAX_PASSWORD}
                  value={editing.password}
                  aria-invalid={Boolean(fields.password)}
                  onChange={(e) => setEditing({ ...editing, password: e.target.value })}
                />
                <FieldError message={fields.password} />
              </label>
              <label>
                บทบาท
                <select
                  value={editing.role}
                  aria-invalid={Boolean(fields.role)}
                  onChange={(e) => setEditing({ ...editing, role: e.target.value as Role })}
                >
                  {ROLES.map((role) => (
                    <option value={role} key={role}>
                      {roleLabels[role]}
                    </option>
                  ))}
                </select>
                <FieldError message={fields.role} />
              </label>
              {editing.id && (
                <label>
                  สถานะ
                  <select
                    value={String(editing.active)}
                    onChange={(e) =>
                      setEditing({ ...editing, active: e.target.value === "true" })
                    }
                  >
                    <option value="true">เปิดใช้งาน</option>
                    <option value="false">ปิดใช้งาน</option>
                  </select>
                  <FieldError message={fields.active} />
                </label>
              )}
            </div>
            <div className="modal-actions">
              <button className="button" type="button" onClick={() => setEditing(null)}>
                ยกเลิก
              </button>
              <button className="button primary" type="submit" disabled={pending}>
                <Save size={16} aria-hidden="true" />
                {pending ? "กำลังบันทึก…" : "บันทึกผู้ใช้"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
