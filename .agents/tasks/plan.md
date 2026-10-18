# Implementation Plan: show uploaded event images in admin UI

Scope: `c:\Project\running-event-admin` only. API and run-event-platform are read-only.

## Findings (read from code)
- `EventArtwork` (`src/components/ui.tsx:186`) is used in exactly two places: `src/app/(admin)/events/page.tsx:327` (card, header height 155px via `.event-art`) and `src/app/(admin)/page.tsx:339` (dashboard "งานวิ่งของคุณ" upcoming card, `compact` = 58x83px, `.event-art.compact`). The workspace selector in `admin-shell.tsx` shows no artwork, so it is skipped.
- `AdminEvent.images: EventImage[]` already exists in `src/lib/api/types.ts` (has `previewUrl`, `kind`, `alt`, `sortOrder`). The events page uses `eventsApi.listEvents` -> `getPage<AdminEvent>("/events")`, and the dashboard uses `useScope().events` (loaded by the same `listEvents`). The API's admin event view (`running-event-api/src/views/event.view.ts` lines 35-44) attaches `images: toAdminImageViews(e)`, so the list should include images. Item 1 verifies this against a real response. STOP and report (do not edit the API) if the list response lacks `images` or `previewUrl`.
- Kind order and labels live in `src/lib/constants.ts` (`EVENT_IMAGE_KINDS` is already in the required order, `EVENT_IMAGE_KIND_LABELS`). The kind-order list is therefore already centralized next to the labels; reuse it and add nothing new.
- No event detail route exists (routes under `src/app/(admin)`: events, orders, participants, reports, shipping, slips, users). "จัดการงาน" (events/page.tsx:361) is a super_admin-only button that opens the edit `Modal`, which already holds the editable `EventImagesSection`.
- `Modal` (`src/components/ui.tsx`) is a native `<dialog>` with `showModal`, body scroll lock and focus restore. It is the project's modal pattern.
- `bySort` helper and `ordered` sorting exist in `src/features/admin/event-images.tsx` (~line 439).
- No test runner in `package.json`. Scripts: `npm run typecheck`, `npm run build`, `npm run dev`. No lint script.

## Decisions
- Panel host: add a small "ดูรูปภาพ" button in each event card footer (visible to all roles, not only super_admin) that opens a `Modal` containing the read-only grouped panel. Reason: no detail page exists, the edit dialog is super_admin-only, and a Modal is the existing pattern. The "รูป N" badge on the cover is a non-interactive label; the footer button is the control.
- Lightbox: a second native `<dialog>` (own component) opened with `showModal()` from the panel. Stacking over the panel Modal works with top-layer dialogs. Own focus restore and scroll lock; Esc closes only the lightbox because the topmost dialog gets `cancel` first (call `event.stopPropagation()` in its `onCancel`).
- `pickCoverImage` lives in a new pure file `src/features/admin/event-images-utils.ts` (small, no React), so `event-images.tsx` (28KB) is not grown.

## Items

