"use client";

import { useState, type FormEvent } from "react";
import { Download, PackageCheck, Save, Truck } from "lucide-react";
import { useAuth } from "@/features/admin/auth-provider";
import { canWrite } from "@/features/admin/permissions";
import { useScope } from "@/features/admin/scope-provider";
import { useAsync } from "@/features/admin/use-async";
import { useDebounced } from "@/features/admin/use-debounced";
import { useToast } from "@/features/admin/toast-provider";
import { exportLimitNotice, formatAddress } from "@/features/admin/format";
import { exportsApi, ordersApi, participantsApi, shippingApi } from "@/lib/api";
import { errorMessage, fieldErrorsFor, formMessage } from "@/lib/api/errors";
import { EXPORT_LIMIT, PAGE_SIZE } from "@/lib/constants";
import type { ShippingMethod, ShippingRow } from "@/lib/api/types";
import { ErrorState, LoadingState, Pager } from "@/components/data-states";
import {
  EmptyState,
  Modal,
  PageHeading,
  SearchField,
  handleTabKeys,
} from "@/components/ui";

const TRACKING_MAX = 100;

function TrackingModal({
  order,
  onClose,
  onSaved,
}: {
  order: ShippingRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const notify = useToast();
  const [provider, setProvider] = useState(order.trackingProvider ?? "");
  const [number, setNumber] = useState(order.trackingNo ?? "");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setFields({});
    try {
      await ordersApi.setTracking(order.orderId, {
        trackingProvider: provider.trim(),
        trackingNo: number.trim(),
      });
      notify("บันทึกเลขพัสดุแล้ว");
      onSaved();
      onClose();
    } catch (failure) {
      setFields(fieldErrorsFor(failure));
      setError(formMessage(failure));
    } finally {
      setPending(false);
    }
  }
  return (
    <Modal title="บันทึกเลขพัสดุ" onClose={onClose}>
      <form onSubmit={save}>
        <div className="modal-body form-grid">
          <p className="full muted">ออเดอร์ {order.orderNo}</p>
          <label className="full">
            บริษัทขนส่ง
            <input
              autoFocus
              required
              maxLength={TRACKING_MAX}
              aria-invalid={Boolean(fields.trackingProvider)}
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              placeholder="เช่น Flash Express"
            />
            {fields.trackingProvider && (
              <small className="danger-text">{fields.trackingProvider}</small>
            )}
          </label>
          <label className="full">
            เลขพัสดุ
            <input
              required
              maxLength={TRACKING_MAX}
              aria-invalid={Boolean(fields.trackingNo)}
              value={number}
              onChange={(e) => setNumber(e.target.value)}
            />
            {fields.trackingNo && (
              <small className="danger-text">{fields.trackingNo}</small>
            )}
          </label>
          {error && (
            <p className="form-error full" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="modal-actions">
          <button
            className="button"
            type="button"
            disabled={pending}
            onClick={onClose}
          >
            ยกเลิก
          </button>
          <button className="button primary" type="submit" disabled={pending}>
            <Save size={16} aria-hidden="true" />
            บันทึกเลขพัสดุ
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function ShippingPage() {
  const { user } = useAuth();
  const { scopeEventId } = useScope();
  const notify = useToast();
  const [tab, setTab] = useState<ShippingMethod>("pickup");
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const q = useDebounced(query.trim());
  const [editing, setEditing] = useState<ShippingRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const { data, error, loading, reload } = useAsync(
    (signal) =>
      shippingApi.listShipping(
        { eventId: scopeEventId, method: tab, q, page, pageSize: PAGE_SIZE },
        signal,
      ),
    [scopeEventId, tab, q, page],
  );
  const writable = canWrite(user.role);

  async function toggleCollected(id: string, collected: boolean) {
    setBusyId(id);
    try {
      await participantsApi.patchParticipant(id, { collected: !collected });
      notify(collected ? "เปลี่ยนเป็น “ยังไม่ได้รับชุดวิ่ง” แล้ว" : "บันทึกว่ารับชุดวิ่งแล้ว");
      reload();
    } catch (failure) {
      notify(errorMessage(failure));
    } finally {
      setBusyId(null);
    }
  }
  async function download() {
    setExporting(true);
    try {
      const { rows: count } = await exportsApi.exportFulfillmentCsv({
        eventId: scopeEventId,
        method: tab,
        q,
      });
      if (count >= EXPORT_LIMIT) {
        notify(exportLimitNotice(EXPORT_LIMIT));
      }
    } catch (failure) {
      notify(errorMessage(failure));
    } finally {
      setExporting(false);
    }
  }
  function changeQuery(value: string) {
    setQuery(value);
    setPage(1);
  }
  function changeTab(value: ShippingMethod) {
    setTab(value);
    setPage(1);
  }
  return (
    <>
      <PageHeading
        title="รับชุดวิ่งและจัดส่ง"
        description="ติดตามการรับเสื้อและเลข BIB (เลขหน้าอก) หรือการส่งพัสดุ เฉพาะออเดอร์ที่ชำระเงินแล้ว"
        action={
          <button
            className="button"
            disabled={!data?.data.length || exporting}
            onClick={download}
          >
            <Download size={16} aria-hidden="true" />
            ดาวน์โหลดรายการ (CSV)
          </button>
        }
      />
      <section className="panel">
        <div
          className="tabs"
          role="tablist"
          aria-label="วิธีรับชุดวิ่ง"
          onKeyDown={handleTabKeys}
        >
          <button
            id="pickup-tab"
            role="tab"
            aria-selected={tab === "pickup"}
            tabIndex={tab === "pickup" ? 0 : -1}
            aria-controls="fulfillment-panel"
            onClick={() => changeTab("pickup")}
          >
            <PackageCheck size={17} aria-hidden="true" />
            รับเองที่หน้างาน
            {tab === "pickup" && data && <span>{data.meta.total}</span>}
          </button>
          <button
            id="shipping-tab"
            role="tab"
            aria-selected={tab === "shipping"}
            tabIndex={tab === "shipping" ? 0 : -1}
            aria-controls="fulfillment-panel"
            onClick={() => changeTab("shipping")}
          >
            <Truck size={17} aria-hidden="true" />
            ส่งพัสดุ
            {tab === "shipping" && data && <span>{data.meta.total}</span>}
          </button>
        </div>
        <div className="filter-bar in-panel">
          <SearchField
            value={query}
            onChange={changeQuery}
            placeholder="ค้นหาชื่อ เลขออเดอร์ เบอร์โทร เลขพัสดุ หรือเลข BIB"
          />
          <span className="result-count">{data ? data.meta.total : 0} ออเดอร์</span>
        </div>
        <div
          id="fulfillment-panel"
          role="tabpanel"
          aria-labelledby={`${tab}-tab`}
        >
          {error && <ErrorState message={error} onRetry={reload} />}
          {!data && loading && <LoadingState />}
          {data &&
            (data.data.length ? (
              <>
                <div className="table-scroll" aria-busy={loading}>
                  <table>
                    <thead>
                      <tr>
                        <th>เลขออเดอร์</th>
                        <th>
                          {tab === "pickup"
                            ? "ผู้สมัคร / ไซซ์เสื้อ"
                            : "ผู้ติดต่อ / ที่อยู่จัดส่ง"}
                        </th>
                        <th>{tab === "pickup" ? "รับชุดวิ่งแล้วหรือยัง" : "เลขพัสดุ"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.data.map((order) => (
                        <tr key={order.orderId}>
                          <td className="strong">{order.orderNo}</td>
                          <td>
                            {tab === "pickup" ? (
                              order.participants.map((p) => (
                                <div className="pickup-person" key={p.id}>
                                  <strong>{p.name}</strong>
                                  <small>
                                    {p.race} · เสื้อ {p.size} · เลข BIB{" "}
                                    {p.bibNo || "ยังไม่ระบุ"}
                                  </small>
                                </div>
                              ))
                            ) : (
                              <>
                                <strong>{order.contactName}</strong>
                                <small className="cell-sub address">
                                  {order.address
                                    ? formatAddress(order.address)
                                    : "–"}
                                </small>
                              </>
                            )}
                          </td>
                          <td>
                            {tab === "pickup" ? (
                              order.participants.map((p) => (
                                <label
                                  className="checkbox-label pickup-check"
                                  key={p.id}
                                >
                                  <input
                                    type="checkbox"
                                    checked={p.collected}
                                    disabled={!writable || busyId === p.id}
                                    onChange={() =>
                                      toggleCollected(p.id, p.collected)
                                    }
                                  />
                                  {p.collected
                                    ? "รับชุดวิ่งแล้ว"
                                    : "ยังไม่ได้รับชุดวิ่ง"}
                                </label>
                              ))
                            ) : writable ? (
                              <button
                                className="text-link"
                                onClick={() => setEditing(order)}
                              >
                                {order.trackingNo
                                  ? `${order.trackingProvider ?? ""} ${order.trackingNo}`.trim()
                                  : "เพิ่มเลขพัสดุ"}
                              </button>
                            ) : (
                              <span>
                                {order.trackingNo
                                  ? `${order.trackingProvider ?? ""} ${order.trackingNo}`.trim()
                                  : "–"}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pager meta={data.meta} unit="ออเดอร์" onPage={setPage} />
              </>
            ) : (
              <EmptyState
                title="ไม่พบรายการ"
                description="หน้านี้แสดงเฉพาะออเดอร์ที่ชำระเงินแล้ว"
              />
            ))}
        </div>
      </section>
      {editing && (
        <TrackingModal
          order={editing}
          onClose={() => setEditing(null)}
          onSaved={reload}
        />
      )}
    </>
  );
}
