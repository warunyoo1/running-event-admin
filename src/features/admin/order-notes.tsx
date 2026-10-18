"use client";

import { useId, useState, type FormEvent } from "react";
import { Trash2 } from "lucide-react";
import { useAuth } from "./auth-provider";
import { date } from "./format";
import { canWrite, isSuper } from "./permissions";
import { useToast } from "./toast-provider";
import { ordersApi } from "@/lib/api";
import { fieldErrorsFor, formMessage } from "@/lib/api/errors";
import { ORDER_NOTE_MAX } from "@/lib/constants";
import type { OrderNote } from "@/lib/api/types";

/** Internal notes: everyone can read, writers can add, authors (and super admins) can delete. */
export function OrderNotes({
  orderId,
  notes,
  onChanged,
}: {
  orderId: string;
  notes: OrderNote[];
  /** Reload the order detail after a change. */
  onChanged: () => void;
}) {
  const { user } = useAuth();
  const notify = useToast();
  const fieldId = useId();
  const [text, setText] = useState("");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [textError, setTextError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    const value = text.trim();
    if (!value) {
      setTextError("กรุณากรอกบันทึก");
      return;
    }
    setPending(true);
    setError("");
    setTextError("");
    try {
      await ordersApi.addNote(orderId, value);
      setText("");
      notify("เพิ่มบันทึกแล้ว");
      onChanged();
    } catch (failure) {
      setTextError(fieldErrorsFor(failure).text ?? "");
      setError(formMessage(failure));
    } finally {
      setPending(false);
    }
  }

  async function remove(noteId: string) {
    setPending(true);
    setError("");
    try {
      await ordersApi.deleteNote(orderId, noteId);
      setConfirmingId(null);
      notify("ลบบันทึกแล้ว");
      onChanged();
    } catch (failure) {
      setError(formMessage(failure));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="order-section" aria-labelledby={`${fieldId}-title`}>
      <h3 id={`${fieldId}-title`}>บันทึกภายใน</h3>
      {notes.length === 0 ? (
        <p className="muted">ยังไม่มีบันทึก</p>
      ) : (
        <ul className="order-notes">
          {notes.map((note) => {
            const mine = note.author?.id === user.id;
            const canDelete = canWrite(user.role) && (isSuper(user.role) || mine);
            return (
              <li key={note.id}>
                <p className="note-text">{note.text}</p>
                <small>
                  {note.author?.name ?? "ผู้ใช้ที่ถูกลบ"} · {date(note.createdAt, true)}
                </small>
                {canDelete &&
                  (confirmingId === note.id ? (
                    <div className="note-actions" role="group" aria-label="ยืนยันการลบบันทึก">
                      <span>ลบบันทึกนี้ใช่หรือไม่</span>
                      <button
                        type="button"
                        className="button small-button danger"
                        disabled={pending}
                        onClick={() => void remove(note.id)}
                      >
                        ยืนยันลบ
                      </button>
                      <button
                        type="button"
                        className="button small-button"
                        disabled={pending}
                        onClick={() => setConfirmingId(null)}
                      >
                        ยกเลิก
                      </button>
                    </div>
                  ) : (
                    <div className="note-actions">
                      <button
                        type="button"
                        className="button small-button danger-outline"
                        disabled={pending}
                        onClick={() => {
                          setError("");
                          setConfirmingId(note.id);
                        }}
                      >
                        <Trash2 size={15} aria-hidden="true" />
                        ลบ
                      </button>
                    </div>
                  ))}
              </li>
            );
          })}
        </ul>
      )}
      {canWrite(user.role) && (
        <form className="note-form" onSubmit={(event) => void submit(event)}>
          <label htmlFor={`${fieldId}-text`}>เพิ่มบันทึกภายใน</label>
          <textarea
            id={`${fieldId}-text`}
            value={text}
            maxLength={ORDER_NOTE_MAX}
            aria-invalid={Boolean(textError)}
            aria-describedby={`${fieldId}-count`}
            disabled={pending}
            onChange={(e) => setText(e.target.value)}
            placeholder="เช่น ลูกค้าโทรขอเปลี่ยนเวลารับเสื้อ (ผู้สมัครมองไม่เห็นบันทึกนี้)"
          />
          <small id={`${fieldId}-count`} className="muted">
            {text.length}/{ORDER_NOTE_MAX}
          </small>
          {textError && <small className="danger-text">{textError}</small>}
          <div>
            <button className="button" type="submit" disabled={pending || !text.trim()}>
              เพิ่มบันทึก
            </button>
          </div>
        </form>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
