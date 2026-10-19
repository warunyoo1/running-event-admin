"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Pencil,
  Plus,
  Power,
  Save,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useAuth } from "@/features/admin/auth-provider";
import { useAsync } from "@/features/admin/use-async";
import { useToast } from "@/features/admin/toast-provider";
import { isSuper } from "@/features/admin/permissions";
import { date, roleDescriptions, roleLabels } from "@/features/admin/format";
import { usersApi } from "@/lib/api";
import { errorMessage, fieldErrorsFor, formMessage } from "@/lib/api/errors";
import { generateTemporaryPassword } from "@/lib/password";
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

type UserAction = { kind: "toggle" | "delete"; target: User };

function FieldError({ message }: { message?: string }) {
  return message ? <span className="form-error">{message}</span> : null;
}

function ConfirmDialog({
  title,
  message,
  error,
  confirmLabel,
  pendingLabel,
  pending,
  danger,
  onConfirm,
  onClose,
}: {
  title: string;
  message: string;
  error: string;
  confirmLabel: string;
  pendingLabel: string;
  pending: boolean;
  danger: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  // Runs after Modal's effect has opened the <dialog>, so the focus call lands on a visible element.
  useEffect(() => {
    const timer = setTimeout(() => cancelRef.current?.focus());
    return () => clearTimeout(timer);
  }, []);
  return (
    <Modal title={title} onClose={onClose}>
      <div className="modal-body">
        <p>{message}</p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <div className="modal-actions">
        <button className="button" type="button" ref={cancelRef} onClick={onClose}>
          ยกเลิก
        </button>
        <button
          className={`button ${danger ? "danger" : "primary"}`}
          type="button"
          disabled={pending}
          onClick={onConfirm}
        >
          {pending ? pendingLabel : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

export default function UsersPage() {
  const { user } = useAuth();
  if (!isSuper(user.role)) {
    return (
      <EmptyState
        title="ไม่มีสิทธิ์เข้าถึง"
        description="หน้านี้ใช้ได้เฉพาะผู้ดูแลระบบ"
      />
    );
  }
  return <Users selfId={user.id} />;
}

function Users({ selfId }: { selfId: string }) {
  const notify = useToast();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<UserForm | null>(null);
  const [original, setOriginal] = useState<User | null>(null);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [action, setAction] = useState<UserAction | null>(null);
  const [actionError, setActionError] = useState("");
  const [actionPending, setActionPending] = useState(false);
  const { data, error: loadError, loading, reload } = useAsync(
    (signal) => usersApi.listUsers(signal),
    [],
  );
  const needle = query.trim().toLowerCase();
  const filtered = (data ?? []).filter((u) =>
    `${u.name} ${u.email}`.toLowerCase().includes(needle),
  );

  function open(next: UserForm, source: User | null) {
    setError("");
    setFields({});
    setShowPassword(false);
    setOriginal(source);
    setEditing(next);
  }

  function openAction(next: UserAction) {
    setActionError("");
    setAction(next);
  }

  async function copyPassword() {
    if (!editing?.password) return;
    try {
      await navigator.clipboard.writeText(editing.password);
      notify("คัดลอกรหัสผ่านแล้ว");
    } catch {
      // Clipboard can be blocked; the visible field is the fallback.
      setShowPassword(true);
      notify("คัดลอกไม่สำเร็จ ให้เลือกรหัสผ่านในช่องแล้วคัดลอกเอง");
    }
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
        const email = editing.email.trim().toLowerCase();
        if (email !== original?.email) body.email = email;
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
      notify(
        editing.id
          ? "บันทึกข้อมูลผู้ใช้แล้ว"
          : "สร้างผู้ใช้แล้ว ระบบไม่ส่งอีเมล กรุณาแจ้งรหัสผ่านชั่วคราวให้เขาเอง",
      );
      setEditing(null);
      reload();
    } catch (failure) {
      setFields(fieldErrorsFor(failure));
      setError(formMessage(failure));
    } finally {
      setPending(false);
    }
  }

  async function confirmAction() {
    if (!action) return;
    setActionPending(true);
    setActionError("");
    try {
      if (action.kind === "delete") {
        await usersApi.deleteUser(action.target.id);
        notify("ลบผู้ใช้แล้ว");
      } else {
        await usersApi.updateUser(action.target.id, {
          active: !action.target.active,
        });
        notify(action.target.active ? "ปิดใช้งานผู้ใช้แล้ว" : "เปิดใช้งานผู้ใช้แล้ว");
      }
      setAction(null);
      reload();
    } catch (failure) {
      setActionError(errorMessage(failure));
    } finally {
      setActionPending(false);
    }
  }

  const editingSelf = Boolean(editing?.id && editing.id === selfId);

  return (
    <>
      <PageHeading
        title="ผู้ใช้และสิทธิ์"
        scope="global"
        description="สร้างบัญชีและกำหนดสิทธิ์ให้ทีมงาน ระบบจะไม่ส่งอีเมลให้ผู้ใช้ กรุณาแจ้งอีเมลและรหัสผ่านชั่วคราวให้เขาเอง"
        action={
          <button className="button primary" onClick={() => open(blankForm, null)}>
            <Plus size={17} aria-hidden="true" />
            สร้างผู้ใช้ใหม่
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
          <span className="result-count">{data ? `${filtered.length} คน` : ""}</span>
        </div>
        {loadError && <ErrorState message={loadError} onRetry={reload} />}
        {!data && loading && <LoadingState />}
        {data &&
          (filtered.length ? (
            <div className="table-scroll" tabIndex={0} role="region" aria-label="ตารางข้อมูล เลื่อนแนวนอนเพื่อดูคอลัมน์เพิ่มเติม" aria-busy={loading}>
              <table>
                <thead>
                  <tr>
                    <th>ผู้ใช้</th>
                    <th>อีเมล</th>
                    <th>สิทธิ์ใช้งาน</th>
                    <th>สถานะ</th>
                    <th>เข้าสู่ระบบล่าสุด</th>
                    <th>จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u) => {
                    const isSelf = u.id === selfId;
                    const hintId = `self-hint-${u.id}`;
                    return (
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
                            {u.active ? "ใช้งานอยู่" : "ปิดใช้งานแล้ว"}
                          </span>
                          {u.mustChangePassword && (
                            <small className="cell-sub">ยังใช้รหัสผ่านชั่วคราว</small>
                          )}
                        </td>
                        <td className="muted">
                          {u.lastLoginAt ? date(u.lastLoginAt, true) : "–"}
                        </td>
                        <td>
                          <div className="row-actions">
                            <button
                              className="button small-button"
                              onClick={() => open(formFrom(u), u)}
                            >
                              <Pencil size={14} aria-hidden="true" />
                              แก้ไข
                            </button>
                            <button
                              className="button small-button"
                              disabled={isSelf}
                              aria-describedby={isSelf ? hintId : undefined}
                              onClick={() => openAction({ kind: "toggle", target: u })}
                            >
                              <Power size={14} aria-hidden="true" />
                              {u.active ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                            </button>
                            {!u.active && !isSelf && (
                              <button
                                className="button small-button danger"
                                onClick={() => openAction({ kind: "delete", target: u })}
                              >
                                <Trash2 size={14} aria-hidden="true" />
                                ลบผู้ใช้
                              </button>
                            )}
                          </div>
                          {isSelf && (
                            <small className="cell-sub" id={hintId}>
                              ปิดใช้งานบัญชีของตัวเองไม่ได้
                            </small>
                          )}
                        </td>
                      </tr>
                    );
                  })}
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
            <p>{roleDescriptions[role]}</p>
          </div>
        ))}
      </div>
      {editing && (
        <Modal
          title={editing.id ? "แก้ไขผู้ใช้" : "สร้างผู้ใช้ใหม่"}
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
                  value={editing.email}
                  aria-invalid={Boolean(fields.email)}
                  onChange={(e) => setEditing({ ...editing, email: e.target.value })}
                />
                <FieldError message={fields.email} />
              </label>
              <label className="full">
                {editing.id
                  ? `รหัสผ่านใหม่ (เว้นว่างไว้ถ้าไม่เปลี่ยน, อย่างน้อย ${MIN_PASSWORD} ตัว)`
                  : `รหัสผ่านชั่วคราว (อย่างน้อย ${MIN_PASSWORD} ตัว)`}
                <input
                  type={showPassword ? "text" : "password"}
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
              <div className="full modal-inline-actions">
                <button
                  className="button small-button"
                  type="button"
                  onClick={() => {
                    setEditing({ ...editing, password: generateTemporaryPassword() });
                    setShowPassword(true);
                  }}
                >
                  <KeyRound size={14} aria-hidden="true" />
                  สุ่มรหัสผ่านให้
                </button>
                <button
                  className="button small-button"
                  type="button"
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff size={14} aria-hidden="true" />
                  ) : (
                    <Eye size={14} aria-hidden="true" />
                  )}
                  {showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                </button>
                <button
                  className="button small-button"
                  type="button"
                  disabled={!editing.password}
                  onClick={copyPassword}
                >
                  <Copy size={14} aria-hidden="true" />
                  คัดลอกรหัสผ่าน
                </button>
              </div>
              <p className="form-hint full">
                {editing.id
                  ? "ถ้าตั้งรหัสผ่านใหม่ เขาต้องเปลี่ยนรหัสผ่านอีกครั้งตอนเข้าสู่ระบบ"
                  : "ระบบไม่ส่งอีเมลให้ กรุณาแจ้งรหัสผ่านนี้ให้เขาเอง เขาจะต้องเปลี่ยนรหัสผ่านตอนเข้าสู่ระบบครั้งแรก"}
              </p>
              <label>
                สิทธิ์ใช้งาน
                <select
                  value={editing.role}
                  disabled={editingSelf}
                  aria-invalid={Boolean(fields.role)}
                  onChange={(e) => setEditing({ ...editing, role: e.target.value as Role })}
                >
                  {ROLES.map((role) => (
                    <option value={role} key={role}>
                      {roleLabels[role]}
                    </option>
                  ))}
                </select>
                <small>{roleDescriptions[editing.role]}</small>
                <FieldError message={fields.role} />
              </label>
              {editing.id && (
                <label>
                  สถานะ
                  <select
                    value={String(editing.active)}
                    disabled={editingSelf}
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
              {editingSelf && (
                <p className="form-hint full">
                  เปลี่ยนสิทธิ์ใช้งานหรือสถานะของบัญชีตัวเองไม่ได้
                </p>
              )}
            </div>
            <div className="modal-actions">
              <button className="button" type="button" onClick={() => setEditing(null)}>
                ยกเลิก
              </button>
              <button className="button primary" type="submit" disabled={pending}>
                <Save size={16} aria-hidden="true" />
                {pending
                  ? editing.id
                    ? "กำลังบันทึก…"
                    : "กำลังสร้าง…"
                  : editing.id
                    ? "บันทึก"
                    : "สร้างผู้ใช้"}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {action && (
        <ConfirmDialog
          title={
            action.kind === "delete"
              ? "ลบผู้ใช้ถาวร"
              : action.target.active
                ? "ปิดใช้งานผู้ใช้"
                : "เปิดใช้งานผู้ใช้"
          }
          message={
            action.kind === "delete"
              ? `ลบ ${action.target.name} (${action.target.email}) ถาวร? ลบแล้วกู้คืนไม่ได้ ถ้าเขาเคยใช้งานระบบมาก่อนจะลบไม่ได้ ให้ปิดใช้งานแทน`
              : action.target.active
                ? `ปิดใช้งาน ${action.target.name}? เขาจะเข้าสู่ระบบไม่ได้ แต่ข้อมูลและประวัติยังอยู่ กดเปิดใช้งานเมื่อไรก็กลับมาใช้ได้`
                : `เปิดใช้งาน ${action.target.name} อีกครั้ง? เขาจะเข้าสู่ระบบได้ตามปกติ`
          }
          error={actionError}
          confirmLabel={
            action.kind === "delete"
              ? "ลบผู้ใช้ถาวร"
              : action.target.active
                ? "ปิดใช้งาน"
                : "เปิดใช้งาน"
          }
          pendingLabel="กำลังทำรายการ…"
          pending={actionPending}
          danger={action.kind === "delete" || action.target.active}
          onConfirm={confirmAction}
          onClose={() => setAction(null)}
        />
      )}
    </>
  );
}