- [ ] 1. Verify the list endpoint returns images (no code change).
      Run `npm run dev` (needs API at `API_PROXY_TARGET`, default http://localhost:4000), log in, and in the browser Network tab or via the page open `GET /api/v1/admin/events?page=1&pageSize=20` for an event that has images. Confirm each item has `images[]` with `previewUrl`. If missing, STOP and report to the user; do not edit the API repo.
      Files: none.
      Verify: response shows `images` with `previewUrl`; record result in the final summary.

- [ ] 2. Add the pure helper `pickCoverImage` and group helper.
      Create `src/features/admin/event-images-utils.ts`:
      ```ts
      import { EVENT_IMAGE_KINDS } from "@/lib/constants";
      import type { EventImage, EventImageKind } from "@/lib/api/types";
      const bySort = (a: EventImage, b: EventImage) => a.sortOrder - b.sortOrder;
      /** cover (first by sortOrder) -> poster -> first image of any kind -> undefined. */
      export function pickCoverImage(images: readonly EventImage[] | undefined): EventImage | undefined
      export function groupImagesByKind(images: readonly EventImage[] | undefined): { kind: EventImageKind; items: EventImage[] }[]
      ```
      `pickCoverImage`: copy and sort by `sortOrder` (stable), return first with kind `cover`, else first `poster`, else first overall, else `undefined`. `groupImagesByKind`: iterate `EVENT_IMAGE_KINDS` in order, each group's items sorted by `sortOrder`, return only non-empty groups. Do not mutate input.
      Optionally make `event-images.tsx` import a shared sort comparator if it is a trivial swap; skip if it risks changing the upload section.
      Verify: `npm run typecheck` passes.

- [ ] 3. Create the reusable `EventCover` component.
      Create `src/components/event-cover.tsx` (client component):
      `EventCover({ event, compact?: boolean })` taking `event: Pick<AdminEvent, "name" | "theme" | "images">`. Uses `pickCoverImage`; keeps `useState` of failed `previewUrl` (reset when the picked image id/url changes by keying state on the url). If no image or failed: render `<EventArtwork theme={artTheme(event.theme)} compact={compact} />` unchanged. Otherwise render `<div className="event-cover [compact]">` containing `<img src={image.previewUrl} alt={image.alt || event.name} loading="lazy" decoding="async" onError={...} />` and, when `event.images.length > 1`, `<span className="event-cover-count">รูป {n}</span>`.
      CSS in `src/app/globals.css` next to `.event-art` (~line 1050): `.event-cover { position: relative; height: 155px; overflow: hidden; background: var(--background); }` and `.event-cover.compact { height: 83px; width: 58px; border-radius: 5px; flex-shrink: 0; }` (same dimensions as `.event-art` / `.event-art.compact` so there is no layout shift); `.event-cover img { display:block; width:100%; height:100%; object-fit:cover; }`; `.event-cover-count` as a small pill bottom-right using existing tokens (white text on `rgba(32,44,59,.78)`, radius 999px, 12px font, ink-on-dark contrast >= 4.5:1). Hide the count badge on `.compact` (too small).
      Verify: `npm run typecheck`.

- [ ] 4. Use `EventCover` everywhere artwork is shown.
      Edit `src/app/(admin)/events/page.tsx:327` -> `<EventCover event={event} />`; edit `src/app/(admin)/page.tsx:339` -> `<EventCover event={event} compact />`. Remove now-unused `EventArtwork`/`artTheme` imports from those two files (keep them if still referenced). Do not touch `EventArtwork` itself.
      Verify: `npm run typecheck` and `npm run build` pass; manual: event with cover shows the cover, event with only a poster shows the poster, event with gallery-only shows its first image, event without images shows the old artwork, event with a broken file (rename `previewUrl` in devtools or block the request) falls back to artwork; cards do not change height.

- [ ] 5. Build the grouped "รูปภาพ" panel and lightbox.
      Create `src/features/admin/event-images-panel.tsx` exporting `EventImagesPanel({ event })`: heading per group from `groupImagesByKind` with `EVENT_IMAGE_KIND_LABELS[kind]` and the count, responsive grid of thumbnail `<button type="button">` wrapping `<img src={previewUrl} alt loading="lazy" decoding="async">` with `aria-label` = `เปิดรูป {kind label} {alt}`; empty state with the existing `EmptyState` component (`ยังไม่มีรูปภาพ`). Thumbnails reuse `.image-grid` / `.image-thumb` classes where they fit.
      Create `src/features/admin/image-lightbox.tsx` exporting `ImageLightbox({ images, index, onIndex, onClose, kindLabel })`: native `<dialog>` with `showModal()` on mount; `onCancel` -> `stopPropagation` + `onClose` (Esc); `keydown` ArrowLeft/ArrowRight call `onIndex` (wrap or clamp, pick clamp with disabled prev/next buttons at ends); visible prev/next `icon-button`s (min 44px touch size) with Thai `aria-label`s (`รูปก่อนหน้า`, `รูปถัดไป`) and a close button; shows `<img>` with `max-width:100%; max-height: calc(100dvh - 160px); object-fit: contain`, below it kind label, "n / total", and alt as caption; `aria-labelledby` points to the caption; body scroll lock and focus restore copied from the `Modal` effect pattern in `ui.tsx` (capture `document.activeElement` before open, restore on unmount; panel must keep the clicked thumbnail mounted so restore works); touch support via optional swipe is skipped, buttons are sufficient. Use `aria-live="polite"` on the caption so navigation is announced.
      CSS in `globals.css` near the image rules (~line 1690-1750): `.image-panel`, `.lightbox`, `.lightbox::backdrop`, `.lightbox-stage`, `.lightbox-nav`; focus rings come from the global `:focus-visible` rule (line ~77); transitions wrapped so `@media (prefers-reduced-motion: reduce)` sets `animation: none; transition: none` for the lightbox (extend the existing block at ~line 1745).
      Verify: `npm run typecheck`.

- [ ] 6. Host the panel on the events page.
      In `src/app/(admin)/events/page.tsx` add state `viewing: AdminEvent | null`; in `event-card-footer` add a `ดูรูปภาพ` text-link button (all roles, next to the existing super_admin "จัดการงาน" button; wrap both in a flex group so the footer stays aligned); render `<Modal title={`รูปภาพ: ${viewing.name}`} onClose={() => setViewing(null)}><EventImagesPanel event={viewing} /></Modal>`. Keep `EventImagesSection` in the edit dialog unchanged.
      Verify: `npm run typecheck`, `npm run build`; manual with `npm run dev`: open panel, groups appear in order cover, poster, gallery, route_map, shirt, medal, sponsor, other with Thai headings and counts; empty event shows the empty state; click thumbnail -> lightbox; Esc closes lightbox only (panel remains), second Esc closes panel; Left/Right and the buttons navigate within the group only; focus enters the lightbox and returns to the clicked thumbnail on close; page behind does not scroll; viewer-role login can open the panel; mobile width (~375px) layout usable; with OS reduced motion enabled no animation.

- [ ] 7. Docs.
      Edit `README.md` ("Event images" section, line ~39): add a short paragraph: event cards and the dashboard use `EventCover` (priority cover -> poster -> first image -> theme artwork, via `previewUrl`, broken file falls back to artwork, "รูป N" badge when > 1 image) and "ดูรูปภาพ" on each card opens the read-only panel grouped by kind with a lightbox. Edit `docs/SYSTEM.md` section 3.2 (line ~56 bullet "รูปภาพของงาน"): add a Thai sentence for where images show and the cover priority rule.
      Verify: `npm run build` still passes; review rendered text for Thai wording.

- [ ] 8. Final check.
      Run `npm run typecheck` and `npm run build`; confirm no `any`, no new dependency in `package.json`, and `git status` touches only files in this plan (and not the two other repos). Clean up temp files.

## Stop conditions
- List endpoint response lacks `images` or `previewUrl` (item 1): stop and report, no API edits.
- Any fix that would need an API change: stop and report.

## Restructuring
The work is one coherent unit (shared helper, component, panel, docs); not decomposed into FEATs. The existing implement/review loop should run this plan, and the reviewer writes `.agents/tasks/review.json` with `verdict`.
