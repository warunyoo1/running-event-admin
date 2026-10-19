"use client";

import { useEffect, useId, useRef } from "react";
import { FileWarning, Trash2 } from "lucide-react";

export function DiscardChangesDialog({ onContinue, onDiscard }: {
  onContinue: () => void;
  onDiscard: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const keepEditing = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement as HTMLElement | null;
    element?.showModal();
    keepEditing.current?.focus();
    return () => {
      element?.close();
      if (previous?.isConnected) previous.focus();
    };
  }, []);

  return (
    <dialog ref={dialog} className="discard-dialog" role="alertdialog"
      aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`}
      onCancel={(event) => { event.preventDefault(); onContinue(); }}
      onClick={(event) => { if (event.target === event.currentTarget) onContinue(); }}>
      <div className="discard-content">
        <span className="discard-icon"><FileWarning size={24} aria-hidden="true" /></span>
        <h2 id={`${id}-title`}>ยังไม่ได้บันทึกการแก้ไข</h2>
        <p id={`${id}-description`}>หากปิดตอนนี้ ข้อมูลที่แก้ไขและรูปภาพที่ยังไม่ได้อัปโหลดจะหายไป คุณสามารถกลับไปแก้ไขต่อได้</p>
      </div>
      <div className="discard-actions">
        <button ref={keepEditing} type="button" className="button" onClick={onContinue}>แก้ไขต่อ</button>
        <button type="button" className="button danger" onClick={onDiscard}>
          <Trash2 size={16} aria-hidden="true" />ทิ้งการแก้ไข
        </button>
      </div>
    </dialog>
  );
}
