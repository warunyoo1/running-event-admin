"use client";

import { useEffect, useRef, useState, type InputHTMLAttributes } from "react";
import { fromBuddhistDate, toBuddhistDate } from "@/lib/buddhist-date";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange" | "min" | "max"> & {
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
};

export function BuddhistDateInput({ value, onChange, min, max, ...props }: Props) {
  const [text, setText] = useState(() => toBuddhistDate(value));
  const ref = useRef<HTMLInputElement>(null);
  const lastEmitted = useRef(value);
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
  return <input {...props} ref={ref} type="text" inputMode="numeric" autoComplete="off" placeholder="วว/ดด/พ.ศ. เช่น 30/01/2570" value={text} maxLength={10} onChange={(event) => {
    const digits = event.target.value.replace(/\D/g, "").slice(0, 8);
    const next = digits.length <= 2 ? digits : digits.length <= 4 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    setText(next);
    const iso = fromBuddhistDate(next);
    lastEmitted.current = iso ?? "";
    onChange(iso ?? "");
  }} />;
}
