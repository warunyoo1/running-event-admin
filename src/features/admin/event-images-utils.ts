import { EVENT_IMAGE_KINDS } from "@/lib/constants";
import type { EventImage, EventImageKind } from "@/lib/api/types";

const bySort = (a: EventImage, b: EventImage) => a.sortOrder - b.sortOrder;

/** cover (first by sortOrder) -> poster -> first image of any kind -> undefined. */
export function pickCoverImage(images: readonly EventImage[] | undefined): EventImage | undefined {
  if (!images?.length) return undefined;
  const sorted = [...images].sort(bySort);
  return (
    sorted.find((image) => image.kind === "cover") ??
    sorted.find((image) => image.kind === "poster") ??
    sorted[0]
  );
}

/** Non-empty groups in EVENT_IMAGE_KINDS order, each sorted by sortOrder. */
export function groupImagesByKind(
  images: readonly EventImage[] | undefined,
): { kind: EventImageKind; items: EventImage[] }[] {
  const sorted = [...(images ?? [])].sort(bySort);
  return EVENT_IMAGE_KINDS.map((kind) => ({
    kind,
    items: sorted.filter((image) => image.kind === kind),
  })).filter((group) => group.items.length > 0);
}
