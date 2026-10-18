"use client";
import { useEffect, useId, useRef, type KeyboardEvent } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { EventImage } from "@/lib/api/types";

export function ImageLightbox({
  images,
  index,
  kindLabel,
  onIndex,
  onClose,
}: {
  images: readonly EventImage[];
  index: number;
  kindLabel: string;
  onIndex: (index: number) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const captionId = useId();
  const image = images[index];
  const last = images.length - 1;

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

  useEffect(() => {
    const dialog = ref.current;
    const active = document.activeElement;
    if (dialog && (!dialog.contains(active) || (active as HTMLButtonElement).disabled)) {
      dialog.querySelector<HTMLButtonElement>(".lightbox-nav:not(:disabled)")?.focus();
    }
  }, [index]);

  function onKeyDown(e: KeyboardEvent<HTMLDialogElement>) {
    if (e.key === "ArrowLeft" && index > 0) onIndex(index - 1);
    if (e.key === "ArrowRight" && index < last) onIndex(index + 1);
  }

  if (!image) return null;
  return (
    <dialog
      ref={ref}
      className="lightbox"
      aria-labelledby={captionId}
      onKeyDown={onKeyDown}
      onCancel={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <button className="icon-button lightbox-close" onClick={onClose} aria-label="ปิดรูปภาพ">
        <X size={20} />
      </button>
      <div className="lightbox-stage">
        <button
          className="icon-button lightbox-nav"
          onClick={() => onIndex(index - 1)}
          disabled={index === 0}
          aria-label="รูปก่อนหน้า"
        >
          <ChevronLeft size={22} />
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image.previewUrl} alt={image.alt || kindLabel} decoding="async" />
        <button
          className="icon-button lightbox-nav"
          onClick={() => onIndex(index + 1)}
          disabled={index === last}
          aria-label="รูปถัดไป"
        >
          <ChevronRight size={22} />
        </button>
      </div>
      <p id={captionId} className="lightbox-caption" aria-live="polite">
        <strong>{kindLabel}</strong> · {index + 1} / {images.length}
        {image.alt && <span>{image.alt}</span>}
      </p>
    </dialog>
  );
}
