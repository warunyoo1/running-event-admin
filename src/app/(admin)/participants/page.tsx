"use client";

import { useState, type FormEvent } from "react";
import { Check, Download, Pencil, Users, X } from "lucide-react";
import { useAuth } from "@/features/admin/auth-provider";
import { canWrite } from "@/features/admin/permissions";
import { useScope } from "@/features/admin/scope-provider";
import { useAsync } from "@/features/admin/use-async";
import { useDebounced } from "@/features/admin/use-debounced";
import { useToast } from "@/features/admin/toast-provider";
import { exportLimitNotice, statusLabels } from "@/features/admin/format";
import { exportsApi, participantsApi } from "@/lib/api";
import { errorMessage, fieldErrorsFor } from "@/lib/api/errors";
import { EXPORT_LIMIT, PAGE_SIZE } from "@/lib/constants";
import type { OrderStatus, ParticipantRow } from "@/lib/api/types";
import { ErrorState, LoadingState, Pager } from "@/components/data-states";
import { Badge, EmptyState, PageHeading, SearchField } from "@/components/ui";

const ORDER_STATUSES: OrderStatus[] = [
  "pending",
  "slip_uploaded",
  "paid",
  "rejected",
  "expired",
  "cancelled",
];
const BIB_MAX = 20;

function BibCell({
  participant,
  editable,
  onSaved,
}: {
  participant: ParticipantRow;
  editable: boolean;
  onSaved: () => void;
}) {
  const notify = useToast();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      // Empty clears the BIB: the API expects null, never "".
      await participantsApi.patchParticipant(participant.id, {
        bibNo: value.trim() || null,
      });
      notify("บันทึกเลข BIB แล้ว");
      setEditing(false);
      onSaved();
    } catch (failure) {
      setError(fieldErrorsFor(failure).bibNo || errorMessage(failure));
    } finally {
      setPending(false);
    }
  }

  if (!editing) {
    return (
      <span className="bib-edit">
        {participant.bibNo || "ยังไม่ระบุ"}
        {editable && (
          <button
            className="icon-button"
            aria-label={`แก้ไขเลข BIB ของ ${participant.firstName} ${participant.lastName}`}
            onClick={() => {
              setValue(participant.bibNo ?? "");
              setError("");
              setEditing(true);
            }}
          >
            <Pencil size={15} />
          </button>
        )}
      </span>
    );
  }
  return (
    <form onSubmit={save}>
      <span className="bib-edit">
        <input
          autoFocus
          value={value}
          maxLength={BIB_MAX}
          aria-label="เลข BIB"
          aria-invalid={Boolean(error)}
          onChange={(e) => setValue(e.target.value)}
        />
        <button
          className="icon-button"
          type="submit"
          disabled={pending}
          aria-label="บันทึกเลข BIB"
        >
          <Check size={15} />
        </button>
        <button
          className="icon-button"
          type="button"
          disabled={pending}
          aria-label="ยกเลิกการแก้ไข"
          onClick={() => setEditing(false)}
        >
          <X size={15} />
        </button>
      </span>
      {error && (
        <small className="danger-text" role="alert">
          {error}
        </small>
      )}
    </form>
  );
}

