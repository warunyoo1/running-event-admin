"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type DragEvent } from "react";
import { ArrowDown, ArrowUp, Trash2, Upload } from "lucide-react";
import { eventImagesApi } from "@/lib/api";
import { ApiError, errorMessage } from "@/lib/api/errors";
import {
  EVENT_IMAGE_ALT_MAX,
  EVENT_IMAGE_KINDS,
  EVENT_IMAGE_KIND_LABELS,
  EVENT_IMAGE_MAX_BYTES,
  EVENT_IMAGE_MAX_FILES_PER_REQUEST,
  EVENT_IMAGE_MAX_MB,
  EVENT_IMAGE_MAX_PER_EVENT,
  EVENT_IMAGE_TYPES,
} from "@/lib/constants";
import type { AdminEvent, EventImage, EventImageKind } from "@/lib/api/types";
import { ErrorState, LoadingState } from "@/components/data-states";
import { useAsync } from "@/features/admin/use-async";
import { useToast } from "@/features/admin/toast-provider";

type Failure = { name: string; reason: string };

/** Thai message for an image API error (413/415/422 and friends). */
export function imageErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return errorMessage(error);
  const { status, code, fields } = error;
  if (status === 413) return `ไฟล์ใหญ่เกิน ${EVENT_IMAGE_MAX_MB} MB`;
  if (status === 415) return "รองรับเฉพาะไฟล์ JPG, PNG หรือ WEBP";
  if (status === 422) {
    if (code === "IMAGE_LIMIT_REACHED")
      return `ครบ ${EVENT_IMAGE_MAX_PER_EVENT} รูปแล้ว`;
    if (code === "TOO_MANY_FILES")
      return `อัปโหลดได้ครั้งละไม่เกิน ${EVENT_IMAGE_MAX_FILES_PER_REQUEST} ไฟล์`;
    return fields.files ?? fields.kind ?? fields.alt ?? fields.ids ?? error.message;
  }
  if (status === 409) return "รายการรูปภาพมีการเปลี่ยนแปลง โหลดรายการใหม่ให้แล้ว";
  if (status === 403) return "ไม่มีสิทธิ์จัดการรูปภาพ";
  if (status === 404) return "ไม่พบงานวิ่งหรือรูปภาพ (อาจถูกลบแล้ว) กรุณาโหลดใหม่";
  if (status === 429) return "ทำรายการถี่เกินไป กรุณารอสักครู่";
  if (code === "UPLOAD_ERROR") return "อัปโหลดไฟล์ไม่สำเร็จ กรุณาลองใหม่";
  return error.message;
}

/** Errors after which trying the remaining files of the batch is pointless. */
const isFatalForBatch = (error: unknown) =>
  error instanceof ApiError &&
  (error.status === 403 ||
    error.status === 404 ||
    error.status === 429 ||
    error.code === "IMAGE_LIMIT_REACHED");

/** Mirrors the API limits so obvious mistakes never leave the browser. The API stays the authority. */
function validateFiles(files: File[], existing: number) {
  const valid: File[] = [];
  const failures: Failure[] = [];
  for (const file of files) {
    if (!(EVENT_IMAGE_TYPES as readonly string[]).includes(file.type))
      failures.push({ name: file.name, reason: "รองรับเฉพาะไฟล์ JPG, PNG หรือ WEBP" });
    else if (file.size > EVENT_IMAGE_MAX_BYTES)
      failures.push({ name: file.name, reason: `ไฟล์ใหญ่เกิน ${EVENT_IMAGE_MAX_MB} MB` });
    else if (file.size === 0) failures.push({ name: file.name, reason: "ไฟล์ว่างเปล่า" });
    else if (valid.length >= EVENT_IMAGE_MAX_FILES_PER_REQUEST)
      failures.push({
        name: file.name,
        reason: `เลือกได้ครั้งละไม่เกิน ${EVENT_IMAGE_MAX_FILES_PER_REQUEST} ไฟล์`,
      });
    else if (existing + valid.length >= EVENT_IMAGE_MAX_PER_EVENT)
      failures.push({
        name: file.name,
        reason: `งานหนึ่งมีรูปได้ไม่เกิน ${EVENT_IMAGE_MAX_PER_EVENT} รูป`,
      });
    else valid.push(file);
  }
  return { valid, failures };
}

