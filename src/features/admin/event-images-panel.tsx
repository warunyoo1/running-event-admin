"use client";
import { useState } from "react";
import { EmptyState } from "@/components/ui";
import { ImageLightbox } from "@/features/admin/image-lightbox";
import { groupImagesByKind } from "@/features/admin/event-images-utils";
import { EVENT_IMAGE_KIND_LABELS } from "@/lib/constants";
import type { AdminEvent, EventImageKind } from "@/lib/api/types";

export function EventImagesPanel({ event }: { event: Pick<AdminEvent, "name" | "images"> }) {
  const groups = groupImagesByKind(event.images);
  const [open, setOpen] = useState<{ kind: EventImageKind; index: number } | null>(null);
  const openGroup = groups.find((group) => group.kind === open?.kind);

  if (!groups.length) {
    return (
      <div className="modal-body">
        <EmptyState title="ยังไม่มีรูปภาพ" description="งานนี้ยังไม่มีการอัปโหลดรูปภาพ" />
      </div>
    );
  }
  return (
    <div className="modal-body image-panel">
      {groups.map(({ kind, items }) => (
        <section className="image-group" key={kind} aria-label={EVENT_IMAGE_KIND_LABELS[kind]}>
          <h3>
            {EVENT_IMAGE_KIND_LABELS[kind]} <span>({items.length})</span>
          </h3>
          <ul className="image-grid">
            {items.map((image, index) => (
              <li key={image.id}>
                <button
                  type="button"
                  className="image-thumb image-thumb-button"
                  onClick={() => setOpen({ kind, index })}
                  aria-label={`เปิดรูป ${EVENT_IMAGE_KIND_LABELS[kind]} ${image.alt || index + 1}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={image.previewUrl} alt="" loading="lazy" decoding="async" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {open && openGroup && (
        <ImageLightbox
          images={openGroup.items}
          index={open.index}
          kindLabel={EVENT_IMAGE_KIND_LABELS[open.kind]}
          onIndex={(index) => setOpen({ kind: open.kind, index })}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}
