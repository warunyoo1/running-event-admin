"use client";

import {
  useEffect,
  useId,
  useRef,
  type ReactNode,
  type KeyboardEvent,
} from "react";
import { Search, X, Inbox, type LucideIcon } from "lucide-react";
import { useScope } from "@/features/admin/scope-provider";
import { statusLabels } from "@/features/admin/format";
import type { EventStatus, OrderStatus } from "@/lib/api/types";

export function handleTabKeys(event: KeyboardEvent<HTMLDivElement>) {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  const tabs = Array.from(
    event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
  );
  const index = tabs.indexOf(event.target as HTMLButtonElement);
  if (index < 0) return;
  event.preventDefault();
  const next =
    event.key === "Home"
      ? 0
      : event.key === "End"
        ? tabs.length - 1
        : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) %
          tabs.length;
  tabs[next]?.focus();
  tabs[next]?.click();
}

export function Badge({ status }: { status: OrderStatus | EventStatus }) {
  return (
    <span className={`badge badge-${status}`}>
      <span aria-hidden="true" />
      {statusLabels[status]}
    </span>
  );
}
export function PageHeading({
  title,
  description,
  action,
  scope = "event",
}: {
  title: string;
  description: string;
  action?: ReactNode;
  scope?: "event" | "global";
}) {
  const { selectedEvent } = useScope();
  return (
    <div className="page-heading">
      <div>
        <h1>
          {title}
          <span
            className={`heading-event ${scope === "global" ? "global-context" : ""}`}
          >
            {scope === "global"
              ? "ทุกงาน · ไม่ขึ้นกับงานที่เลือก"
              : selectedEvent
                ? `ของ ${selectedEvent.name}`
                : "รวมทุกงานวิ่ง"}
          </span>
        </h1>
        <p>{description}</p>
      </div>
      {action && <div className="heading-actions">{action}</div>}
    </div>
  );
}
export function SearchField({
  value,
  onChange,
  placeholder = "ค้นหาข้อมูล",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="search-field">
      <Search size={18} aria-hidden="true" />
      <span className="sr-only">{placeholder}</span>
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}
export function EmptyState({
  title = "ไม่พบข้อมูล",
  description = "ลองเปลี่ยนคำค้นหาหรือตัวกรองอีกครั้ง",
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <Inbox size={32} aria-hidden="true" />
      <h2>{title}</h2>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function StatCard({
  title,
  value,
  note,
  icon: Icon,
  accent = false,
}: {
  title: string;
  value: string;
  note: string;
  icon: LucideIcon;
  accent?: boolean;
}) {
  return (
    <article className={`stat-card ${accent ? "accent" : ""}`}>
      <div className="stat-label">
        <span>{title}</span>
        <Icon size={19} aria-hidden="true" />
      </div>
      <strong>{value}</strong>
      <p>{note}</p>
    </article>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
  className = "",
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "modal-wide" : ""} ${className}`}
      aria-labelledby={id}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <header className="modal-header">
        <h2 id={id}>{title}</h2>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="ปิดหน้าต่าง"
        >
          <X size={20} />
        </button>
      </header>
      {children}
    </dialog>
  );
}

export function EventArtwork({
  theme = "orange",
  compact = false,
}: {
  theme?: "orange" | "green" | "blue";
  compact?: boolean;
}) {
  return (
    <div
      className={`event-art event-art-${theme} ${compact ? "compact" : ""}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 600 200" preserveAspectRatio="xMidYMid slice">
        <g
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          transform="rotate(-24 300 100)"
        >
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <rect
              key={i}
              x={110 - i * 23}
              y={-42 - i * 23}
              width={380 + i * 46}
              height={284 + i * 46}
              rx={142 + i * 23}
            />
          ))}
        </g>
      </svg>

    </div>
  );
}
