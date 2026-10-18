"use client";

import { useId, useState, type FormEvent } from "react";
import { useToast } from "./toast-provider";
import { ordersApi } from "@/lib/api";
import { ApiError, fieldErrorsFor, formMessage } from "@/lib/api/errors";
import { PROVINCES } from "@/lib/constants";
import type { Address } from "@/lib/api/types";

const HTTP_CONFLICT = 409;
const LOCKED_MESSAGE = "ไม่สามารถแก้ไขที่อยู่ได้ในสถานะปัจจุบัน";

/** Inline address editor. Stays in the order modal: `onSaved` reloads the detail, `onClose` hides the form. */
export function OrderAddressForm({
  orderId,
  initial,
  onSaved,
  onClose,
}: {
  orderId: string;
  initial: Address;
  onSaved: () => void;
  onClose: () => void;
}) {
  const notify = useToast();
  const ids = useId();
  const [form, setForm] = useState<Address>(initial);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const set = (key: keyof Address) => (value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    setFields({});
    try {
      await ordersApi.updateAddress(orderId, {
        street: form.street.trim(),
        subdistrict: form.subdistrict.trim(),
        district: form.district.trim(),
        province: form.province,
        postalCode: form.postalCode.trim(),
      });
      notify("บันทึกที่อยู่แล้ว");
      onSaved();
      onClose();
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === HTTP_CONFLICT) {
        // Tracking number, cancel or expiry won the race: the edit button disappears after the reload.
        setError(LOCKED_MESSAGE);
        onSaved();
        return;
      }
      setFields(fieldErrorsFor(failure));
      setError(formMessage(failure));
    } finally {
      setPending(false);
    }
  }

  const text = (key: "street" | "subdistrict" | "district" | "postalCode", label: string, max: number, wide = false) => (
    <label className={wide ? "full" : undefined} htmlFor={`${ids}-${key}`}>
      {label}
      <input
        id={`${ids}-${key}`}
        value={form[key]}
        maxLength={max}
        inputMode={key === "postalCode" ? "numeric" : undefined}
        aria-invalid={Boolean(fields[key])}
        aria-describedby={fields[key] ? `${ids}-${key}-error` : undefined}
        disabled={pending}
        onChange={(e) => set(key)(e.target.value)}
      />
      {fields[key] && (
        <small id={`${ids}-${key}-error`} className="danger-text">
          {fields[key]}
        </small>
      )}
    </label>
  );

  return (
    <form className="order-address-form" onSubmit={(event) => void submit(event)} aria-label="แก้ไขที่อยู่จัดส่ง">
      <h3>แก้ไขที่อยู่จัดส่ง</h3>
      <div className="form-grid">
        {text("street", "ที่อยู่", 300, true)}
        {text("subdistrict", "ตำบล / แขวง", 100)}
        {text("district", "อำเภอ / เขต", 100)}
        <label htmlFor={`${ids}-province`}>
          จังหวัด
          <select
            id={`${ids}-province`}
            value={form.province}
            aria-invalid={Boolean(fields.province)}
            aria-describedby={fields.province ? `${ids}-province-error` : undefined}
            disabled={pending}
            onChange={(e) => set("province")(e.target.value)}
          >
            <option value="">เลือกจังหวัด</option>
            {PROVINCES.map((province) => (
              <option key={province} value={province}>
                {province}
              </option>
            ))}
          </select>
          {fields.province && (
            <small id={`${ids}-province-error`} className="danger-text">
              {fields.province}
            </small>
          )}
        </label>
        {text("postalCode", "รหัสไปรษณีย์", 10)}
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="order-address-actions">
        <button type="button" className="button" disabled={pending} onClick={onClose}>
          ยกเลิก
        </button>
        <button type="submit" className="button primary" disabled={pending}>
          บันทึกที่อยู่
        </button>
      </div>
    </form>
  );
}