export default function ParticipantsPage() {
  const { user } = useAuth();
  const { events, scopeEventId } = useScope();
  const notify = useToast();
  const [query, setQuery] = useState("");
  const [race, setRace] = useState("");
  const [status, setStatus] = useState<OrderStatus | "">("");
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const q = useDebounced(query.trim());
  const filters = { eventId: scopeEventId, q, race, status };
  const { data, error, loading, reload } = useAsync(
    (signal) =>
      participantsApi.listParticipants(
        { ...filters, page, pageSize: PAGE_SIZE },
        signal,
      ),
    [scopeEventId, q, race, status, page],
  );
  const rows = data?.data ?? [];
  const raceNames = [
    ...new Set(
      events
        .filter((event) => !scopeEventId || event.id === scopeEventId)
        .flatMap((event) => event.races.map((item) => item.name)),
    ),
  ];
  const writable = canWrite(user.role);

  async function download() {
    setExporting(true);
    try {
      const { rows: count } = await exportsApi.exportParticipantsCsv(filters);
      if (count >= EXPORT_LIMIT) {
        notify(exportLimitNotice(EXPORT_LIMIT));
      }
    } catch (failure) {
      notify(errorMessage(failure));
    } finally {
      setExporting(false);
    }
  }
  function changeFilter(apply: () => void) {
    apply();
    setPage(1);
  }
  return (
    <>
      <PageHeading
        title="ผู้สมัคร"
        description="รายชื่อผู้สมัครทุกคน กรองตามระยะวิ่งหรือสถานะออเดอร์ได้ ใส่เลข BIB (เลขหน้าอก) ให้คนที่ชำระเงินแล้ว"
        action={
          <button
            className="button"
            disabled={!rows.length || exporting}
            onClick={download}
          >
            <Download size={16} aria-hidden="true" />
            ดาวน์โหลดรายชื่อ (CSV)
          </button>
        }
      />
      <div className="section-info">
        <Users size={20} aria-hidden="true" />
        <span>
          ทั้งหมด <strong>{data ? data.meta.total : "–"} คน</strong>{" "}
          ตามที่กรองอยู่
        </span>
      </div>
      <section className="panel">
        <div className="filter-bar in-panel">
          <SearchField
            value={query}
            onChange={(value) => changeFilter(() => setQuery(value))}
            placeholder="ค้นหาชื่อ เลข BIB หรือเลขออเดอร์"
          />
          <label>
            <span className="sr-only">ระยะวิ่ง</span>
            <select
              value={race}
              onChange={(e) => changeFilter(() => setRace(e.target.value))}
            >
              <option value="">ทุกระยะวิ่ง</option>
              {raceNames.map((name) => (
                <option value={name} key={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">สถานะออเดอร์</span>
            <select
              value={status}
              onChange={(e) =>
                changeFilter(() => setStatus(e.target.value as OrderStatus | ""))
              }
            >
              <option value="">ทุกสถานะ</option>
              {ORDER_STATUSES.map((s) => (
                <option value={s} key={s}>
                  {statusLabels[s]}
                </option>
              ))}
            </select>
          </label>
        </div>
        {error && <ErrorState message={error} onRetry={reload} />}
        {!data && loading && <LoadingState />}
        {data &&
          (rows.length ? (
            <>
              <div className="table-scroll" aria-busy={loading}>
                <table>
                  <thead>
                    <tr>
                      <th>ผู้สมัคร</th>
                      <th>ระยะวิ่ง</th>
                      <th>ไซซ์เสื้อ</th>
                      <th>เลข BIB (เลขหน้าอก)</th>
                      <th>เลขออเดอร์</th>
                      <th>สถานะออเดอร์</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((p) => (
                      <tr key={p.id}>
                        <td>
                          <div className="person-cell">
                            <span className="avatar small">
                              {p.firstName.slice(0, 1)}
                            </span>
                            <strong>
                              {p.firstName} {p.lastName}
                            </strong>
                          </div>
                        </td>
                        <td>
                          <span className="race-chip">{p.raceName}</span>
                        </td>
                        <td>{p.size}</td>
                        <td className="numeric-left">
                          <BibCell
                            key={`${p.id}-${p.bibNo ?? ""}`}
                            participant={p}
                            editable={writable && p.orderStatus === "paid"}
                            onSaved={reload}
                          />
                        </td>
                        <td className="muted">{p.orderNo}</td>
                        <td>
                          <Badge status={p.orderStatus} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pager meta={data.meta} unit="คน" onPage={setPage} />
            </>
          ) : (
            <EmptyState title="ไม่พบผู้สมัคร" />
          ))}
      </section>
    </>
  );
}