export type UploadItem = { file: File; kind: EventImageKind; alt: string };

/**
 * Uploads one file per request, in order. Shared by the persisted section and the
 * create form's staged files. `fatal` means the rest of the batch was skipped.
 */
export async function uploadFiles(
  eventId: string,
  items: UploadItem[],
  onProgress: (current: number, total: number) => void,
  onCreated?: (created: EventImage[], item: UploadItem) => void,
) {
  const failures: Failure[] = [];
  const succeeded: UploadItem[] = [];
  let fatal = false;
  for (const [index, item] of items.entries()) {
    onProgress(index + 1, items.length);
    try {
      const created = await eventImagesApi.uploadImage(eventId, item.file, item.kind, item.alt);
      onCreated?.(created, item);
      succeeded.push(item);
    } catch (failure) {
      failures.push({ name: item.file.name, reason: imageErrorMessage(failure) });
      if (isFatalForBatch(failure)) {
        fatal = true;
        for (const rest of items.slice(index + 1))
          failures.push({ name: rest.file.name, reason: "ข้ามไฟล์นี้เพราะอัปโหลดก่อนหน้าไม่สำเร็จ" });
        break;
      }
    }
  }
  return { done: succeeded.length, succeeded, failures, fatal };
}

/** Kind/alt defaults plus the drop zone; used by both persisted and staged sections. */
function ImageUploadControls({
  kind,
  alt,
  onKind,
  onAlt,
  onFiles,
  busy,
  full,
  staged = false,
}: {
  kind: EventImageKind;
  alt: string;
  onKind: (kind: EventImageKind) => void;
  onAlt: (alt: string) => void;
  onFiles: (files: File[]) => void;
  busy: boolean;
  full: boolean;
  staged?: boolean;
}) {
  const ids = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const disabled = busy;
  const labelId = `${ids}-label`;
  const hintId = `${ids}-hint`;
  const inputId = `${ids}-input`;
  function onPick(files: FileList | null) {
    const list = files ? Array.from(files) : [];
    if (inputRef.current) inputRef.current.value = ""; // allow picking the same file again
    onFiles(list);
  }
  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    if (!disabled && !full) onFiles(Array.from(e.dataTransfer.files));
  }
  return (
    <div className="image-upload">
      <div className="image-upload-options">
        <label>
          {staged ? "ประเภทรูป (ค่าเริ่มต้นของไฟล์ที่เพิ่ม)" : "ประเภทรูป"}
          <select
            value={kind}
            disabled={busy}
            onChange={(e) => onKind(e.target.value as EventImageKind)}
          >
            {EVENT_IMAGE_KINDS.map((value) => (
              <option value={value} key={value}>
                {EVENT_IMAGE_KIND_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
        <label>
          คำอธิบายรูป (ไม่บังคับ)
          <input
            value={alt}
            maxLength={EVENT_IMAGE_ALT_MAX}
            disabled={busy}
            onChange={(e) => onAlt(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
          />
        </label>
      </div>
      <div
        role="group"
        aria-labelledby={labelId}
        aria-describedby={hintId}
        className={`image-dropzone ${dragOver ? "is-over" : ""} ${disabled || full ? "is-disabled" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled && !full) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        <input
          ref={inputRef}
          id={inputId}
          className="image-input"
          type="file"
          multiple
          accept={EVENT_IMAGE_TYPES.join(",")}
          disabled={disabled || full}
          onChange={(e) => onPick(e.target.files)}
        />
        <label htmlFor={inputId} id={labelId}>
          <Upload size={22} aria-hidden="true" />
          <strong>
            {dragOver
              ? staged
                ? "ปล่อยไฟล์เพื่อเพิ่มในรายการ"
                : "ปล่อยไฟล์เพื่ออัปโหลด"
              : busy
                ? "กำลังอัปโหลด…"
                : full
                  ? "ครบจำนวนรูปสูงสุดแล้ว"
                  : "เลือกรูปภาพ หรือลากไฟล์มาวางที่นี่"}
          </strong>
        </label>
        <p id={hintId}>
          รองรับ JPG, PNG, WEBP ไฟล์ละไม่เกิน {EVENT_IMAGE_MAX_MB} MB ครั้งละไม่เกิน{" "}
          {EVENT_IMAGE_MAX_FILES_PER_REQUEST} ไฟล์ รวมสูงสุด {EVENT_IMAGE_MAX_PER_EVENT} รูปต่องาน
        </p>
      </div>
    </div>
  );
}

export type StagedImage = UploadItem & { key: string; url: string };

/** Files picked in the create form before the event exists. Object URLs are revoked on removal/unmount. */
export function useStagedImages() {
  const [items, setItems] = useState<StagedImage[]>([]);
  const [failures, setFailures] = useState<Failure[]>([]);
  const counter = useRef(0);
  const latest = useRef<StagedImage[]>([]);
  useEffect(() => {
    latest.current = items;
  }, [items]);
  useEffect(
    () => () => {
      for (const item of latest.current) URL.revokeObjectURL(item.url);
    },
    [],
  );

  const add = useCallback(
    (files: File[], kind: EventImageKind, alt: string) => {
      const { valid, failures: rejected } = validateFiles(files, items.length);
      setFailures(rejected);
      setItems((current) => [
        ...current,
        ...valid.map((file) => ({
          file,
          kind,
          alt,
          key: `staged-${(counter.current += 1)}`,
          url: URL.createObjectURL(file),
        })),
      ]);
    },
    [items.length],
  );
  const update = useCallback(
    (key: string, patch: Partial<Pick<StagedImage, "kind" | "alt">>) =>
      setItems((current) => current.map((i) => (i.key === key ? { ...i, ...patch } : i))),
    [],
  );
  const remove = useCallback((key: string) => {
    setItems((current) => {
      current.filter((i) => i.key === key).forEach((i) => URL.revokeObjectURL(i.url));
      return current.filter((i) => i.key !== key);
    });
  }, []);
  const move = useCallback((key: string, step: -1 | 1) => {
    setItems((current) => {
      const from = current.findIndex((i) => i.key === key);
      const to = from + step;
      if (from < 0 || to < 0 || to >= current.length) return current;
      const next = [...current];
      [next[from], next[to]] = [next[to], next[from]];
      return next;
    });
  }, []);
  const clear = useCallback(() => {
    setItems((current) => {
      current.forEach((i) => URL.revokeObjectURL(i.url));
      return [];
    });
    setFailures([]);
  }, []);
  return { items, failures, add, update, remove, move, clear, setFailures };
}

export type StagedImages = ReturnType<typeof useStagedImages>;

/** Image area of the create form: same look as the persisted section, uploads happen after Save. */
export function StagedImagesSection({
  staged,
  busy,
  status,
}: {
  staged: StagedImages;
  busy: boolean;
  status: string;
}) {
  const ids = useId();
  const [kind, setKind] = useState<EventImageKind>("cover");
  const [alt, setAlt] = useState("");
  const { items } = staged;
  return (
    <fieldset className="full race-fields image-fields" aria-busy={busy}>
      <legend>รูปภาพ</legend>
      <p className="muted">
        {items.length} / {EVENT_IMAGE_MAX_PER_EVENT} รูป · เพิ่มรูปได้ทั้งตอนสร้างและหลังสร้างงาน
        รูปที่เลือกจะอัปโหลดหลังกดบันทึกงานวิ่ง
      </p>
      <ImageUploadControls
        staged
        kind={kind}
        alt={alt}
        onKind={setKind}
        onAlt={setAlt}
        onFiles={(files) => staged.add(files, kind, alt.trim())}
        busy={busy}
        full={items.length >= EVENT_IMAGE_MAX_PER_EVENT}
      />
      <p className="image-status" role="status" aria-live="polite">
        {status}
      </p>
      {staged.failures.length > 0 && (
        <div className="form-error" role="alert">
          <p>เพิ่มไม่ได้ {staged.failures.length} ไฟล์</p>
          <ul>
            {staged.failures.map((failure, index) => (
              <li key={`${failure.name}-${index}`}>
                {failure.name}: {failure.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
      {items.length === 0 ? (
        <p className="muted">ยังไม่ได้เลือกรูป (ข้ามได้ และเพิ่มภายหลังได้)</p>
      ) : (
        <ul className="image-grid" aria-label="รูปที่รออัปโหลด">
          {items.map((item, index) => {
            const label = `${EVENT_IMAGE_KIND_LABELS[item.kind]} ${item.file.name}`;
            return (
              <li className="image-card" key={item.key}>
                <div className="image-thumb">
                  {/* Plain <img>: local blob URL, not optimizable by next/image. */}
                  <img src={item.url} alt={item.alt || item.file.name} width={320} height={240} />
                </div>
                <label htmlFor={`${ids}-${item.key}-kind`}>ประเภท</label>
                <select
                  id={`${ids}-${item.key}-kind`}
                  value={item.kind}
                  disabled={busy}
                  onChange={(e) => staged.update(item.key, { kind: e.target.value as EventImageKind })}
                >
                  {EVENT_IMAGE_KINDS.map((value) => (
                    <option value={value} key={value}>
                      {EVENT_IMAGE_KIND_LABELS[value]}
                    </option>
                  ))}
                </select>
                <label htmlFor={`${ids}-${item.key}-alt`}>คำอธิบาย</label>
                <input
                  id={`${ids}-${item.key}-alt`}
                  value={item.alt}
                  maxLength={EVENT_IMAGE_ALT_MAX}
                  disabled={busy}
                  onChange={(e) => staged.update(item.key, { alt: e.target.value })}
                  onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
                />
                <div className="image-actions">
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`เลื่อน ${label} ขึ้น`}
                    disabled={busy || index === 0}
                    onClick={() => staged.move(item.key, -1)}
                  >
                    <ArrowUp size={18} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`เลื่อน ${label} ลง`}
                    disabled={busy || index === items.length - 1}
                    onClick={() => staged.move(item.key, 1)}
                  >
                    <ArrowDown size={18} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="button small-button danger-outline"
                    aria-label={`เอา ${label} ออก`}
                    disabled={busy}
                    onClick={() => staged.remove(item.key)}
                  >
                    <Trash2 size={15} aria-hidden="true" />
                    เอาออก
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </fieldset>
  );
}

const bySort = (a: EventImage, b: EventImage) => a.sortOrder - b.sortOrder;

export function EventImagesSection({
  event,
  canEdit,
  onChange,
}: {
  event: AdminEvent;
  canEdit: boolean;
  onChange: () => void;
}) {
  const notify = useToast();
  const ids = useId();
  const [images, setImages] = useState<EventImage[]>(event.images ?? []);
  const [kind, setKind] = useState<EventImageKind>("gallery");
  const [alt, setAlt] = useState("");
  const [filter, setFilter] = useState<EventImageKind | "all">("all");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [failures, setFailures] = useState<Failure[]>([]);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const { data, error: loadError, loading, reload } = useAsync(
    (signal) => eventImagesApi.listImages(event.id, signal),
    [event.id],
  );
  useEffect(() => {
    if (data) setImages(data);
  }, [data]);

  const ordered = useMemo(() => [...images].sort(bySort), [images]);
  const counts = useMemo(() => {
    const result = new Map<EventImageKind, number>();
    for (const image of images) result.set(image.kind, (result.get(image.kind) ?? 0) + 1);
    return result;
  }, [images]);
  const groups = EVENT_IMAGE_KINDS.filter(
    (value) => (filter === "all" || filter === value) && counts.has(value),
  ).map((value) => ({ kind: value, items: ordered.filter((image) => image.kind === value) }));
  const full = images.length >= EVENT_IMAGE_MAX_PER_EVENT;

  const labelOf = (image: EventImage) =>
    `${EVENT_IMAGE_KIND_LABELS[image.kind]} ลำดับที่ ${ordered.indexOf(image) + 1}${
      image.alt ? ` (${image.alt})` : ""
    }`;

  /** Runs one mutation with the shared busy/error handling. */
  async function run<T>(action: () => Promise<T>, onDone: (result: T) => void) {
    setBusy(true);
    setError("");
    try {
      onDone(await action());
      onChange();
    } catch (failure) {
      setError(imageErrorMessage(failure));
      if (failure instanceof ApiError && [404, 409].includes(failure.status)) reload();
    } finally {
      setBusy(false);
    }
  }

  async function upload(picked: File[]) {
    if (!canEdit || busy || picked.length === 0) return;
    setError("");
    setFailures([]);
    const { valid, failures: rejected } = validateFiles(picked, images.length);
    const problems = [...rejected];
    let done = 0;
    if (valid.length > 0) {
      setBusy(true);
      const result = await uploadFiles(
        event.id,
        valid.map((file) => ({ file, kind, alt: alt.trim() })),
        (index, total) => setStatus(`กำลังอัปโหลด ${index} จาก ${total} ไฟล์…`),
        (created) => setImages((current) => [...current, ...created]),
      );
      done = result.done;
      problems.push(...result.failures);
      if (result.fatal) reload();
      setBusy(false);
      if (done > 0) onChange();
    }
    setFailures(problems);
    const total = picked.length;
    setStatus(`อัปโหลดสำเร็จ ${done} จาก ${total} ไฟล์`);
    if (done > 0) notify(`เพิ่มรูปภาพ ${done} รูปแล้ว`);
  }
  const changeKind = (image: EventImage, next: EventImageKind) =>
    run(
      () => eventImagesApi.patchImage(event.id, image.id, { kind: next }),
      (updated) => setImages((current) => current.map((i) => (i.id === image.id ? updated : i))),
    );
  const changeAlt = (image: EventImage, next: string) =>
    run(
      () => eventImagesApi.patchImage(event.id, image.id, { alt: next }),
      (updated) => setImages((current) => current.map((i) => (i.id === image.id ? updated : i))),
    );
  /** Swaps `image` with its neighbour in the visible group; other images keep their place. */
  const move = (image: EventImage, group: EventImage[], step: -1 | 1) => {
    const neighbour = group[group.indexOf(image) + step];
    if (!neighbour) return;
    const order = ordered.map((i) => i.id);
    const a = order.indexOf(image.id);
    const b = order.indexOf(neighbour.id);
    [order[a], order[b]] = [order[b], order[a]];
    return run(
      () => eventImagesApi.reorderImages(event.id, order),
      (list) => {
        setImages(list);
        setStatus(`ย้ายรูป ${labelOf(image)} แล้ว`);
      },
    );
  };
  const remove = (image: EventImage) =>
    run(
      () => eventImagesApi.deleteImage(event.id, image.id),
      () => {
        setImages((current) => current.filter((i) => i.id !== image.id));
        setConfirmId(null);
        setStatus("ลบรูปภาพแล้ว");
        notify("ลบรูปภาพแล้ว");
      },
    );

  return (
    <fieldset className="full race-fields image-fields" aria-busy={busy}>
      <legend>รูปภาพ</legend>
      <p className="muted">
        {images.length} / {EVENT_IMAGE_MAX_PER_EVENT} รูป
        {!canEdit && " · ดูได้อย่างเดียว"}
      </p>
      {canEdit && (
        <ImageUploadControls
          kind={kind}
          alt={alt}
          onKind={setKind}
          onAlt={setAlt}
          onFiles={(files) => void upload(files)}
          busy={busy}
          full={full}
        />
      )}
      <p className="image-status" role="status" aria-live="polite">
        {status}
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {failures.length > 0 && (
        <div className="form-error" role="alert">
          <p>อัปโหลดไม่สำเร็จ {failures.length} ไฟล์</p>
          <ul>
            {failures.map((failure, index) => (
              <li key={`${failure.name}-${index}`}>
                {failure.name}: {failure.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
      {loadError && <ErrorState message={loadError} onRetry={reload} />}
      {loading && images.length === 0 && !loadError && <LoadingState label="กำลังโหลดรูปภาพ…" />}
      {images.length > 0 && (
        <label className="image-filter">
          แสดงประเภท
          <select value={filter} onChange={(e) => setFilter(e.target.value as EventImageKind | "all")}>
            <option value="all">ทุกประเภท ({images.length})</option>
            {EVENT_IMAGE_KINDS.map((value) => (
              <option value={value} key={value}>
                {EVENT_IMAGE_KIND_LABELS[value]} ({counts.get(value) ?? 0})
              </option>
            ))}
          </select>
        </label>
      )}
      {!loading && !loadError && images.length === 0 && (
        <p className="muted">ยังไม่มีรูปภาพ{canEdit ? " เลือกไฟล์ด้านบนเพื่อเพิ่มรูป" : ""}</p>
      )}
      {groups.map((group) => (
        <section className="image-group" key={group.kind} aria-labelledby={`${ids}-g-${group.kind}`}>
          <h3 id={`${ids}-g-${group.kind}`}>
            {EVENT_IMAGE_KIND_LABELS[group.kind]} <span>({group.items.length})</span>
          </h3>
          <ul className="image-grid">
            {group.items.map((image, index) => (
              <ImageCard
                key={image.id}
                image={image}
                label={labelOf(image)}
                canEdit={canEdit}
                busy={busy}
                first={index === 0}
                last={index === group.items.length - 1}
                confirming={confirmId === image.id}
                onKind={(next) => changeKind(image, next)}
                onAlt={(next) => changeAlt(image, next)}
                onUp={() => move(image, group.items, -1)}
                onDown={() => move(image, group.items, 1)}
                onAskDelete={() => setConfirmId(image.id)}
                onCancelDelete={() => setConfirmId(null)}
                onDelete={() => remove(image)}
              />
            ))}
          </ul>
        </section>
      ))}
    </fieldset>
  );
}

function ImageCard({
  image,
  label,
  canEdit,
  busy,
  first,
  last,
  confirming,
  onKind,
  onAlt,
  onUp,
  onDown,
  onAskDelete,
  onCancelDelete,
  onDelete,
}: {
  image: EventImage;
  label: string;
  canEdit: boolean;
  busy: boolean;
  first: boolean;
  last: boolean;
  confirming: boolean;
  onKind: (kind: EventImageKind) => void;
  onAlt: (alt: string) => void;
  onUp: () => void;
  onDown: () => void;
  onAskDelete: () => void;
  onCancelDelete: () => void;
  onDelete: () => void;
}) {
  const [altDraft, setAltDraft] = useState(image.alt);
  useEffect(() => setAltDraft(image.alt), [image.alt]);
  const fieldId = useId();
  return (
    <li className="image-card">
      <div className="image-thumb">
        {/* Plain <img>: same-origin preview URL (works for draft events); fixed size avoids layout shift. */}
        <img
          src={image.previewUrl}
          alt={image.alt || EVENT_IMAGE_KIND_LABELS[image.kind]}
          width={320}
          height={240}
          loading="lazy"
          decoding="async"
        />
      </div>
      <label htmlFor={`${fieldId}-kind`}>ประเภท</label>
      <select
        id={`${fieldId}-kind`}
        value={image.kind}
        disabled={!canEdit || busy}
        onChange={(e) => onKind(e.target.value as EventImageKind)}
      >
        {EVENT_IMAGE_KINDS.map((value) => (
          <option value={value} key={value}>
            {EVENT_IMAGE_KIND_LABELS[value]}
          </option>
        ))}
      </select>
      <label htmlFor={`${fieldId}-alt`}>คำอธิบาย</label>
      <input
        id={`${fieldId}-alt`}
        value={altDraft}
        maxLength={EVENT_IMAGE_ALT_MAX}
        disabled={!canEdit || busy}
        onChange={(e) => setAltDraft(e.target.value)}
        onBlur={() => altDraft.trim() !== image.alt && onAlt(altDraft.trim())}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          e.preventDefault(); // Enter must not submit the surrounding event form
          e.currentTarget.blur();
        }}
      />
      {canEdit &&
        (confirming ? (
          <div className="image-actions" role="group" aria-label={`ยืนยันการลบ ${label}`}>
            <span>ลบรูปนี้ใช่หรือไม่</span>
            <button type="button" className="button small-button danger" disabled={busy} onClick={onDelete}>
              ลบรูป
            </button>
            <button type="button" className="button small-button" disabled={busy} onClick={onCancelDelete}>
              ยกเลิก
            </button>
          </div>
        ) : (
          <div className="image-actions">
            <button
              type="button"
              className="icon-button"
              aria-label={`เลื่อนรูป ${label} ขึ้น`}
              disabled={busy || first}
              onClick={onUp}
            >
              <ArrowUp size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label={`เลื่อนรูป ${label} ลง`}
              disabled={busy || last}
              onClick={onDown}
            >
              <ArrowDown size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="button small-button danger-outline"
              disabled={busy}
              onClick={onAskDelete}
            >
              <Trash2 size={15} aria-hidden="true" />
              ลบ
            </button>
          </div>
        ))}
    </li>
  );
}
