"use client";

import { Suspense, useEffect, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  CalendarDays,
  MapPin,
  Plus,
  ArrowUpRight,
  Trash2,
  Users,
  Save,
} from "lucide-react";
import { BuddhistDateInput } from "@/components/buddhist-date-input";
import { DiscardChangesDialog } from "@/components/discard-changes-dialog";
import { useAuth } from "@/features/admin/auth-provider";
import {
  EventImagesSection,
  StagedImagesSection,
  uploadFiles,
  useStagedImages,
} from "@/features/admin/event-images";
import { useScope } from "@/features/admin/scope-provider";
import { useAsync } from "@/features/admin/use-async";
import { useDebounced } from "@/features/admin/use-debounced";
import { useToast } from "@/features/admin/toast-provider";
import { isSuper } from "@/features/admin/permissions";
import {
  categoryLabels,
  date,
  eventStatusHints,
  money,
  number,
  statusLabels,
  themeLabels,
} from "@/features/admin/format";
import { eventsApi } from "@/lib/api";
import { errorMessage, fieldErrorsFor, formMessage } from "@/lib/api/errors";
import {
  DEFAULT_EVENT_CATEGORY,
  DEFAULT_EVENT_THEME,
  EVENT_CATEGORIES,
  EVENT_THEMES,
  PAGE_SIZE,
} from "@/lib/constants";
import {
  SLUG_MAX,
  SLUG_PATTERN,
  SLUG_TAKEN_CODE,
  isThaiFallback,
  nextSlugVariant,
  randomSuffix,
  slugify,
} from "@/lib/slug";
import { ApiError } from "@/lib/api/errors";
import type { AdminEvent, EventStatus } from "@/lib/api/types";
import type { EventForm } from "@/lib/api/endpoints/events";
import { ErrorState, LoadingState, Pager } from "@/components/data-states";
import { EventCover } from "@/components/event-cover";
import { EventImagesPanel } from "@/features/admin/event-images-panel";
import {
  Badge,
  EmptyState,
  Modal,
  PageHeading,
  SearchField,
} from "@/components/ui";

const EVENT_STATUSES: EventStatus[] = ["draft", "open", "closed", "upcoming"];
const NAME_MAX = 200;
const VENUE_MAX = 300;
const SUBTITLE_MAX = 300;
const DESCRIPTION_MAX = 5000;
const PROVINCE_MAX = 100;
const ORGANIZER_MAX = 200;
const REFUND_MAX = 2000;
const RACE_NAME_MAX = 50;
const MAX_RACES = 10;
const EVENT_HAS_ORDERS_CODE = "EVENT_HAS_ORDERS";

type RaceForm = EventForm["races"][number];
type Editing = { id: string | null; original: AdminEvent | null; form: EventForm };
/** `hasOrders` is set once the API refused a hard delete with EVENT_HAS_ORDERS. */
type Confirm = { kind: "archive" | "delete"; event: AdminEvent; hasOrders: boolean };

const emptyRace = (): RaceForm => ({ name: "", price: "0", quota: "100", unlimitedQuota: false, start: "", benefits: [], extraDetails: "", prizes: [] });

function newEditing(): Editing {
  return {
    id: null,
    original: null,
    form: {
      name: "",
      slug: "",
      subtitle: "",
      description: "",
      contactPhones: [],
      websiteUrl: "",
      locationUrl: "",
      shirtPickupUrl: "",
      date: "",
      venue: "",
      startPoint: "",
      shirtPickupPoint: "",
      province: "",
      category: "",
      theme: "",
      status: "draft",
      registrationStarts: "",
      registrationEnds: "",
      organizer: "",
      refundPolicy: "",
      races: [{ name: "5 KM", price: "399", quota: "500", unlimitedQuota: false, start: "", benefits: [], extraDetails: "", prizes: [] }],
    },
  };
}

function editingFrom(event: AdminEvent): Editing {
  return {
    id: event.id,
    original: event,
    form: {
      name: event.name,
      slug: event.slug,
      subtitle: event.subtitle ?? "",
      description: event.description ?? "",
      contactPhones: event.contactPhones ?? [],
      websiteUrl: event.websiteUrl ?? "",
      locationUrl: event.locationUrl ?? "",
      shirtPickupUrl: event.shirtPickupUrl ?? "",
      date: event.date,
      venue: event.venue,
      startPoint: event.startPoint ?? "",
      shirtPickupPoint: event.shirtPickupPoint ?? "",
      province: event.province ?? "",
      category: event.category ?? "",
      theme: event.theme ?? "",
      status: event.status,
      registrationStarts: event.registrationStarts ?? "",
      registrationEnds: event.registrationEnds ?? "",
      organizer: event.organizer ?? "",
      refundPolicy: event.refundPolicy ?? "",
      races: event.races.map((race) => ({
        id: race.id,
        name: race.name,
        price: String(race.price),
        quota: String(race.quota),
        unlimitedQuota: race.unlimitedQuota ?? false,
        start: race.start ?? "",
        benefits: race.benefits ?? [],
        extraDetails: race.extraDetails ?? "",
        prizes: (race.prizes ?? []).map((prize) => ({ rank: String(prize.rank), amount: String(prize.amount), trophy: prize.trophy ?? false })),
      })),
    },
  };
}

