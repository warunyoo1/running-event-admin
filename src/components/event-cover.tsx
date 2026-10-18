"use client";
import { useState } from "react";
import { artTheme } from "@/features/admin/format";
import { pickCoverImage } from "@/features/admin/event-images-utils";
import type { AdminEvent } from "@/lib/api/types";
import { EventArtwork } from "@/components/ui";

export function EventCover({
  event,
  compact = false,
}: {
  event: Pick<AdminEvent, "name" | "theme" | "images">;
  compact?: boolean;
}) {
  const image = pickCoverImage(event.images);
  const [failedUrl, setFailedUrl] = useState("");
  if (!image || failedUrl === image.previewUrl) {
    return <EventArtwork theme={artTheme(event.theme)} compact={compact} />;
  }
  const total = event.images.length;
  return (
    <div className={`event-art event-cover ${compact ? "compact" : ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image.previewUrl}
        alt={image.alt || event.name}
        loading="lazy"
        decoding="async"
        onError={() => setFailedUrl(image.previewUrl)}
      />
      {total > 1 && !compact && <span className="event-cover-count">รูป {total}</span>}
    </div>
  );
}
