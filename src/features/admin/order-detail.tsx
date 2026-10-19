"use client";

import { useState } from "react";
import { Check, ShieldCheck, X, ScanLine } from "lucide-react";
import { useAuth } from "./auth-provider";
import { canWrite } from "./permissions";
import { useAsync } from "./use-async";
import { useToast } from "./toast-provider";
import { date, formatAddress, money } from "./format";
import { ordersApi, slipsApi } from "@/lib/api";
import { fieldErrorsFor, formMessage } from "@/lib/api/errors";
import type { OrderDetail as OrderDetailData } from "@/lib/api/types";
import { OrderAddressForm } from "./order-address-form";
import { OrderNotes } from "./order-notes";
import { OrderTimeline } from "./order-timeline";
import { ErrorState, LoadingState } from "@/components/data-states";
import { Badge, Modal } from "@/components/ui";

const TRANSACTION_REF = /^[A-Za-z0-9\-_/.]{3,64}$/;
const TRANSACTION_REF_HINT = "กรอก 3–64 ตัว ใช้ได้เฉพาะตัวอักษรอังกฤษ ตัวเลข และ - _ / .";
const REASON_MAX = 500;

type Mode = "view" | "rejecting" | "cancelling";

function SlipImage({ paymentId }: { paymentId: string | null }) {
  const [failed, setFailed] = useState(false);
  if (!paymentId || failed) {
    return (
      <>
        <ScanLine size={34} aria-hidden="true" />
        <p role="status">ไม่พบรูปสลิป</p>
      </>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- cookie-authenticated, no-store image
    <img
      src={slipsApi.slipImageUrl(paymentId)}
      alt="สลิปการโอนเงิน"
      onError={() => setFailed(true)}
    />
  );
}

export function OrderDetail({
  orderId,
  onClose,
  onChanged,
  review = false,
  paymentId,
}: {
  orderId: string;
  onClose: () => void;
  /** Called after a successful cancel/approve/reject so lists can reload. */
  onChanged?: () => void;
  review?: boolean;
  paymentId?: string | null;
}) {
  const { user } = useAuth();
  const notify = useToast();
  const { data: order, error: loadError, loading, reload } = useAsync(
    (signal) => ordersApi.getOrder(orderId, signal),
    [orderId],
  );
  const [mode, setMode] = useState<Mode>("view");
  const [reason, setReason] = useState("");
  const [transactionRef, setTransactionRef] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [editingAddress, setEditingAddress] = useState(false);
  const writable = canWrite(user.role);

  async function run(
    action: () => Promise<OrderDetailData>,
    success: string,
  ) {
    setPending(true);
    setError("");
    setFieldErrors({});
    try {
      await action();
      notify(success);
      onChanged?.();
      onClose();
    } catch (failure) {
      setFieldErrors(fieldErrorsFor(failure));
      setError(formMessage(failure));
    } finally {
      setPending(false);
    }
  }

  function approve(current: OrderDetailData) {
    const ref = transactionRef.trim();
    if (!TRANSACTION_REF.test(ref)) {
      setFieldErrors({ transactionRef: TRANSACTION_REF_HINT });
      return;
    }
    void run(
      () => ordersApi.approveOrder(current.id, ref),
      `อนุมัติสลิป ${current.orderNo} แล้ว`,
    );
  }

  function reject(current: OrderDetailData) {
    if (!reason.trim()) {
      setFieldErrors({ reason: "กรุณาพิมพ์เหตุผลที่ปฏิเสธสลิป" });
      return;
    }
    void run(
      () => ordersApi.rejectOrder(current.id, reason.trim()),
      `ปฏิเสธสลิป ${current.orderNo} แล้ว`,
    );
  }

  function cancel(current: OrderDetailData) {
    void run(
      () => ordersApi.cancelOrder(current.id, reason.trim()),
      `ยกเลิกออเดอร์ ${current.orderNo} แล้ว`,
    );
  }

  const title = review ? "ตรวจสลิป" : "รายละเอียดออเดอร์";
  if (!order) {
    return (
      <Modal title={title} wide onClose={onClose}>
        <div className="modal-body">
          {loadError && <ErrorState message={loadError} onRetry={reload} />}
          {loading && <LoadingState />}
        </div>
        <div className="modal-actions">
          <button className="button" onClick={onClose}>
            ปิด
          </button>
        </div>
      </Modal>
    );
  }

  const canReview = review && writable && order.status === "slip_uploaded";
  const canCancel =
    writable && ["pending", "slip_uploaded", "rejected"].includes(order.status);
  const slipPaymentId =
    paymentId ??
    order.payments.find((payment) => payment.status === "submitted")?.id ??
    order.payments[0]?.id ??
    null;
  return (
    <Modal title={title} wide onClose={onClose}>
      <div className="modal-body">
        <div className="detail-heading">
          <div>
            <h3>{order.orderNo}</h3>
            <p>{date(order.createdAt, true)}</p>
          </div>
          <Badge status={order.status} />
        </div>
        <div className={review ? "review-layout" : ""}>
          {review && (
            <div className="slip-preview">
              <SlipImage paymentId={slipPaymentId} />
              <b>{money(order.amount)}</b>
            </div>
          )}
          <div>
            <dl className="detail-list">
              <div>
                <dt>งานวิ่ง</dt>
                <dd>{order.eventName}</dd>
              </div>
              <div>
                <dt>ผู้ติดต่อ</dt>
                <dd>
                  {order.contactName}
                  <small>{order.contactPhone}</small>
                </dd>
              </div>
              <div>
                <dt>ยอดที่ต้องชำระ</dt>
                <dd className="amount-highlight">{money(order.amount)}</dd>
              </div>
              <div>
                <dt>วิธีรับชุดวิ่ง</dt>
                <dd>
                  {order.delivery === "pickup"
                    ? "รับเองที่หน้างาน"
                    : "ส่งพัสดุ"}
                </dd>
              </div>
              {order.address && (
                <div>
                  <dt>ที่อยู่จัดส่ง</dt>
                  <dd>
                    {formatAddress(order.address)}
                    {order.canEditAddress && writable && !editingAddress && (
                      <button
                        type="button"
                        className="button small-button address-edit-button"
                        onClick={() => setEditingAddress(true)}
                      >
                        แก้ไขที่อยู่
                      </button>
                    )}
                  </dd>
                </div>
              )}
              {order.trackingNo && (
                <div>
                  <dt>เลขพัสดุ</dt>
                  <dd>
                    {order.trackingNo}
                    <small>{order.trackingProvider}</small>
                  </dd>
                </div>
              )}
              {order.transactionRef && (
                <div>
                  <dt>เลขอ้างอิงการโอน</dt>
                  <dd>{order.transactionRef}</dd>
                </div>
              )}
              {order.reviewedAt && (
                <div>
                  <dt>ตรวจโดย</dt>
                  <dd>
                    {order.reviewedByName ?? order.reviewedBy}
                    <small>{date(order.reviewedAt, true)}</small>
                  </dd>
                </div>
              )}
              {order.rejectionReason && (
                <div>
                  <dt>เหตุผลที่สลิปไม่ผ่าน</dt>
                  <dd className="danger-text">{order.rejectionReason}</dd>
                </div>
              )}
              {order.cancelReason && (
                <div>
                  <dt>เหตุผลที่ยกเลิก</dt>
                  <dd>{order.cancelReason}</dd>
                </div>
              )}
            </dl>
            {editingAddress && order.canEditAddress && order.address && (
              <OrderAddressForm
                orderId={order.id}
                initial={order.address}
                onSaved={() => {
                  reload();
                  onChanged?.();
                }}
                onClose={() => setEditingAddress(false)}
              />
            )}
            <div className="detail-participants">
              <h3>ผู้สมัคร {order.participants.length} คน</h3>
              {order.participants.map((p) => (
                <div key={p.id}>
                  <span className="avatar small">{p.firstName.slice(0, 1)}</span>
                  <span>
                    {p.firstName} {p.lastName}
                    <small>
                      {p.raceName} · เสื้อ {p.size}
                    </small>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
        {canReview && mode === "view" && (
          <label className="rejection-field">
            เลขอ้างอิงการโอน (ดูจากสลิป)
            <input
              value={transactionRef}
              maxLength={64}
              aria-invalid={Boolean(fieldErrors.transactionRef)}
              onChange={(e) => setTransactionRef(e.target.value)}
              placeholder="เช่น 202610150001"
            />
            {fieldErrors.transactionRef && (
              <small className="danger-text">{fieldErrors.transactionRef}</small>
            )}
          </label>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {mode === "rejecting" && (
          <label className="rejection-field">
            เหตุผลที่ปฏิเสธสลิป
            <textarea
              autoFocus
              required
              maxLength={REASON_MAX}
              aria-invalid={Boolean(fieldErrors.reason)}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="เช่น ยอดเงินไม่ตรง หรือรูปไม่ชัด"
            />
            {fieldErrors.reason && (
              <small className="danger-text">{fieldErrors.reason}</small>
            )}
          </label>
        )}
        {mode === "cancelling" && (
          <label className="rejection-field">
            เหตุผลที่ยกเลิก (ไม่บังคับ)
            <textarea
              autoFocus
              maxLength={REASON_MAX}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="เช่น ผู้สมัครขอยกเลิก"
            />
            <small className="muted">
              ยกเลิกแล้วกู้คืนไม่ได้ และที่นั่งจะกลับไปเปิดให้คนอื่นสมัคร
            </small>
            {fieldErrors.reason && (
              <small className="danger-text">{fieldErrors.reason}</small>
            )}
          </label>
        )}
        <OrderNotes orderId={order.id} notes={order.notes} onChanged={reload} />
        <OrderTimeline entries={order.timeline} />
      </div>
      <div className="modal-actions">
        {mode === "rejecting" ? (
          <>
            <button
              className="button"
              disabled={pending}
              onClick={() => setMode("view")}
            >
              กลับ
            </button>
            <button
              className="button danger"
              disabled={pending}
              onClick={() => reject(order)}
            >
              ปฏิเสธสลิป
            </button>
          </>
        ) : mode === "cancelling" ? (
          <>
            <button
              className="button"
              disabled={pending}
              onClick={() => setMode("view")}
            >
              กลับ
            </button>
            <button
              className="button danger-outline"
              disabled={pending}
              onClick={() => cancel(order)}
            >
              ยืนยันยกเลิกออเดอร์
            </button>
          </>
        ) : (
          <>
            {canReview && (
              <>
                <button
                  className="button"
                  disabled={pending}
                  onClick={() => {
                    setError("");
                    setFieldErrors({});
                    setReason("");
                    setMode("rejecting");
                  }}
                >
                  <X size={16} aria-hidden="true" />
                  ปฏิเสธสลิป
                </button>
                <button
                  className="button primary"
                  disabled={pending}
                  onClick={() => approve(order)}
                >
                  <ShieldCheck size={17} aria-hidden="true" />
                  อนุมัติสลิป
                </button>
              </>
            )}
            {!canReview && canCancel && (
              <button
                className="button danger-outline"
                onClick={() => {
                  setError("");
                  setFieldErrors({});
                  setReason("");
                  setMode("cancelling");
                }}
              >
                ยกเลิกออเดอร์
              </button>
            )}
            {!canReview && (
              <button className="button" onClick={onClose}>
                <Check size={16} aria-hidden="true" />
                ปิด
              </button>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
