# Event cover images and grouped image viewer in admin

Event cards and the dashboard upcoming list now render a real event image through one `EventCover` component, picked by a pure `pickCoverImage` helper (cover by sortOrder, else poster, else first image, else the unchanged `EventArtwork`). A "ดูรูปภาพ" button on each card opens a read-only panel grouped by kind in the fixed `EVENT_IMAGE_KINDS` order, with a native-`<dialog>` lightbox. No dependency was added and README and docs/SYSTEM.md were updated.

Watch for: nothing blocking. Minor: no automated test is kept for `pickCoverImage` (throwaway check only, matches a repo with no test runner) (confirmed).

**Verdict**: APPROVED

## High-level view

Cover selection is centralized in `event-images-utils.ts`, and `EventCover` is the only place that decides between a real image and the artwork. Both usages of `EventArtwork` (events card, dashboard compact) were swapped. Layout is preserved by reusing the `event-art` class on the cover wrapper, so dimensions match the artwork.

The panel and lightbox are separate components. Kind order and Thai labels come from the existing `constants.ts`, with no duplicate list. Lightbox accessibility relies on a native dialog (Esc, focus restore, scroll lock) plus arrow-key handling and visible prev/next buttons.

<details>
<summary>Issues (1)</summary>

1. **No retained test for pickCoverImage** — (confirmed, non-blocking) evidence shows a throwaway assertion run; optional follow-up if a test runner is ever added.

</details>

<details><summary>Details</summary>

### Cover fallback and layout stability
`EventCover` falls back to `EventArtwork` when no image exists or when `onError` fires for the picked `previewUrl`. Failure is tracked by URL, so a different picked image resets automatically. The wrapper carries `event-art event-cover [compact]`, inheriting the artwork's 155px / 58x83 sizes. The img uses object-fit cover, lazy loading, async decoding and `alt || event.name`. The "รูป N" badge shows only when more than one image exists and not in compact mode.

### Lightbox keyboard and focus
Esc is handled by `onCancel` with preventDefault/stopPropagation and calls `onClose`, so the outer panel Modal stays open (screenshot 21). Left/Right clamp within the group and the nav buttons disable at the ends. Previously focused element is restored on unmount and body overflow is restored. Reduced motion is covered by the pre-existing global `prefers-reduced-motion` block (`*` with `animation/transition: none !important`).

### Scope
Changes are confined to running-event-admin (src, README, docs, .agents notes). No package.json change and no `any` in new files. I did not independently run `git status` in the API/platform repos; the plan and the diff show no references to them.

</details>

<details><summary>File map</summary>

- src/components/event-cover.tsx: new reusable cover
- src/features/admin/event-images-utils.ts: pickCoverImage, groupImagesByKind
- src/features/admin/event-images-panel.tsx: grouped read-only panel
- src/features/admin/image-lightbox.tsx: lightbox dialog
- src/app/(admin)/events/page.tsx, src/app/(admin)/page.tsx: use EventCover, view button and modal
- src/app/globals.css: cover, badge, panel, lightbox styles
- README.md, docs/SYSTEM.md: docs

Full diff: `git diff` in running-event-admin.

</details>
