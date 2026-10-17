"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import type { PageMeta } from "@/lib/api/types";

export function LoadingState({ label = "กำลังโหลดข้อมูล…" }: { label?: string }) {
  return (
    <p className="context-loading" role="status">
      {label}
    </p>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="form-error data-error" role="alert">
      <span>{message}</span>
      <button className="button small-button" type="button" onClick={onRetry}>
        ลองใหม่
      </button>
    </div>
  );
}

export function Pager({
  meta,
  unit,
  onPage,
}: {
  meta: PageMeta;
  unit: string;
  onPage: (page: number) => void;
}) {
  const { page, pageSize, total, totalPages } = meta;
  if (total === 0) return null;
  return (
    <div className="pagination">
      <span>
        แสดง {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} จาก{" "}
        {total} {unit}
      </span>
      <div>
        <button
          className="icon-button"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          aria-label="หน้าก่อนหน้า"
        >
          <ChevronLeft size={18} />
        </button>
        <span>
          หน้า {page} / {Math.max(totalPages, 1)}
        </span>
        <button
          className="icon-button"
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
          aria-label="หน้าถัดไป"
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}
