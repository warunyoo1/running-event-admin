"use client";

import { useState, type FormEvent } from "react";
import { Save } from "lucide-react";
import { authApi } from "@/lib/api";
import { fieldErrorsFor, formMessage } from "@/lib/api/errors";
import { useToast } from "@/features/admin/toast-provider";
import { Modal } from "./ui";

const MIN_PASSWORD = 10;
const MAX_PASSWORD = 200;

export function ChangePasswordModal({
  onClose,
  notice,
  onChanged,
}: {
  onClose: () => void;
  /** Optional line shown above the form (e.g. the temporary-password nudge). */
  notice?: string;
  /** Called after the password was changed successfully. */
  onChanged?: () => void;
}) {
  const notify = useToast();
  const [currentPassword, setCurrent] = useState("");
  const [newPassword, setNew] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    setFields({});
    try {
      await authApi.changePassword({ currentPassword, newPassword });
      notify("เปลี่ยนรหัสผ่านแล้ว");
      onChanged?.();
      onClose();
    } catch (reason) {
      setFields(fieldErrorsFor(reason));
      setError(formMessage(reason));
      setPending(false);
    }
  }

  return (
    <Modal title="เปลี่ยนรหัสผ่าน" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="modal-body form-grid">
          {notice && <p className="full">{notice}</p>}
          {error && (
            <p className="form-error full" role="alert">
              {error}
            </p>
          )}
          <label className="full">
            รหัสผ่านปัจจุบัน
            <input
              autoFocus
              required
              type="password"
              autoComplete="current-password"
              maxLength={MAX_PASSWORD}
              value={currentPassword}
              aria-invalid={Boolean(fields.currentPassword)}
              onChange={(e) => setCurrent(e.target.value)}
            />
            {fields.currentPassword && (
              <span className="form-error">{fields.currentPassword}</span>
            )}
          </label>
          <label className="full">
            รหัสผ่านใหม่ (อย่างน้อย {MIN_PASSWORD} ตัว)
            <input
              required
              type="password"
              autoComplete="new-password"
              minLength={MIN_PASSWORD}
              maxLength={MAX_PASSWORD}
              value={newPassword}
              aria-invalid={Boolean(fields.newPassword)}
              onChange={(e) => setNew(e.target.value)}
            />
            {fields.newPassword && <span className="form-error">{fields.newPassword}</span>}
          </label>
        </div>
        <div className="modal-actions">
          <button className="button" type="button" onClick={onClose}>
            ยกเลิก
          </button>
          <button className="button primary" type="submit" disabled={pending}>
            <Save size={16} aria-hidden="true" />
            {pending ? "กำลังบันทึก…" : "เปลี่ยนรหัสผ่าน"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
