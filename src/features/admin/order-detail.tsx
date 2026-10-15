"use client";

import { useState } from "react";
import { Check, ShieldCheck, X, ScanLine } from "lucide-react";
import { useDemo } from "./demo-store";
import { date, money, type Order } from "./data";
import { Badge, Modal } from "@/components/ui";

export function OrderDetail({
  orderId,
  onClose,
  review = false,
}: {
  orderId: string;
  onClose: () => void;
  review?: boolean;
}) {
  const { orders, events, updateOrder, notify } = useDemo();
  const order = orders.find((o) => o.id === orderId);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  if (!order) return null;
  function approve(current: Order) {
    if (current.status !== "slip_uploaded") return;
    if (
      orders.some(
        (o) =>
          o.id !== current.id &&
          o.status === "paid" &&
          o.reference === current.reference,
      )
    ) {
      setError("พบเลขอ้างอิงธุรกรรมซ้ำกับออเดอร์ที่ชำระเงินแล้ว");
      return;
    }
    updateOrder(current.id, {
      status: "paid",
      reviewedAt: new Date().toISOString(),
      reviewedBy: "ผู้ดูแลระบบสาธิต",
      rejectionReason: undefined,
    });
    notify(`อนุมัติสลิปสาธิต ${current.id} แล้ว`);
    onClose();
  }
  return (
    <Modal
      title={review ? "ตรวจสอบสลิปชำระเงิน" : "รายละเอียดออเดอร์"}
      wide
      onClose={onClose}
    >
      <div className="modal-body">
        <div className="detail-heading">
          <div>
            <h3>{order.id}</h3>
            <p>{date(order.createdAt, true)}</p>
          </div>
          <Badge status={order.status} />
        </div>
        <div className={review ? "review-layout" : ""}>
          {review && (
            <div className="slip-preview">
              <ScanLine size={34} aria-hidden="true" />
              <span className="demo-pill">ตัวอย่างสลิปสาธิต</span>
              <strong>โอนเงินสำเร็จ</strong>
              <span>รูปแบบจำลองสำหรับทดสอบหน้าจอ</span>
              <b>{money(order.amount)}</b>
              <div>
                <small>ผู้โอน</small>
                <p>{order.contact}</p>
                <small>ผู้รับ</small>
                <p>บัญชีตัวอย่างงานวิ่ง</p>
                <small>เลขอ้างอิง</small>
                <p className="reference">{order.reference}</p>
              </div>
              <p className="slip-watermark">ไม่ใช่หลักฐานการชำระเงินจริง</p>
            </div>
          )}
          <div>
            <dl className="detail-list">
              <div>
                <dt>งานวิ่ง</dt>
                <dd>{events.find((e) => e.id === order.eventId)?.name}</dd>
              </div>
              <div>
                <dt>ผู้ติดต่อ</dt>
                <dd>
                  {order.contact}
                  <small>{order.phone}</small>
                </dd>
              </div>
              <div>
                <dt>ยอดที่ต้องชำระ</dt>
                <dd className="amount-highlight">{money(order.amount)}</dd>
              </div>
              <div>
                <dt>การรับอุปกรณ์</dt>
                <dd>
                  {order.delivery === "pickup"
                    ? "รับด้วยตนเอง"
                    : "จัดส่งทางพัสดุ"}
                </dd>
              </div>
              {order.address && (
                <div>
                  <dt>ที่อยู่จัดส่ง</dt>
                  <dd>{order.address}</dd>
                </div>
              )}
              {order.reviewedAt && (
                <div>
                  <dt>ตรวจสอบโดย</dt>
                  <dd>
                    {order.reviewedBy}
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
            </dl>
            <div className="detail-participants">
              <h3>ผู้สมัคร {order.participants.length} คน</h3>
              {order.participants.map((p) => (
                <div key={p.id}>
                  <span className="avatar small">{p.name.slice(0, 1)}</span>
                  <span>
                    {p.name}
                    <small>
                      {p.race} · เสื้อ {p.size}
                    </small>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {rejecting && (
          <label className="rejection-field">
            เหตุผลที่สลิปไม่ผ่าน
            <textarea
              autoFocus
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="เช่น ยอดเงินไม่ตรง หรือภาพไม่ชัดเจน"
            />
          </label>
        )}
        {cancelling && (
          <div className="form-error" role="alert">
            ยืนยันการยกเลิกออเดอร์สาธิตนี้หรือไม่?
            ผู้สมัครในออเดอร์จะถูกนำออกจากยอดสมัครที่ยังมีสิทธิ์
          </div>
        )}
      </div>
      <div className="modal-actions">
        {review && order.status === "slip_uploaded" ? (
          rejecting ? (
            <>
              <button className="button" onClick={() => setRejecting(false)}>
                กลับ
              </button>
              <button
                className="button danger"
                onClick={() => {
                  if (!reason.trim()) {
                    setError("กรุณาระบุเหตุผลที่สลิปไม่ผ่าน");
                    return;
                  }
                  updateOrder(order.id, {
                    status: "rejected",
                    rejectionReason: reason.trim(),
                    reviewedAt: new Date().toISOString(),
                    reviewedBy: "ผู้ดูแลระบบสาธิต",
                  });
                  notify("บันทึกผลตรวจสลิปสาธิตแล้ว");
                  onClose();
                }}
              >
                ยืนยันสลิปไม่ผ่าน
              </button>
            </>
          ) : (
            <>
              <button className="button" onClick={() => setRejecting(true)}>
                <X size={16} aria-hidden="true" />
                สลิปไม่ผ่าน
              </button>
              <button className="button primary" onClick={() => approve(order)}>
                <ShieldCheck size={17} aria-hidden="true" />
                อนุมัติการชำระเงิน
              </button>
            </>
          )
        ) : (
          <>
            {!["paid", "cancelled", "expired"].includes(order.status) && (
              <button
                className="button danger-outline"
                onClick={() => {
                  if (!cancelling) {
                    setCancelling(true);
                    return;
                  }
                  updateOrder(order.id, { status: "cancelled" });
                  notify("ยกเลิกออเดอร์สาธิตแล้ว");
                  onClose();
                }}
              >
                {cancelling ? "ยืนยันยกเลิกออเดอร์" : "ยกเลิกออเดอร์"}
              </button>
            )}
            <button className="button" onClick={onClose}>
              <Check size={16} aria-hidden="true" />
              ปิดรายละเอียด
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}