/** Confirm dialog for destructive actions: danger button, focus starts on the cancel button. */
function ConfirmDialog({
  title,
  message,
  error,
  confirmLabel,
  pendingLabel,
  pending,
  onConfirm,
  onClose,
}: {
  title: string;
  message: string;
  error: string;
  /** Omitted when there is nothing left to confirm (only the close button is shown). */
  confirmLabel?: string;
  pendingLabel: string;
  pending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  // Runs after Modal's effect has opened the <dialog>, so the focus call lands on a visible element.
  useEffect(() => {
    const timer = setTimeout(() => cancelRef.current?.focus());
    return () => clearTimeout(timer);
  }, []);
  return (
    <Modal title={title} onClose={onClose}>
      <div className="modal-body">
        <p>{message}</p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <div className="modal-actions">
        <button className="button" type="button" ref={cancelRef} onClick={onClose}>
          {confirmLabel ? "ยกเลิก" : "ปิด"}
        </button>
        {confirmLabel && (
          <button
            className="button danger"
            type="button"
            disabled={pending}
            onClick={onConfirm}
          >
            {pending ? pendingLabel : confirmLabel}
          </button>
        )}
      </div>
    </Modal>
  );
}

function confirmMessage({ kind, event, hasOrders }: Confirm): string {
  if (kind === "archive")
    return `ซ่อนงาน «${event.name}»? งานจะไม่แสดงบนเว็บรับสมัครและรับสมัครใหม่ไม่ได้ แต่ข้อมูลออเดอร์และรูปภาพยังอยู่ครบ กด “แสดงงานอีกครั้ง” เมื่อไรก็ได้`;
  if (hasOrders)
    return `งานนี้มีออเดอร์แล้ว จึงลบไม่ได้${event.archived ? "" : " ให้ซ่อนงานแทน ข้อมูลออเดอร์จะยังอยู่ครบ"}`;
  return `ลบงาน «${event.name}» ถาวร? ระยะวิ่งและรูปภาพทั้งหมดจะหายไปและกู้คืนไม่ได้ ลบได้เฉพาะงานที่ยังไม่มีออเดอร์ ถ้าไม่แน่ใจให้เลือก “ซ่อนงาน” แทน`;
}

/** `undefined` leaves only the close button (an archived event with orders has nothing to offer). */
function confirmLabel({ kind, event, hasOrders }: Confirm): string | undefined {
  if (kind === "archive") return "ซ่อนงาน";
  if (!hasOrders) return "ลบงานถาวร";
  return event.archived ? undefined : "ซ่อนงานแทน";
}

function FieldError({ message, id }: { message?: string; id?: string }) {
  return message ? (
    <span className="form-error" id={id}>
      {message}
    </span>
  ) : null;
}

export default function EventsPage() {
  return (
    <Suspense>
      <Events />
    </Suspense>
  );
}

function Events() {
  const { user } = useAuth();
  const { events: scopeEvents, ready, reloadEvents } = useScope();
  const notify = useToast();
  const searchParams = useSearchParams();
  const canEdit = isSuper(user.role);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<EventStatus | "">("");
  const [archived, setArchived] = useState(false);
  const [page, setPage] = useState(1);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [confirmError, setConfirmError] = useState("");
  const [confirmPending, setConfirmPending] = useState(false);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [editorStep, setEditorStep] = useState(0);
  const editorForm = useRef<HTMLFormElement>(null);
  const editorSteps = ["ข้อมูลงาน", "วันและสถานที่", "ระยะวิ่งและรางวัล", "รูปภาพ"];
  const [discardOpen, setDiscardOpen] = useState(false);
  const [viewing, setViewing] = useState<AdminEvent | null>(null);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [uploadFailures, setUploadFailures] = useState<{ name: string; reason: string }[]>([]);
  const [slugTouched, setSlugTouched] = useState(false);
  const [slugSuggestion, setSlugSuggestion] = useState("");
  const slugSuffix = useRef("");
  const staged = useStagedImages();
  const initialForm = useRef("");
  const dirty = Boolean(editing && (JSON.stringify(editing.form) !== initialForm.current || staged.items.length));
  useEffect(() => {
    if (!dirty && !pending) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, pending]);
  const deepLinked = useRef(false);
  const q = useDebounced(query.trim());
  const { data, error: loadError, loading, reload } = useAsync(
    (signal) =>
      eventsApi.listEvents({ q, status, archived, page, pageSize: PAGE_SIZE }, signal),
    [q, status, archived, page],
  );
  const rows = data?.data ?? [];

  useEffect(() => {
    const wanted = searchParams.get("event");
    if (!canEdit || !ready || !wanted || deepLinked.current) return;
    deepLinked.current = true;
    const found = scopeEvents.find((event) => event.id === wanted);
    if (found) {
      const next = editingFrom(found);
      initialForm.current = JSON.stringify(next.form);
      setEditing(next);
    }
  }, [searchParams, canEdit, ready, scopeEvents]);

  function open(next: Editing) {
    setEditorStep(0);
    setError("");
    setFields({});
    setUploadStatus("");
    setUploadFailures([]);
    staged.clear();
    setSlugTouched(false);
    setSlugSuggestion("");
    slugSuffix.current = randomSuffix();
    initialForm.current = JSON.stringify(next.form);
    setEditing(next);
  }
  function close() {
    if (pending) return;
    if (dirty) { setDiscardOpen(true); return; }
    discard();
  }
  function discard() {
    setDiscardOpen(false);
    staged.clear();
    setUploadStatus("");
    setUploadFailures([]);
    setEditing(null);
    setEditorStep(0);
  }
  function changeFilter(apply: () => void) {
    apply();
    setPage(1);
  }
  function setForm(patch: Partial<EventForm>) {
    setEditing((current) =>
      current ? { ...current, form: { ...current.form, ...patch } } : current,
    );
  }
  /** Create flow only: keep the slug following name/date until the user edits it. */
  function setAutoSlug(patch: Partial<EventForm>) {
    setEditing((current) => {
      if (!current) return current;
      const next = { ...current.form, ...patch };
      if (!current.id && !slugTouched) {
        next.slug = slugify(next.name, { date: next.date, suffix: slugSuffix.current });
      }
      return { ...current, form: next };
    });
  }
  function changeSlug(value: string) {
    setSlugSuggestion("");
    // Emptying the field hands control back to the name (applies on the next name change or blur).
    setSlugTouched(value !== "");
    setForm({ slug: value });
  }
  function setRace(index: number, patch: Partial<RaceForm>) {
    if (!editing) return;
    setForm({
      races: editing.form.races.map((race, i) => (i === index ? { ...race, ...patch } : race)),
    });
  }

  function ask(kind: Confirm["kind"], event: AdminEvent) {
    setConfirmError("");
    setConfirm({ kind, event, hasOrders: false });
  }
  function closeConfirm() {
    if (!confirmPending) setConfirm(null);
  }
  function afterChange() {
    reload();
    reloadEvents();
  }
  async function restore(event: AdminEvent) {
    try {
      await eventsApi.restoreEvent(event.id);
      notify(`แสดงงาน «${event.name}» อีกครั้งแล้ว`);
      afterChange();
    } catch (failure) {
      notify(errorMessage(failure));
    }
  }
  async function runConfirm() {
    if (!confirm) return;
    const { kind, event, hasOrders } = confirm;
    setConfirmPending(true);
    setConfirmError("");
    try {
      if (kind === "delete" && !hasOrders) {
        await eventsApi.deleteEvent(event.id);
        notify(`ลบงาน «${event.name}» แล้ว`);
      } else {
        // Archive ("hide"), or "hide instead" after a refused delete.
        await eventsApi.archiveEvent(event.id);
        notify(`ซ่อนงาน «${event.name}» แล้ว`);
      }
      setConfirm(null);
      afterChange();
    } catch (failure) {
      if (
        kind === "delete" &&
        failure instanceof ApiError &&
        failure.code === EVENT_HAS_ORDERS_CODE
      ) {
        setConfirm({ kind, event, hasOrders: true });
      } else {
        setConfirmError(errorMessage(failure));
      }
    } finally {
      setConfirmPending(false);
    }
  }

  function navigateEditor(step: number) {
    setEditorStep(step);
    requestAnimationFrame(() => {
      const body = editorForm.current?.querySelector(".modal-body");
      body?.scrollTo({ top: 0 });
      editorForm.current?.closest("dialog")?.scrollTo({ top: 0 });
      editorForm.current?.querySelector<HTMLElement>(`[data-editor-step="${step}"] input, [data-editor-step="${step}"] select, [data-editor-step="${step}"] textarea, [data-editor-step="${step}"] button`)?.focus({ preventScroll: true });
    });
  }
  function validateEditor(onlyCurrent = false) {
    const controls = editorForm.current?.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input, select, textarea");
    const invalid = Array.from(controls ?? []).find((control) =>
      (!onlyCurrent || control.closest("[data-editor-step]")?.getAttribute("data-editor-step") === String(editorStep)) && !control.checkValidity(),
    );
    if (!invalid) return true;
    navigateEditor(Number(invalid.closest("[data-editor-step]")?.getAttribute("data-editor-step") ?? 0));
    requestAnimationFrame(() => { invalid.focus(); invalid.reportValidity(); });
    return false;
  }
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing) return;
    if (editorStep < editorSteps.length - 1) {
      if (validateEditor(true)) navigateEditor(editorStep + 1);
      return;
    }
    if (!validateEditor()) return;
    setPending(true);
    setError("");
    setFields({});
    setUploadFailures([]);
    try {
      const body = eventsApi.toEventBody(editing.form);
      if (editing.id) {
        await eventsApi.updateEvent(editing.id, body);
        notify("บันทึกการแก้ไขแล้ว");
        setEditing(null);
      } else {
        // Keep the dialog open on the new event so images can be added right away.
        const created = await eventsApi.createEvent(body);
        const pendingFiles = staged.items;
        if (pendingFiles.length === 0) {
          notify("สร้างงานวิ่งแล้ว เพิ่มรูปภาพต่อได้เลย");
        } else {
          const result = await uploadFiles(created.id, pendingFiles, (n, total) =>
            setUploadStatus(`กำลังอัปโหลดรูป ${n} จาก ${total} ไฟล์…`),
          );
          setUploadStatus(`อัปโหลดสำเร็จ ${result.done} จาก ${pendingFiles.length} ไฟล์`);
          setUploadFailures(result.failures);
          notify(
            result.failures.length === 0
              ? `สร้างงานวิ่งและเพิ่มรูป ${result.done} รูปแล้ว`
              : `สร้างงานวิ่งแล้ว แต่เพิ่มรูปไม่สำเร็จ ${result.failures.length} ไฟล์ ลองเพิ่มใหม่ในส่วนรูปภาพ`,
          );
          staged.clear();
        }
        const next = editingFrom(created);
        initialForm.current = JSON.stringify(next.form);
        setEditing(next);
      }
      reload();
      reloadEvents();
    } catch (failure) {
      const nextFields = fieldErrorsFor(failure);
      setFields(nextFields);
      const firstField = Object.keys(nextFields)[0] ?? "";
      navigateEditor(firstField.startsWith("races") ? 2 : /^(date|registration|venue|startPoint|shirtPickupPoint|shirtPickupUrl|province|organizer|locationUrl|status|category|theme)/.test(firstField) ? 1 : 0);
      if (failure instanceof ApiError && failure.code === SLUG_TAKEN_CODE) {
        setSlugSuggestion(nextSlugVariant(editing.form.slug));
      }
      setError(formMessage(failure));
    } finally {
      setPending(false);
    }
  }

  const form = editing?.form;
  const original = editing?.original ?? null;
  return (
    <>
      <PageHeading
        title="จัดการงานวิ่ง"
        scope="global"
        description="สร้างงานวิ่ง แก้ไขรายละเอียด ระยะวิ่ง ราคา และรูปภาพ"
        action={
          canEdit && (
            <button className="button primary" onClick={() => open(newEditing())}>
              <Plus size={17} aria-hidden="true" />
              สร้างงานวิ่งใหม่
            </button>
          )
        }
      />
      <div className="filter-bar">
        <SearchField
          value={query}
          onChange={(value) => changeFilter(() => setQuery(value))}
          placeholder="ค้นหาชื่องานวิ่ง"
        />
        <label>
          <span className="sr-only">สถานะงานวิ่ง</span>
          <select
            value={status}
            onChange={(e) => changeFilter(() => setStatus(e.target.value as EventStatus | ""))}
          >
            <option value="">ทุกสถานะ</option>
            {EVENT_STATUSES.map((value) => (
              <option value={value} key={value}>
                {statusLabels[value]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">งานที่แสดง</span>
          <select
            value={archived ? "archived" : "active"}
            onChange={(e) => changeFilter(() => setArchived(e.target.value === "archived"))}
          >
            <option value="active">งานที่แสดงอยู่</option>
            <option value="archived">งานที่ซ่อนไว้</option>
          </select>
        </label>
        <span className="result-count">{data ? `${data.meta.total} งานวิ่ง` : ""}</span>
      </div>
      {loadError && <ErrorState message={loadError} onRetry={reload} />}
      {!data && loading && <LoadingState />}
      {data &&
        (rows.length ? (
          <>
            <div className="event-grid" aria-busy={loading}>
              {rows.map((event) => {
                const quota = event.races.reduce((sum, race) => sum + race.quota, 0);
                const unlimited = event.races.some((race) => race.unlimitedQuota);
                const count = event.races.reduce((sum, race) => sum + (race.unlimitedQuota ? (race.reserved ?? 0) : race.quota - race.remaining), 0);
                const lowest = Math.min(...event.races.map((race) => race.price));
                return (
                  <article className="event-card" key={event.id}>
                    <EventCover event={event} />
                    <div className="event-card-body">
                      <div className="event-card-meta">
                        <Badge status={event.status} />
                        {event.archived && (
                          <span className="badge badge-closed">
                            <span aria-hidden="true" />
                            ซ่อนอยู่
                          </span>
                        )}
                        <span>{event.races.map((race) => race.name).join(" / ")}</span>
                      </div>
                      <h2>{event.name}</h2>
                      <p>
                        <CalendarDays size={16} aria-hidden="true" />
                        {date(event.date)}
                      </p>
                      <p>
                        <MapPin size={16} aria-hidden="true" />
                        {event.venue}
                      </p>
                      <div className="quota">
                        <div>
                          <span>
                            <Users size={15} aria-hidden="true" />
                            จองแล้ว
                          </span>
                          <strong>
                            {number(count)}
                            <span> / {unlimited ? "ไม่จำกัดจำนวน" : `${number(quota)} คน`}</span>
                          </strong>
                        </div>
                        {!unlimited && <progress
                          value={count}
                          max={Math.max(1, quota)}
                          aria-label={`จองแล้ว ${count} จากจำนวนที่รับ ${quota} คน`}
                        />}
                      </div>
                      <div className="event-card-footer">
                        <span>ราคาเริ่มต้น {money(lowest)}</span>
                        <div className="event-card-actions">
                          <button className="text-link" onClick={() => setViewing(event)}>
                            ดูรูปภาพ
                          </button>
                          {canEdit && !event.archived && (
                            <button className="text-link" onClick={() => open(editingFrom(event))}>
                              แก้ไขงาน
                              <ArrowUpRight size={16} aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      </div>
                      {canEdit && (
                        <div className="event-card-actions">
                          {event.archived ? (
                            <button
                              className="button small-button"
                              onClick={() => restore(event)}
                            >
                              <ArchiveRestore size={15} aria-hidden="true" />
                              แสดงงานอีกครั้ง
                            </button>
                          ) : (
                            <button
                              className="button small-button"
                              onClick={() => ask("archive", event)}
                            >
                              <Archive size={15} aria-hidden="true" />
                              ซ่อนงาน
                            </button>
                          )}
                          <button
                            className="button small-button danger-outline"
                            onClick={() => ask("delete", event)}
                          >
                            <Trash2 size={15} aria-hidden="true" />
                            ลบงาน
                          </button>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
            <Pager meta={data.meta} unit="งานวิ่ง" onPage={setPage} />
          </>
        ) : (
          <EmptyState title="ไม่พบงานวิ่ง" />
        ))}
      {confirm && (
        <ConfirmDialog
          title={confirm.kind === "archive" ? "ซ่อนงานวิ่ง" : "ลบงานวิ่งถาวร"}
          message={confirmMessage(confirm)}
          error={confirmError}
          confirmLabel={confirmLabel(confirm)}
          pendingLabel="กำลังทำรายการ…"
          pending={confirmPending}
          onConfirm={runConfirm}
          onClose={closeConfirm}
        />
      )}
      {viewing && (
        <Modal title={`รูปภาพ: ${viewing.name}`} onClose={() => setViewing(null)}>
          <EventImagesPanel event={viewing} />
        </Modal>
      )}
      {discardOpen && (
        <DiscardChangesDialog
          onContinue={() => setDiscardOpen(false)}
          onDiscard={discard}
        />
      )}
      {editing && form && (
        <Modal
          title={editing.id ? "แก้ไขงานวิ่ง" : "สร้างงานวิ่งใหม่"}
          onClose={close}
          className="event-editor"
          wide
        >
          <form ref={editorForm} onSubmit={save} noValidate>
            <nav className="event-editor-steps" aria-label="หมวดข้อมูลงานวิ่ง">
              {editorSteps.map((label, index) => (
                <button key={label} type="button" aria-current={editorStep === index ? "step" : undefined} disabled={pending} onClick={() => navigateEditor(index)}>
                  <span className="event-step-number">{index + 1}</span><span>{label}</span>
                </button>
              ))}
            </nav>
            <div className="modal-body form-grid">
              {error && (
                <p className="form-error full" role="alert">
                  {error}
                </p>
              )}
              <fieldset data-editor-step="0" hidden={editorStep !== 0} className="event-form-section full form-grid">
                <legend>ข้อมูลงานวิ่ง</legend>
              <label className="full">
                ชื่องานวิ่ง
                <input
                  autoFocus
                  required
                  maxLength={NAME_MAX}
                  value={form.name}
                  aria-invalid={Boolean(fields.name)}
                  onChange={(e) => setAutoSlug({ name: e.target.value })}
                />
                <FieldError message={fields.name} />
              </label>
              <label className="full">
                ลิงก์ของงาน (ส่วนท้ายของ URL)
                <input
                  required
                  maxLength={SLUG_MAX}
                  pattern={SLUG_PATTERN}
                  title="ใช้ตัวอักษรอังกฤษพิมพ์เล็ก ตัวเลข และขีดกลาง เช่น bangkok-run-2027"
                  value={form.slug}
                  aria-invalid={Boolean(fields.slug)}
                  aria-describedby={`slug-hint${fields.slug ? " slug-error" : ""}`}
                  onChange={(e) => changeSlug(e.target.value)}
                  onBlur={() => {
                    if (!editing.id && form.slug === "") setAutoSlug({});
                  }}
                />
                <small id="slug-hint">
                  ใช้ได้เฉพาะตัวอักษรอังกฤษพิมพ์เล็ก ตัวเลข และขีดกลาง (-)
                  {editing.id
                    ? " · ระวัง: ถ้าเปลี่ยนลิงก์ ลิงก์เดิมที่แชร์ไปแล้วจะเปิดไม่ได้"
                    : slugTouched
                      ? ""
                      : " · ระบบสร้างให้จากชื่องาน แก้เองได้"}
                  {!editing.id &&
                    isThaiFallback(form.name) &&
                    " · ชื่องานเป็นภาษาไทย กรุณาพิมพ์ลิงก์เป็นภาษาอังกฤษเอง"}
                </small>
                <FieldError message={fields.slug} id="slug-error" />
                {slugSuggestion && fields.slug && (
                  <button
                    type="button"
                    className="button small-button"
                    onClick={() => {
                      setSlugTouched(true);
                      setForm({ slug: slugSuggestion });
                      setSlugSuggestion("");
                      setFields((f) => ({ ...f, slug: "" }));
                    }}
                  >
                    ใช้ {slugSuggestion} แทน
                  </button>
                )}
              </label>
              <label className="full">
                คำโปรย (ข้อความสั้นๆ ใต้ชื่องาน)
                <input
                  maxLength={SUBTITLE_MAX}
                  value={form.subtitle}
                  aria-invalid={Boolean(fields.subtitle)}
                  onChange={(e) => setForm({ subtitle: e.target.value })}
                />
                <FieldError message={fields.subtitle} />
              </label>
              <label className="full">
                รายละเอียดงาน
                <textarea
                  rows={4}
                  maxLength={DESCRIPTION_MAX}
                  value={form.description}
                  aria-invalid={Boolean(fields.description)}
                  onChange={(e) => setForm({ description: e.target.value })}
                />
                <FieldError message={fields.description} />
              </label>
              <label className="full">ลิงก์ข้อมูลงานเพิ่มเติม (ไม่บังคับ)
                <input type="url" maxLength={2048} placeholder="https:// เช่น เว็บไซต์งาน หรือโพสต์ประกาศจากผู้จัด" value={form.websiteUrl} aria-invalid={Boolean(fields.websiteUrl)} onChange={(e) => setForm({ websiteUrl: e.target.value })} />
                <FieldError message={fields.websiteUrl} />
              </label>
              <div className="full event-contact-phones">
                <div className="race-prize-heading"><strong>เบอร์โทรติดต่อผู้จัดงาน (ไม่บังคับ)</strong><button type="button" className="text-link" disabled={form.contactPhones.length >= 10} onClick={() => setForm({ contactPhones: [...form.contactPhones, ""] })}><Plus size={15} aria-hidden="true" />เพิ่มเบอร์โทร</button></div>
                <FieldError message={fields.contactPhones} />
                {!form.contactPhones.length && <p className="muted">เพิ่มได้หลายเบอร์ สำหรับให้ผู้สมัครติดต่อผู้จัดงาน</p>}
                {form.contactPhones.map((phone, phoneIndex) => <div className="event-contact-phone-row" key={phoneIndex}>
                  <label>เบอร์โทร {phoneIndex + 1}<input type="tel" autoComplete="off" maxLength={26} placeholder="เช่น 0812345678" value={phone} aria-invalid={Boolean(fields[`contactPhones.${phoneIndex}`])} onChange={(e) => setForm({ contactPhones: form.contactPhones.map((value, index) => index === phoneIndex ? e.target.value : value) })} /><FieldError message={fields[`contactPhones.${phoneIndex}`]} /></label>
                  <button type="button" className="button small-button" aria-label={`ลบเบอร์โทร ${phoneIndex + 1}`} onClick={() => setForm({ contactPhones: form.contactPhones.filter((_, index) => index !== phoneIndex) })}><Trash2 size={16} aria-hidden="true" />ลบ</button>
                </div>)}
              </div>
              </fieldset>
              <fieldset data-editor-step="1" hidden={editorStep !== 1} className="event-form-section full form-grid">
                <legend>กำหนดการและการเปิดรับสมัคร</legend>
              <label>
                วันที่จัดงาน (พ.ศ.)
                <BuddhistDateInput
                  required
                  value={form.date}
                  aria-invalid={Boolean(fields.date)}
                  onChange={(value) => setAutoSlug({ date: value })}
                />
                <FieldError message={fields.date} />
              </label>
              <div className="field-clearable">
                <label>
                  วันเปิดรับสมัคร (พ.ศ.)
                  <BuddhistDateInput value={form.registrationStarts} max={[form.registrationEnds, form.date].filter(Boolean).sort()[0]} aria-invalid={Boolean(fields.registrationStarts)} onChange={(value) => setForm({ registrationStarts: value })} />
                  <FieldError message={fields.registrationStarts} />
                </label>
                {form.registrationStarts && <button type="button" className="text-link" onClick={() => setForm({ registrationStarts: "" })}>ล้างวันที่</button>}
              </div>
              <div className="field-clearable">
                <label>
                  วันปิดรับสมัคร (พ.ศ.)
                  <BuddhistDateInput
                    value={form.registrationEnds}
                    min={form.registrationStarts || undefined}
                    aria-invalid={Boolean(fields.registrationEnds)}
                    onChange={(value) => setForm({ registrationEnds: value })}
                  />
                  <FieldError message={fields.registrationEnds} />
                </label>
                {form.registrationEnds && (
                  <button
                    type="button"
                    className="text-link"
                    onClick={() => setForm({ registrationEnds: "" })}
                  >
                    ล้างวันที่
                  </button>
                )}
              </div>
              <label>
                สถานะงาน
                <select
                  value={form.status}
                  aria-invalid={Boolean(fields.status)}
                  onChange={(e) => setForm({ status: e.target.value as EventStatus })}
                >
                  {EVENT_STATUSES.map((value) => (
                    <option value={value} key={value}>
                      {statusLabels[value]}
                    </option>
                  ))}
                </select>
                <small>{eventStatusHints[form.status]}</small>
                <FieldError message={fields.status} />
              </label>
              <label>
                ประเภทงาน
                <select
                  value={form.category}
                  aria-invalid={Boolean(fields.category)}
                  onChange={(e) =>
                    setForm({ category: e.target.value as EventForm["category"] })
                  }
                >
                  <option value="">ใช้ค่าเริ่มต้น ({categoryLabels[DEFAULT_EVENT_CATEGORY]})</option>
                  {EVENT_CATEGORIES.map((value) => (
                    <option value={value} key={value}>
                      {categoryLabels[value]}
                    </option>
                  ))}
                </select>
                <FieldError message={fields.category} />
              </label>
              <label>
                ธีมสี
                <select
                  value={form.theme}
                  aria-invalid={Boolean(fields.theme)}
                  onChange={(e) => setForm({ theme: e.target.value as EventForm["theme"] })}
                >
                  <option value="">ใช้ค่าเริ่มต้น ({themeLabels[DEFAULT_EVENT_THEME]})</option>
                  {EVENT_THEMES.map((value) => (
                    <option value={value} key={value}>
                      {themeLabels[value]}
                    </option>
                  ))}
                </select>
                <FieldError message={fields.theme} />
              </label>
              </fieldset>
              <fieldset data-editor-step="1" hidden={editorStep !== 1} className="event-form-section full form-grid">
                <legend>สถานที่และผู้จัดงาน</legend>
              <label className="full">
                สถานที่
                <input
                  required
                  maxLength={VENUE_MAX}
                  value={form.venue}
                  aria-invalid={Boolean(fields.venue)}
                  onChange={(e) => setForm({ venue: e.target.value })}
                />
                <FieldError message={fields.venue} />
                <span className="field-hint">ชื่อสถานที่จัดงาน</span>
              </label>
              <label className="full">ลิงก์สถานที่ / แผนที่ (ไม่บังคับ)
                <input type="url" maxLength={2048} placeholder="https:// เช่น ลิงก์แชร์จาก Google Maps" value={form.locationUrl} aria-invalid={Boolean(fields.locationUrl)} onChange={(e) => setForm({ locationUrl: e.target.value })} />
                <FieldError message={fields.locationUrl} />
                <small className="muted">หากไม่ใส่ ระบบจะค้นหาแผนที่จากชื่อสถานที่</small>
              </label>
              <label className="full">
                จุดปล่อยตัว (ไม่บังคับ)
                <input maxLength={300} placeholder="เช่น ประตูทางเข้าหลัก หรือบริเวณลานหน้าอาคาร" value={form.startPoint} aria-invalid={Boolean(fields.startPoint)} onChange={(e) => setForm({ startPoint: e.target.value })} />
                <FieldError message={fields.startPoint} />
              </label>
              <label className="full">
                จุดรับเสื้อ (ไม่บังคับ)
                <input maxLength={300} placeholder="เช่น อาคารอเนกประสงค์ ชั้น 1 หรือบูธรับเสื้อบริเวณหน้างาน" value={form.shirtPickupPoint} aria-invalid={Boolean(fields.shirtPickupPoint)} onChange={(e) => setForm({ shirtPickupPoint: e.target.value })} />
                <FieldError message={fields.shirtPickupPoint} />
              </label>
              <label className="full">
                ลิงก์แผนที่จุดรับเสื้อ (ไม่บังคับ)
                <input type="url" maxLength={2048} placeholder="https:// เช่น ลิงก์แชร์จุดรับเสื้อจาก Google Maps" value={form.shirtPickupUrl} aria-invalid={Boolean(fields.shirtPickupUrl)} onChange={(e) => setForm({ shirtPickupUrl: e.target.value })} />
                <FieldError message={fields.shirtPickupUrl} />
                <small className="field-hint">หากไม่ใส่ลิงก์ จะค้นหา Google Maps จากชื่อจุดรับเสื้อและสถานที่จัดงาน</small>
              </label>
              <label>
                จังหวัด
                <input
                  maxLength={PROVINCE_MAX}
                  value={form.province}
                  aria-invalid={Boolean(fields.province)}
                  onChange={(e) => setForm({ province: e.target.value })}
                />
                <FieldError message={fields.province} />
              </label>
              <label>
                ผู้จัดงาน
                <input
                  maxLength={ORGANIZER_MAX}
                  value={form.organizer}
                  aria-invalid={Boolean(fields.organizer)}
                  onChange={(e) => setForm({ organizer: e.target.value })}
                />
                <FieldError message={fields.organizer} />
              </label>
              <label className="full">
                นโยบายการคืนเงิน
                <textarea
                  rows={3}
                  maxLength={REFUND_MAX}
                  value={form.refundPolicy}
                  aria-invalid={Boolean(fields.refundPolicy)}
                  onChange={(e) => setForm({ refundPolicy: e.target.value })}
                />
                <FieldError message={fields.refundPolicy} />
              </label>
              </fieldset>
              <fieldset data-editor-step="2" hidden={editorStep !== 2} className="full race-fields event-form-section">
                <legend>ระยะวิ่งและราคา</legend>
                {original && original.orderCount > 0 && (
                  <p className="muted">
                    งานนี้มีออเดอร์แล้ว การแก้ชื่อ ราคา หรือจำนวนที่รับของระยะวิ่งอาจทำไม่ได้
                  </p>
                )}
                <FieldError message={fields.races} />
                {form.races.map((race, index) => {
                  return (
                    <div className="race-field-row" key={race.id ?? `new-${index}`}>
                      <label>
                        ชื่อระยะวิ่ง
                        <input
                          required
                          maxLength={RACE_NAME_MAX}
                          value={race.name}
                          aria-invalid={Boolean(fields[`races.${index}.name`])}
                          onChange={(e) => setRace(index, { name: e.target.value })}
                        />
                        <FieldError message={fields[`races.${index}.name`]} />
                      </label>
                      <label>
                        ราคา (บาท)
                        <input
                          type="number"
                          min="0"
                          step="1"
                          required
                          value={race.price}
                          aria-invalid={Boolean(fields[`races.${index}.price`])}
                          onChange={(e) => setRace(index, { price: e.target.value })}
                        />
                        <FieldError message={fields[`races.${index}.price`]} />
                      </label>
                      <div className="field-clearable">
                        <label>จำนวนที่รับสมัคร
                        <select value={race.unlimitedQuota ? "unlimited" : "limited"} onChange={(e) => setRace(index, { unlimitedQuota: e.target.value === "unlimited" })}>
                          <option value="limited">กำหนดจำนวนเอง</option>
                          <option value="unlimited">ไม่จำกัดจำนวน</option>
                        </select></label>
                        {!race.unlimitedQuota && <input aria-label="จำนวนที่รับ (คน)"
                          type="number"
                          min="1"
                          step="1"
                          required
                          value={race.quota}
                          aria-invalid={Boolean(fields[`races.${index}.quota`])}
                          onChange={(e) => setRace(index, { quota: e.target.value })}
                        />}
                        <FieldError message={fields[`races.${index}.quota`]} />
                      </div>
                      <div className="field-clearable">
                        <label>
                          เวลาปล่อยตัว
                          <input
                            type="time"
                            value={race.start}
                            aria-invalid={Boolean(fields[`races.${index}.start`])}
                            onChange={(e) => setRace(index, { start: e.target.value })}
                          />
                          <FieldError message={fields[`races.${index}.start`]} />
                        </label>
                        {race.start && (
                          <button
                            type="button"
                            className="text-link"
                            onClick={() => setRace(index, { start: "" })}
                          >
                            ล้างเวลา
                          </button>
                        )}
                      </div>
                      <div className="race-benefits-editor full">
                        <div className="race-prize-heading"><strong>ผู้สมัครระยะ {race.name || "นี้"} จะได้รับอะไรบ้าง?</strong></div>
                        <p className="benefits-help">เลือกได้หลายข้อ ไม่เลือกได้หากยังไม่กำหนด</p>
                        <div className="race-benefit-presets" role="group" aria-label={`สิ่งที่ได้รับของระยะ ${race.name}`}>{[{ value: "เสื้อ", label: "เสื้อที่ระลึก" }, { value: "BIB", label: "หมายเลขวิ่ง (BIB)" }, { value: "เหรียญ", label: "เหรียญที่ระลึก" }].map(({ value, label }) => <label className="benefit-choice" key={value}><input type="checkbox" checked={race.benefits.includes(value)} disabled={!race.benefits.includes(value) && race.benefits.length >= 20} onChange={(e) => setRace(index, { benefits: e.target.checked ? [...race.benefits, value] : race.benefits.filter((item) => item !== value) })} /><span>{label}</span></label>)}</div>
                        <div className="benefits-custom-heading"><span>สิ่งที่ได้รับอื่น ๆ</span><button type="button" className="text-link" disabled={race.benefits.length >= 20} onClick={() => setRace(index, { benefits: [...race.benefits, ""] })}><Plus size={15} aria-hidden="true" />เพิ่มรายการอื่น</button></div>
                        <FieldError message={fields[`races.${index}.benefits`]} />
                        {race.benefits.map((benefit, benefitIndex) => ["เสื้อ", "BIB", "เหรียญ"].includes(benefit) ? null : <div className="event-contact-phone-row" key={benefitIndex}><label>รายการอื่น<input key={`${benefitIndex}-${benefit}`} defaultValue={benefit} maxLength={100} placeholder="เช่น อาหารหลังวิ่ง หรือกระเป๋าที่ระลึก" onBlur={(e) => setRace(index, { benefits: race.benefits.map((value, i) => i === benefitIndex ? e.target.value : value) })} /><FieldError message={fields[`races.${index}.benefits.${benefitIndex}`]} /></label><button type="button" className="button small-button" aria-label={`ลบสิ่งที่ได้รับ ${benefitIndex + 1} ของระยะ ${race.name}`} onClick={() => setRace(index, { benefits: race.benefits.filter((_, i) => i !== benefitIndex) })}><Trash2 size={16} aria-hidden="true" />ลบ</button></div>)}
                        <label className="race-extra-details">รายละเอียดเพิ่มเติมของระยะนี้ (ไม่บังคับ)<textarea rows={3} maxLength={2000} placeholder="เช่น เงื่อนไขรับเหรียญ หรือสิทธิพิเศษ" value={race.extraDetails} onChange={(e) => setRace(index, { extraDetails: e.target.value })} /><FieldError message={fields[`races.${index}.extraDetails`]} /></label>
                      </div>
                      <div className="race-prize-editor">
                        <div className="race-prize-heading"><strong>อันดับและรางวัล · {race.name || "ระยะนี้"}</strong><button type="button" className="text-link" disabled={race.prizes.length >= 100} onClick={() => {
                          const nextRank = Array.from({ length: 100 }, (_, i) => i + 1).find((rank) => !race.prizes.some((prize) => Number(prize.rank) === rank));
                          if (nextRank) setRace(index, { prizes: [...race.prizes, { rank: String(nextRank), amount: "", trophy: false }] });
                        }}><Plus size={15} aria-hidden="true" />เพิ่มอันดับ</button></div>
                        {!race.prizes.length && <p className="muted">ยังไม่กำหนดรางวัลสำหรับระยะนี้</p>}
                        <FieldError message={fields[`races.${index}.prizes`]} />
                        {race.prizes.map((prize, prizeIndex) => <div className="race-prize-row" key={prizeIndex}>
                          <label>อันดับ<input type="number" min="1" max="100" step="1" required value={prize.rank} aria-invalid={Boolean(fields[`races.${index}.prizes.${prizeIndex}.rank`])} onChange={(e) => setRace(index, { prizes: race.prizes.map((row, i) => i === prizeIndex ? { ...row, rank: e.target.value } : row) })} /><FieldError message={fields[`races.${index}.prizes.${prizeIndex}.rank`]} /></label>
                          <label>เงินรางวัล (บาท)<input type="number" min="0" step="1" required value={prize.amount} aria-invalid={Boolean(fields[`races.${index}.prizes.${prizeIndex}.amount`])} onChange={(e) => setRace(index, { prizes: race.prizes.map((row, i) => i === prizeIndex ? { ...row, amount: e.target.value } : row) })} /><FieldError message={fields[`races.${index}.prizes.${prizeIndex}.amount`]} /></label>
                          <label>ถ้วยรางวัล<select value={prize.trophy ? "yes" : "no"} onChange={(e) => setRace(index, { prizes: race.prizes.map((row, i) => i === prizeIndex ? { ...row, trophy: e.target.value === "yes" } : row) })}><option value="no">ไม่ได้รับถ้วย</option><option value="yes">ได้รับถ้วย</option></select></label>
                          <button type="button" className="button small-button" aria-label={`ลบอันดับ ${prize.rank || prizeIndex + 1} ของระยะ ${race.name}`} onClick={() => setRace(index, { prizes: race.prizes.filter((_, i) => i !== prizeIndex) })}><Trash2 size={16} aria-hidden="true" /><span>ลบ</span></button>
                        </div>)}
                      </div>
                      {!race.id && form.races.length > 1 && (
                        <button
                          type="button"
                          className="button small-button"
                          onClick={() =>
                            setForm({ races: form.races.filter((_, i) => i !== index) })
                          }
                        >
                          <Trash2 size={15} aria-hidden="true" />
                          ลบระยะวิ่งนี้
                        </button>
                      )}
                    </div>
                  );
                })}
                {form.races.length < MAX_RACES && (
                  <button
                    type="button"
                    className="button small-button"
                    onClick={() => setForm({ races: [...form.races, emptyRace()] })}
                  >
                    <Plus size={15} aria-hidden="true" />
                    เพิ่มระยะวิ่ง
                  </button>
                )}
              </fieldset>
              <section data-editor-step="3" hidden={editorStep !== 3} className="event-image-section full" aria-label="รูปภาพงานวิ่ง">
              {editing.id && original ? (
                <EventImagesSection
                  key={editing.id}
                  event={original}
                  canEdit={canEdit}
                  onChange={() => {
                    reload();
                    reloadEvents();
                  }}
                />
              ) : (
                <StagedImagesSection staged={staged} busy={pending} status={uploadStatus} />
              )}
              </section>
              {editing.id && uploadFailures.length > 0 && (
                <div className="form-error full" role="alert">
                  <p>อัปโหลดรูปไม่สำเร็จ {uploadFailures.length} ไฟล์ (สร้างงานวิ่งเรียบร้อยแล้ว)</p>
                  <ul>
                    {uploadFailures.map((f, i) => (
                      <li key={`${f.name}-${i}`}>
                        {f.name}: {f.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="modal-actions">
              <button className="button" type="button" onClick={close}>
                ยกเลิก
              </button>
              <span className="event-editor-position">ขั้นตอน {editorStep + 1} จาก {editorSteps.length}</span>
              {editorStep > 0 && <button className="button" type="button" disabled={pending} onClick={() => navigateEditor(editorStep - 1)}>ย้อนกลับ</button>}
              {editorStep < editorSteps.length - 1 ? <button className="button primary" type="button" disabled={pending} onClick={() => { if (validateEditor(true)) navigateEditor(editorStep + 1); }}>ถัดไป</button> : <button className="button primary" type="submit" disabled={pending}>
                <Save size={16} aria-hidden="true" />
                {pending
                  ? editing.id
                    ? "กำลังบันทึก…"
                    : "กำลังสร้าง…"
                  : editing.id
                    ? "บันทึก"
                    : "สร้างงานวิ่ง"}
              </button>}
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
