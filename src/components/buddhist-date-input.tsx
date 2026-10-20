"use client";

import { useEffect, useId, useRef, useState, type InputHTMLAttributes, type KeyboardEvent } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { fromBuddhistDate, toBuddhistDate } from "@/lib/buddhist-date";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange" | "min" | "max"> & {
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
};
const months = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
const weekdays = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const isoDate = (year: number, month: number, day: number) => `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

export function BuddhistDateInput({ value, onChange, min, max, ...props }: Props) {
  const [text, setText] = useState(() => toBuddhistDate(value));
  const [view, setView] = useState({ year: 2026, month: 0 });
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const ref = useRef<HTMLInputElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLDivElement>(null);
  const lastEmitted = useRef(value);
  const popupId = useId();
  useEffect(() => {
    if (value !== lastEmitted.current) {
      setText(toBuddhistDate(value));
      lastEmitted.current = value;
    }
  }, [value]);
  useEffect(() => {
    const iso = fromBuddhistDate(text);
    const message = iso === null ? "กรอกวันที่ให้ถูกต้องเป็น วัน/เดือน/พ.ศ. เช่น 30/01/2570" : iso && min && iso < min ? `วันที่ต้องไม่ก่อน ${toBuddhistDate(min)}` : iso && max && iso > max ? `วันที่ต้องไม่เกิน ${toBuddhistDate(max)}` : "";
    ref.current?.setCustomValidity(message);
  }, [text, min, max]);
  const allowed = (date: string) => (!min || date >= min) && (!max || date <= max);
  function emit(iso: string) {
    setText(toBuddhistDate(iso));
    lastEmitted.current = iso;
    onChange(iso);
  }
  function open() {
    if (props.disabled) return;
    const now = new Date();
    const today = isoDate(now.getFullYear(), now.getMonth(), now.getDate());
    const initial = value || (min && today < min ? min : max && today > max ? max : today);
    setView({ year: Number(initial.slice(0, 4)), month: Number(initial.slice(5, 7)) - 1 });
    const rect = field.current!.getBoundingClientRect();
    const width = Math.min(320, window.innerWidth - 24);
    const height = Math.min(420, window.innerHeight - 24);
    setPosition({ left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)), top: Math.max(12, rect.bottom + height + 8 <= window.innerHeight ? rect.bottom + 8 : Math.min(rect.top - height - 8, window.innerHeight - height - 12)) });
    popup.current?.showPopover();
    requestAnimationFrame(() => popup.current?.querySelector<HTMLButtonElement>(`button[data-date="${initial}"]`)?.focus({ preventScroll: true }));
  }
  function select(iso: string) {
    emit(iso);
    popup.current?.hidePopover();
    ref.current?.focus({ preventScroll: true });
  }
  function moveMonth(offset: number) {
    const next = new Date(Date.UTC(view.year, view.month + offset, 1));
    setView({ year: next.getUTCFullYear(), month: next.getUTCMonth() });
  }
  function dayKey(event: KeyboardEvent<HTMLButtonElement>, day: number) {
    const offsets: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (!(event.key in offsets)) return;
    event.preventDefault();
    const next = new Date(Date.UTC(view.year, view.month, day + offsets[event.key]));
    const iso = isoDate(next.getUTCFullYear(), next.getUTCMonth(), next.getUTCDate());
    if (!allowed(iso)) return;
    setView({ year: next.getUTCFullYear(), month: next.getUTCMonth() });
    requestAnimationFrame(() => popup.current?.querySelector<HTMLButtonElement>(`button[data-date="${iso}"]`)?.focus());
  }
  const startDay = new Date(Date.UTC(view.year, view.month, 1)).getUTCDay();
  const days = new Date(Date.UTC(view.year, view.month + 1, 0)).getUTCDate();
  const today = new Date();
  const todayIso = isoDate(today.getFullYear(), today.getMonth(), today.getDate());
  const firstYear = min ? Number(min.slice(0, 4)) : 1900;
  const lastYear = max ? Number(max.slice(0, 4)) : Math.max(today.getFullYear() + 100, view.year);
  const previousMonthEnd = isoDate(view.year, view.month, 1);
  const nextMonthStart = isoDate(view.year, view.month, days);
  return <div className="buddhist-date-field" ref={field}>
    <input {...props} ref={ref} type="text" inputMode="numeric" autoComplete="off" placeholder="เลือกวันที่ (พ.ศ.)" value={text} maxLength={10} onClick={open} onChange={(event) => {
      const digits = event.target.value.replace(/\D/g, "").slice(0, 8);
      const next = digits.length <= 2 ? digits : digits.length <= 4 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
      setText(next);
      const iso = fromBuddhistDate(next);
      lastEmitted.current = iso ?? "";
      onChange(iso ?? "");
    }} onKeyDown={(event) => { props.onKeyDown?.(event); if (event.key === "ArrowDown") { event.preventDefault(); open(); } }} />
    <button className="date-calendar-trigger" type="button" disabled={props.disabled} onClick={open} aria-label="เปิดปฏิทิน พ.ศ." aria-controls={popupId}><CalendarDays size={18} aria-hidden="true" /></button>
    <div className="buddhist-calendar" id={popupId} ref={popup} popover="auto" role="dialog" aria-label="เลือกวันที่ พ.ศ." style={position}>
      <div className="buddhist-calendar-heading">
        <button type="button" aria-label="เดือนก่อนหน้า" disabled={Boolean(min && previousMonthEnd <= min.slice(0, 7) + "-01")} onClick={() => moveMonth(-1)}><ChevronLeft size={18} aria-hidden="true" /></button>
        <select aria-label="เดือน" value={view.month} onChange={(event) => setView({ ...view, month: Number(event.target.value) })}>{months.map((month, index) => <option value={index} key={month}>{month}</option>)}</select>
        <select aria-label="ปี พ.ศ." value={view.year} onChange={(event) => setView({ ...view, year: Number(event.target.value) })}>{Array.from({ length: Math.max(0, lastYear - firstYear + 1) }, (_, index) => firstYear + index).map(year => <option value={year} key={year}>{year + 543}</option>)}</select>
        <button type="button" aria-label="เดือนถัดไป" disabled={Boolean(max && nextMonthStart >= max)} onClick={() => moveMonth(1)}><ChevronRight size={18} aria-hidden="true" /></button>
      </div>
      <p className="sr-only" aria-live="polite">{months[view.month]} {view.year + 543}</p>
      <div className="buddhist-calendar-weekdays" aria-hidden="true">{weekdays.map(day => <span key={day}>{day}</span>)}</div>
      <div className="buddhist-calendar-days">{Array.from({ length: startDay }, (_, index) => <span key={`blank-${index}`} />)}{Array.from({ length: days }, (_, index) => {
        const day = index + 1;
        const iso = isoDate(view.year, view.month, day);
        return <button type="button" key={iso} data-date={iso} aria-label={`${day} ${months[view.month]} ${view.year + 543}`} aria-pressed={value === iso} aria-current={iso === todayIso ? "date" : undefined} disabled={!allowed(iso)} onKeyDown={event => dayKey(event, day)} onClick={() => select(iso)}>{day}</button>;
      })}</div>
      <div className="buddhist-calendar-actions"><button type="button" disabled={!allowed(todayIso)} onClick={() => select(todayIso)}>วันนี้</button>{!props.required && <button type="button" onClick={() => select("")}>ล้างวันที่</button>}<button type="button" onClick={() => { popup.current?.hidePopover(); ref.current?.focus(); }}>ปิด</button></div>
    </div>
  </div>;
}
