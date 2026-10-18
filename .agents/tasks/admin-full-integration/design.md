# Admin full integration: requirements and design

> **Amendments.** `plan.md` in this folder carries binding amendments that override this document where they conflict: (1) category/theme views always emit both keys and clearing resets to the defaults (D6, D18 and the "ไม่ระบุ" wording are void); (2) the dashboard is NOT changed (gap 9, D3 and the dashboard part of 3.1 and 3.8 are void); (3) shipping search is one always-on aggregation (3.7 is replaced); (4) timeline `paid` detail comes from the approved Payment (3.5); (5) `address_updated` timeline detail is null; (7) the `mustChangePassword` nudge uses a named `sessionStorage` key read in `AdminShell`; (8) `EMAIL_TAKEN` is a form-level alert. Admin file paths in this document are relative to `c:\Project\running-event-admin\src\`. Section 10 now lists D17 before D18 and D19.

Repos: API `c:\Project\running-event-api` (Express 5, Mongoose 8, Zod 3, vitest), admin `c:\Project\running-event-admin` (Next 16, React 19, plain fetch, no test runner). `c:\Project\run-event-platform` is not touched.
Both repos: current branch, no worktree, no commits.

User request (Thai): "ช่วยเชื่อมให้ครบในส่วนของ admin ได้มั้ยครับ" (connect the admin fully). Result: no control in the admin may be dead, fake or client-only.

---

## 1. Requirements

### 1.1 Summary

Previous work wired every admin page that already had an endpoint. This task adds the missing endpoints in the API and wires the remaining admin UI to them: event delete/archive, user delete/invite/email edit, order notes + timeline + address edit, audit log page, clearing optional event fields, server-side shipping search, server-side overview and shirt-size CSV. It also fixes two small "UI shows data the API does not provide" problems found during re-verification (section 1.2).

### 1.2 Re-verified gap list (read from code, not from the README)

Confirmed from the README "Gaps" section, `docs/SYSTEM.md` and the pages themselves:

| # | Gap | Where in the admin |
|---|---|---|
| 1 | No event delete/archive. The `archived` flag already exists in the event model and every public query already filters on it, but nothing sets it. | `events/page.tsx` |
| 2 | No user delete/invite, no email edit (`updateUserBody` is `.strict()` without email). | `users/page.tsx` (email input is `readOnly` with "ไม่สามารถแก้ไขอีเมลได้") |
| 3 | No order notes, timeline, address edit, audit view. `audit()` already writes to the `AuditLog` collection, nothing reads it. | `features/admin/order-detail.tsx`, no audit page |
| 4 | `PUT /events/:id` cannot clear `registrationEnds`, `category`, `theme`, race `start`. | `events/page.tsx` shows "ตั้งค่าแล้วไม่สามารถล้างได้" three times and makes `registrationEnds` `required` once set. `toEventBody` in `lib/api/endpoints/events.ts` omits empty typed fields. |
| 5 | Shipping search filters only the loaded page. | `shipping/page.tsx` (client `.filter`, placeholder "ค้นหาในหน้านี้", count "ในหน้านี้") |
| 6 | Overview CSV and shirt-size CSV are built in the browser. | `app/(admin)/page.tsx` `exportOverview`, `reports/page.tsx`, both via `features/admin/client-csv.ts` |

Found during re-verification (not in the original list):

| # | Finding | Fix |
|---|---|---|
| 7 | Order detail prints `order.reviewedBy` (a raw ObjectId) under "ตรวจสอบโดย". The API does not provide the reviewer name. | New additive key `reviewedByName` on the order detail response (section 3.6). |
| 8 | Users table has no "last login" or "must change password" info although `lastLoginAt` is in the API response. Not a dead control, only unused data. | Add a "เข้าสู่ระบบล่าสุด" column and a badge (cheap, no API work beyond the new flag). |
| 9 | Dashboard race table lists races of events that will become archived (dashboard queries have no `archived` rule). | Exclude races of archived events from the dashboard `races` list (section 3.1). Order counts stay unchanged. |

Everything else was checked and is backed by a real call: help modal and change-password modal work, scope selector works, every `disabled` found is a pending/permission state, no `TODO`/demo/"ยังไม่รองรับ" text exists in `src`.

### 1.3 Functional requirements

F1 Event delete/archive (super_admin only)
- F1.1 Hard delete only when the event has zero orders of any status. Otherwise 409 `EVENT_HAS_ORDERS`. Hard delete removes races, the event document and the event's image files on disk.
- F1.2 Archive hides the event from the public site and from the default admin list; it is reversible by "restore".
- F1.3 The UI asks for confirmation naming the event. If hard delete answers `EVENT_HAS_ORDERS`, the dialog offers "เก็บถาวรแทน".
- F1.4 Archived events' images stop being public (already true: public lookups filter `archived: false`).

F2 Users (super_admin only)
- F2.1 Deactivate/reactivate via `active` from a row action with a confirm dialog.
- F2.2 Permanent delete only for a deactivated user that has no audit-log or review references; never yourself; never the last active super_admin.
- F2.3 "Invite" = create a user with a temporary password chosen by the super_admin. No email is sent. Flag `mustChangePassword` is set and the UI nudges the user to change it on first login (not enforced by the server).
- F2.4 Email edit: normalized lowercase, unique (409 `EMAIL_TAKEN`), audited.

F3 Order notes, timeline, address
- F3.1 Internal notes (author, text 1-1000 chars, createdAt). Create: reviewer + super_admin. Delete: own note (reviewer) or any note (super_admin).
- F3.2 Timeline: read-only chronological view built from existing data plus notes plus audit entries for the order, returned in the order detail response.
- F3.3 Address edit: reviewer + super_admin, only for shipping orders before shipping starts, validated with the same address rules as checkout, audited with before/after, otherwise 409 `INVALID_STATE`.

F4 Audit log page: super_admin only, paginated, filters actor/action/entity/date range/entity id. New mutations are audited.

F5 `PUT /admin/events/:id` accepts explicit `null` to clear `registrationEnds`, `category`, `theme` and race `start`. Omitted keys keep the stored value.

F6 Shipping `q` search (order no, name, phone, tracking, plus participant name/BIB to keep parity with today's client filter), server side, page resets to 1.

F7 Server CSV exports for overview and shirt sizes; the three existing exports stay byte-identical.

### 1.4 Non-functional requirements

- NF1 Additive contract: only new keys, new endpoints, new optional params. No key is renamed or removed; existing key order in views is kept (new keys are appended). `tests/views/golden.test.ts` must still pass unchanged.
- NF2 MongoDB is standalone: no transactions anywhere. Conditional single-document updates and `utils/compensation.ts`.
- NF3 No new runtime dependencies in either repo.
- NF4 Existing conventions: Zod validators, `read`/`write`/`superOnly` guards, origin check, response envelope, `HTTP_STATUS`, UPPER_SNAKE codes, Thai messages, layering `routes -> controllers -> services -> models`, `views/*.view.ts` pure.
- NF5 Admin: types in `lib/api/types.ts`, calls in `lib/api/endpoints/*`, `useAsync`, `data-states`, toasts, permission helpers, no `any`, accessible native `<dialog>` modals, Thai copy.
- NF6 Login rate limiting and role gating of existing routes unchanged.

### 1.5 Assumptions

- A1 "Event has zero orders" means `Order.exists({ eventId })` over every status, including cancelled and expired.
- A2 The public platform tolerates a missing `category`/`theme` after a clear (the platform is read-only here and currently uses mock data; it reads `event.category` and `event.theme` without a guard, see decision D6).
- A3 Orders of archived events stay visible in order/slip/shipping/participant lists (they are real money). Only the event itself and its races are hidden.
- A4 Admin uses Asia/Bangkok dates through `bangkokRange`, same as other filters.

### 1.6 Acceptance criteria

1. `DELETE /admin/events/:id` as super_admin on an event with zero orders returns 200 `data: null`; afterwards the event, its races and `UPLOAD_DIR/events/<id>/` are gone; audit row `event.delete` exists.
2. The same call on an event with at least one order (any status) returns 409 `EVENT_HAS_ORDERS` and changes nothing: the order pre-check runs before any write, so the `archived` flag is never modified on this path. (If a concurrent order appears after the pre-check, the flag is restored; if that undo fails the 409 is still returned and the failure is logged by `runUndo`.) With reserved quota and no order the answer is 409 `EVENT_QUOTA_RESERVED`.
3. `POST /events/:id/archive` sets `archived: true`; the event disappears from `GET /public/events`, `GET /public/events/:slug` and `GET /public/event-images/:imageId`, and from the default `GET /admin/events`; `GET /admin/events?archived=true` lists it; `POST /events/:id/restore` brings it back unchanged. Both calls are idempotent.
4. Reviewer and viewer get 403 on delete/archive/restore.
5. `PATCH /users/:id` with `email` changes the email (lowercased); a taken email returns 409 `EMAIL_TAKEN`; a body with an unknown key is still rejected.
5a. `PATCH /users/:id` by a super_admin on their own id with `active: false` or a different `role` returns 409 `CANNOT_MODIFY_SELF` and changes nothing.
6. `DELETE /users/:id` returns 409 for: self (`CANNOT_DELETE_SELF`), still-active user (`USER_STILL_ACTIVE`), user with audit/review references (`USER_HAS_HISTORY`); 200 for a deactivated user without references; the user can no longer be fetched in `GET /users`.
7. `POST /users` sets `mustChangePassword: true`; `POST /auth/change-password` clears it; `GET /auth/me` returns it.
8. `POST /orders/:id/notes` (reviewer/super) creates a note; viewer gets 403; text of 0 or 1001 chars gets 422; the 101st note on one order gets 422 `NOTE_LIMIT_REACHED`.
9. `DELETE /orders/:id/notes/:noteId`: super_admin deletes any, reviewer only own (403 otherwise), unknown id 404 `NOTE_NOT_FOUND`.
10. `PATCH /orders/:id/address` succeeds for a shipping order in `pending`, `slip_uploaded`, `rejected`, or `paid` without tracking; returns 409 `INVALID_STATE` for pickup orders, `cancelled`/`expired`, and once `trackingNo` is set; invalid postal code/province gives 422 with field keys; audit row has before and after.
11. `GET /orders/:id` contains the new keys `reviewedByName`, `canEditAddress`, `notes`, `timeline` and all old keys unchanged; `GET /orders` list items are unchanged (no `notes` key).
12. Timeline entries are ascending by time, include created, slip uploaded, slip rejected (with reviewer name and reason), paid, cancelled, tracking set, address updated, note, and expired, and contain no duplicates.
13. `GET /audit-logs` as super_admin is paginated (`meta`), newest first, and every filter narrows the result; reviewer/viewer get 403.
14. Event update with `category: null`, `theme: null`, `registrationEnds: null` removes those fields in the database; omitting them keeps them; `races[i].start: null` removes the race start; `null` for `name`, `slug`, `date`, `venue`, `status` gives 422.
15. `GET /shipping?q=...` filters across all pages (total in `meta` reflects the filter; a full-name query such as "สมชาย ใจดี" and a BIB match, and non-paid orders never appear), `GET /export/fulfillment.csv?q=...` honors it, and the UI resets to page 1 on a new query.
16. `GET /export/overview.csv` and `GET /export/shirt-sizes.csv` return CSV with BOM and the same columns and row format the browser used to produce (overview race rows exclude archived events when no event is selected, see 3.8); the buttons use `downloadCsv`; `client-csv.ts` is deleted.
17. In the admin: no "ไม่สามารถล้างได้"/"ไม่สามารถแก้ไขอีเมลได้" text remains, shipping placeholder no longer says "ในหน้านี้", every new button performs a real API call, destructive actions have a confirm dialog, dialogs are keyboard accessible.
18. API `npm run typecheck`, `npm test`, `npm run build` pass; admin `npm run typecheck` and `npm run build` pass; `git status` shows no commits and no changes under `run-event-platform`.

### 1.7 Out of scope

Email sending, forced password change enforced by the server, session/JWT revocation on email change, editing participants/contact data of an order, order restore after cancel, hard delete of orders, audit log retention/export, rate limits for the new write routes (see D12), any change to `run-event-platform`, a replica set or transactions.

---

## 2. Technology and conventions (locked)

API: TypeScript, Express 5, Mongoose 8 on standalone MongoDB, Zod 3.25, vitest. Admin: Next 16 App Router client pages, React 19, lucide-react, native `<dialog>` via `components/ui.tsx` `Modal`. No dependency is added. New API files follow the README "add an endpoint in 5 lines" recipe: validator, view, service, controller, route.

---

## 3. Design

### 3.1 Events: archive, restore, hard delete, clearing fields

Choice: use the existing `archived` boolean, not a new `archived` value in `eventStatuses`. Reason: `archived: false` is already enforced in every public list, public detail, order creation (`loadOpenEvent`), image upload and public image lookup, so archiving is safe without touching `PUBLIC_EVENT_STATUSES`, the status enum (a public contract used by the platform) or the `{status,date}` index. Restoring is a dedicated endpoint because `PUT` is deliberately blocked on archived events and archived events are hidden from the default list.

New and changed endpoints (envelope `{statusCode, success, message, data, meta?}`; all `superOnly` unless noted):

| Method, path | Request | Success | Errors |
|---|---|---|---|
| `GET /admin/events` (changed, `read`) | new optional query `archived` = `true`/`false` (default `false`) | as today, `data: AdminEvent[]`, `meta` | 422 invalid value |
| `GET /admin/events/:id` (changed, `read`) | | now also returns an archived event (shows `archived: true`) | 404 `EVENT_NOT_FOUND` |
| `POST /admin/events/:id/archive` | no body | 200 `data: AdminEvent` with `archived: true` | 404 `EVENT_NOT_FOUND`, 400 `INVALID_PARAM` |
| `POST /admin/events/:id/restore` | no body | 200 `data: AdminEvent` with `archived: false` | same |
| `DELETE /admin/events/:id` | no body | 200 `data: null`, message `ลบงานวิ่งแล้ว` (uses `done()`) | 404 `EVENT_NOT_FOUND`; 409 `EVENT_HAS_ORDERS` ("งานนี้มีออเดอร์แล้ว ไม่สามารถลบถาวรได้ ให้เก็บถาวรแทน"); 409 `EVENT_QUOTA_RESERVED` (reserved quota without an order) |

Files:
- `validators/event.validator.ts`: `adminEventsQuery` gains `archived: z.preprocess(v => v === "" ? undefined : v, z.enum(["true","false"]).default("false").transform(v => v === "true"))`.
- `services/event/event-read.service.ts`: `listAdmin` uses `archived: q.archived`; `getAdmin(id)` drops the `archived: false` filter (it is only used by admin code paths; `update` has its own `archived: false` lookup so PUT on an archived event still gives 404).
- `services/event/event-write.service.ts`: add `archive`, `restore`, `remove`. `services/event.service.ts` barrel re-exports them.
- `controllers/admin-event.controller.ts`: `archive`, `restore`, `remove`. `routes/admin.routes.ts`: three routes with `superOnly` and `id` param validation, placed after `PUT /events/:id`.
- `utils/slip-file.ts`: new `deleteEventImageDir(eventId)`: validates `EVENT_ID` regex, resolves `events/<id>` under `eventImagesBase()`, checks `path.dirname(full) === base`, `rm(dir, { recursive: true, force: true })`, logs (`console.warn`) and never throws.
- `services/event-image.service.ts` `getImageFile` (admin variant only): drop `archived: false` so admin thumbnails of archived events still load. The public variant keeps `archived: false` (acceptance 3). Image mutation routes keep `archived: false`.
- `services/dashboard.service.ts`: compute `archivedIds = EventModel.distinct("_id", { archived: true })` and add `eventId: { $nin: archivedIds }` to the `Race.find` of the `races` list only. The status counts and revenue are untouched. When a specific `eventId` is requested the list is not filtered (an admin who explicitly opens an archived event still sees it).

Archive: `EventModel.updateOne({ _id, archived: false }, { $set: { archived: true } })`. `matchedCount === 0` then `EventModel.exists({ _id })`: missing -> 404, present -> already archived, return the view (idempotent). Audit `event.archive` with `{ slug }`. Restore is the mirror (`event.restore`).

Hard delete algorithm (no transaction; the event document is the commit point, same philosophy as `create`):
1. Load `EventModel.findOne({_id})` (any archived state). Missing -> 404. Keep `slug`, `name`, `images`.
2. Write-free pre-check: `Order.exists({ eventId })` -> if true throw 409 `EVENT_HAS_ORDERS` immediately. Nothing was written, so a refused delete never touches the public visibility of a live event (the common refusal path).
3. Atomically hide it: `updateOne({ _id, archived: false }, { $set: { archived: true } })`. This stops new checkouts (`loadOpenEvent` filters `archived: false`). Remember whether this call changed the flag (`wasArchived`).
4. TOCTOU re-check (an order created between step 2 and 3): `Order.exists({ eventId })` -> if true: undo step 3 (only if this call changed it) and throw 409 `EVENT_HAS_ORDERS`.
5. Guard against an in-flight checkout that reserved quota before step 3: `Race.exists({ eventId, reserved: { $gt: 0 } })` -> if true: same undo and 409 `EVENT_QUOTA_RESERVED` ("มีผู้กำลังจองที่นั่งอยู่ กรุณาลองใหม่ภายหลัง หรือเก็บถาวรแทน").
6. `Race.deleteMany({ eventId, reserved: 0 })`.
7. `EventModel.deleteOne({ _id })` (commit point).
8. Best effort: `deleteEventImageDir(id)`. DB is the truth, so a file failure never fails the request (same rule as `removeImage`).
9. `audit(actorId, "event.delete", "Event", id, { slug, name, raceCount, imageCount })`.

Failure handling: step 4-5 failures restore the flag (using `runUndo`, label `unarchive event`). If the undo itself fails, the original 409 is still returned, the event stays archived and `runUndo` logs the failed step. If step 6 or 7 throws after races were deleted, the event stays archived (hidden, safe) and the caller gets 500 via the global handler (logged `Unhandled error` by `resolveError`); the super_admin simply repeats the delete, every step is idempotent. Residual risk, documented in a code comment: a checkout that loaded the event before step 3 and writes its order after step 4 would leave an orphan order; step 5 plus the fact that `reserveQuota` fails once the races are deleted makes this window a few milliseconds and the order creation then fails with its own undo.

Clearing optional fields:
- `validators/event.validator.ts`: `category`, `theme`, `registrationEnds` become `.nullish()` (`z.enum(...).nullish()`, `ymd.nullish()`); `raceBody.start` becomes `z.string().regex(TIME_HHMM, ...).nullish()`. All other fields are unchanged, so `null` for `name/slug/date/venue/status/races` gives 422 `VALIDATION_ERROR`. Plain strings (`subtitle`, `description`, `province`, `organizer`, `refundPolicy`) keep their current "send an empty string to clear" behavior; they do not accept `null` (not needed, no contract change).
- `event-write.service.ts`: replace `eventFields(body)` by two pure helpers placed in a new `services/event/event-fields.ts` (unit-testable):
  - `splitEventFields(body): { set: Record<string, unknown>; unset: Record<string, ""> }` - for keys in `CLEARABLE = ["category","theme","registrationEnds"]`, `null` goes to `unset`, `undefined` is skipped (keeps stored value), a value goes to `set`. `races` is excluded. Undefined keys are never put in `$set`.
  - `createFields(body)` - `set` only, nulls dropped (so create with `null` behaves like omitted; the admin sends null for empty fields in both modes).
  - `update` runs `EventModel.updateOne({ _id }, { $set: set, ...(hasUnset ? { $unset: unset } : {}) })`. The same key is never in both.
  - `raceCreateFields(r, i, eventId)` - `{ eventId, name: r.name, price: r.price, quota: r.quota, sortOrder: i, ...(r.start ? { start: r.start } : {}) }`. It is the only way a new race document is built: `create()` calls `Race.create(body.races.map((r, i) => raceCreateFields(r, i, event._id)))` and the new-race branch of `updateRaces` uses it too, so `start: null`/`undefined`/`""` never reaches Mongo (unit-tested with `null`, `undefined`, `"06:00"`).
- `updateRaces`: the per-race `set` is built without `start` unless it is a string; `start === null` adds `$unset: { start: "" }` to the same `Race.updateOne`; `undefined` leaves it. New races with `null` omit `start`. The undo snapshot (`before`) records `start`; the inverse write uses `$set` for the fields and `$unset: { start: "" }` when `before.start` was undefined (today the inverse `$set: before` with an undefined `start` would not remove a start that was just written, this closes that hole).
- Public/admin views: `race.view.ts` already renders a missing `start` as `null`. For events `withId(e)` simply omits the removed keys (D6).

### 3.2 Users

Model `models/user.model.ts`: add `mustChangePassword: { type: Boolean, default: false }`. `cleanJson` already exposes everything except `passwordHash`, so `/auth/login`, `/auth/me`, `/users` return the new flag (additive).

Endpoints (all `superOnly`):

| Method, path | Request | Success | Errors |
|---|---|---|---|
| `POST /admin/users` (changed) | same body as today | 201 `User` with `mustChangePassword: true` | 409 `EMAIL_TAKEN`, 422 |
| `PATCH /admin/users/:id` (changed) | new optional `email` (trim, lowercase, `.email()`, max 200) in `updateUserBody` (still `.strict()`) | 200 `User` | 404 `USER_NOT_FOUND`, 409 `EMAIL_TAKEN`, 409 `LAST_SUPER_ADMIN`, 409 `CANNOT_MODIFY_SELF`, 422 |
| `DELETE /admin/users/:id` | none | 200 `data: null`, message `ลบผู้ใช้แล้ว` | 404 `USER_NOT_FOUND`; 409 `CANNOT_DELETE_SELF`; 409 `USER_STILL_ACTIVE`; 409 `USER_HAS_HISTORY` |

`user.service.ts` changes:
- `create`: sets `mustChangePassword: true`. Audit unchanged plus `{ role }`.
- `update` self guard (API-enforced, not UI-only): before any write, `if (actorId === id && (patch.active === false || (patch.role !== undefined && patch.role !== user.role))) throw ApiError.conflict("CANNOT_MODIFY_SELF", "ปิดใช้งานหรือเปลี่ยนบทบาทของบัญชีตัวเองไม่ได้")`. Self-demotion is therefore deliberately not allowed; editing own name/email/password stays allowed. Unit-tested.
- `update`: if `patch.email !== undefined && patch.email !== user.email`: `User.exists({ email, _id: { $ne: id } })` -> 409 `EMAIL_TAKEN`; set the email. The unique index remains the race-proof guard and `error-handler.ts` already maps `email_unique` E11000 to the same 409. `patch.password` set by someone else (`actorId !== id`) also sets `mustChangePassword = true`; a self reset leaves it false. The compensation snapshot `before` includes `email` and `mustChangePassword` so the last-super-admin rollback restores them. Audit meta: `fields` (already), plus `email: { from, to }` when changed, plus existing `passwordReset`.
- `remove(actorId, id)`:
  1. `id === actorId` -> 409 `CANNOT_DELETE_SELF` ("ลบบัญชีของตัวเองไม่ได้").
  2. Load user -> 404 `USER_NOT_FOUND`.
  3. `user.active` -> 409 `USER_STILL_ACTIVE` ("ต้องปิดใช้งานผู้ใช้ก่อนจึงจะลบถาวรได้"). This makes "never the last active super_admin" true by construction (an inactive user is not counted by `activeSupers`); the rule is still unit-tested.
  4. References: `AuditLog.exists({ userId: id })`, `Order.exists({ reviewedBy: id })`, `Payment.exists({ reviewedBy: id })` and `OrderNote.exists({ authorId: id })` (new). Any hit -> 409 `USER_HAS_HISTORY` ("ผู้ใช้นี้มีประวัติการใช้งานในระบบ ให้ปิดใช้งานแทนการลบ"). Because every login writes `auth.login`, only users that never logged in and never acted can be removed, which is exactly the "invited by mistake" case.
  5. `User.deleteOne({ _id: id, active: false })`; `deletedCount === 0` -> 409 `INVALID_STATE` (reactivated meanwhile).
  6. Audit `user.delete` on entity `User`, entityId `id`, meta `{ email, name, role }` (snapshot, the row is gone).
- `controllers/user.controller.ts`: `remove` uses `done(res, "ลบผู้ใช้แล้ว")`. Route: `adminRoutes.delete("/users/:id", superOnly, id, users.remove)`.
- `auth.service.changePassword`: `user.mustChangePassword = false` before `save()`.

Deactivation uses the existing `PATCH { active: false }` (already protected by `LAST_SUPER_ADMIN`; `requireAuth` reloads the user on each request so it takes effect immediately). Email change needs no session handling: the JWT subject is the user id.

Admin UI `app/(admin)/users/page.tsx`:
- Header button text "เชิญผู้ใช้ใหม่" with helper text "ระบบไม่ส่งอีเมล กรุณาตั้งรหัสผ่านชั่วคราวและแจ้งผู้ใช้เอง ผู้ใช้จะได้รับการแจ้งเตือนให้เปลี่ยนรหัสผ่านเมื่อเข้าสู่ระบบ".
- Create form: "สร้างรหัสผ่านชั่วคราว" button fills a 16-character password from `crypto.getRandomValues` (alphabet without look-alike characters, new helper `lib/password.ts`), password field toggles visible, "คัดลอก" copies via `navigator.clipboard` with a toast; fallback is the visible field.
- Edit form: email input editable (remove `readOnly` and the "ไม่สามารถแก้ไขอีเมลได้" hint), hint "ผู้ใช้ต้องใช้อีเมลใหม่เมื่อเข้าสู่ระบบ"; the body sends `email` only when changed. `fieldErrorsFor` shows 409 `EMAIL_TAKEN` under the field (the code is mapped by `formMessage`; add `EMAIL_TAKEN` to the field mapping in `lib/api/errors.ts` if the existing helper keys on `fields`: the API returns no `fields` for 409, so show `formMessage` in the form-level alert).
- Row actions: "แก้ไข", "ปิดใช้งาน"/"เปิดใช้งาน" (confirm `Modal`, disabled with `aria-describedby` hint for your own row), "ลบถาวร" (shown only when `!u.active` and not self; confirm `Modal` naming the user; a 409 `USER_HAS_HISTORY` shows the message and suggests keeping the user inactive).
- Columns: add "เข้าสู่ระบบล่าสุด" (`date(u.lastLoginAt, true)` or "–") and a badge "ต้องเปลี่ยนรหัสผ่าน" when `mustChangePassword`.
- First-login nudge: `AuthProvider` exposes `refresh()` (re-run `authApi.me`); `AdminShell` opens `ChangePasswordModal` once per session when `user.mustChangePassword`, with the line "บัญชีนี้ใช้รหัสผ่านชั่วคราว กรุณาเปลี่ยนรหัสผ่านใหม่"; `ChangePasswordModal` takes an optional `onChanged` and the shell passes `refresh`. It can be dismissed (hint only, D8).

### 3.3 Order notes

Decision: a separate collection, not an embedded array on the order. Reasons: the admin order list does `Order.find(...).lean()` and `toAdminOrderView` spreads every field, so an embedded array would leak into list rows and bloat them (and golden tests); notes never touch the quota/state code paths of `Order`; delete is a plain `deleteOne`. The API shape is still "a list on the order detail".

Model `models/order-note.model.ts`:
```ts
const orderNoteSchema = new Schema(
  {
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    authorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, required: true, trim: true, maxlength: ORDER_NOTE_MAX },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
orderNoteSchema.index({ orderId: 1, createdAt: 1 });
orderNoteSchema.index({ authorId: 1 });          // user delete reference check
cleanJson(orderNoteSchema);
export type OrderNoteLean = OrderNoteDoc & { _id: Types.ObjectId };
export const OrderNote = model("OrderNote", orderNoteSchema);
```
Register in `models/index.ts` (export and `syncAllIndexes`). Constants in `config/constants.ts`: `ORDER_NOTE_MAX = 1000`, `ORDER_NOTES_MAX_PER_ORDER = 100`.

Endpoints (`write` role; both return the full order detail so the UI can reuse one shape, like `cancel`/`tracking`):

| Method, path | Request | Success | Errors |
|---|---|---|---|
| `POST /admin/orders/:id/notes` | `{ text: string }` trim, 1..1000 | 201 `data: OrderDetail` | 404 `ORDER_NOT_FOUND`; 422 `VALIDATION_ERROR` (`fields.text`); 422 `NOTE_LIMIT_REACHED` ("บันทึกครบ 100 รายการแล้ว") |
| `DELETE /admin/orders/:id/notes/:noteId` | none | 200 `data: OrderDetail` | 404 `ORDER_NOT_FOUND` / `NOTE_NOT_FOUND`; 403 `FORBIDDEN` when a reviewer deletes someone else's note |

Validators (`admin.validator.ts`): `noteBody = z.object({ text: z.string({required_error}).trim().min(1,"กรุณากรอกบันทึก").max(ORDER_NOTE_MAX) })`; `noteParams = z.object({ id: objectId, noteId: objectId })` (same pattern as `imageParams`). The route uses `validate({ params: noteParams })`; the controller reads `validatedParams<NoteParams>`.

Service `services/order/order-notes.service.ts`:
- `addNote(actor, orderId, text)`: `findOrderOr404(orderId, "_id")`; `OrderNote.countDocuments({ orderId }) >= cap` -> 422 (non-atomic soft cap: two simultaneous requests could reach 101, accepted); `OrderNote.create`; `audit(actor.id, "order.note.add", "Order", orderId, { noteId })` (the text is not copied into the audit log); return `getAdmin(orderId)`.
- `removeNote(actor, orderId, noteId)`: load note `{ _id: noteId, orderId }` -> 404; `actor.role !== "super_admin" && String(note.authorId) !== actor.id` -> `ApiError.forbidden("ลบได้เฉพาะบันทึกของตัวเอง")`; `deleteOne({ _id: noteId, orderId })`; audit `order.note.delete` `{ noteId, authorId }`; return `getAdmin`.
- Controllers pass `req.user` (`{id, role}`) because the rule depends on the role.

### 3.4 Order address edit

- `services/order/order-state.ts`: add `export const ADDRESS_EDITABLE: readonly OrderStatus[] = ["pending","slip_uploaded","rejected","paid"]` with the comment "shipping starts when a tracking number is set; cancelled and expired are final" and a pure `canEditAddress(o: Pick<OrderLean,"status"|"delivery"|"trackingNo">): boolean` (`delivery === "shipping" && ADDRESS_EDITABLE.includes(status) && !trackingNo`). The state machine has no "shipped" state, so "before shipping" is defined by the tracking number, which is the only shipping marker in the model.
- `validators/order.validator.ts`: extract the address part of `validateDelivery` into `export function validateAddress(a: {street,subdistrict,district,province,postalCode}): FieldErrors` (same messages and rules: required street/subdistrict/district, province in `provinces`, postal code `^\d{5}$`); `validateDelivery` calls it for `method === "shipping"`. Behavior of checkout is unchanged (covered by a test).
- `validators/admin.validator.ts`: `addressBody = z.object({ street, subdistrict, district, province, postalCode })` where each is `z.string().max(...)` using the same maxima as `deliveryShape` (300/100/100/100/10) with `.superRefine` calling `validateAddress`, so field errors come out as `fields.street` etc. The values are trimmed in the service exactly like `addressOf` (reuse by exporting `addressOf`-style trimming from `order-create.service.ts` into `order/order-address.ts`; both import it).
- Endpoint `PATCH /admin/orders/:id/address` (`write`): 200 `data: OrderDetail`; 404 `ORDER_NOT_FOUND`; 409 `INVALID_STATE` ("แก้ไขที่อยู่ได้เฉพาะออเดอร์จัดส่งที่ยังไม่ได้ใส่เลขพัสดุและยังไม่ถูกยกเลิก/หมดอายุ"); 422 with `fields`.
- Service `updateAddress(actorId, id, input)`: `findOrderOr404(id, "status delivery trackingNo address")`; `canEditAddress` false -> 409. Then the guarded write `Order.updateOne({ _id: id, delivery: "shipping", status: { $in: [...ADDRESS_EDITABLE] }, trackingNo: null }, { $set: { address } })` (`trackingNo: null` matches missing or null); `matchedCount === 0` -> 409 (a concurrent tracking/cancel won). Audit `order.address.update` with `{ before, after }`. Return `getAdmin`.
- Not changing contact name/phone, amount, or participants.

### 3.5 Timeline, notes in detail, reviewer name

Response of `GET /admin/orders/:id` and of every mutation that returns the detail gets four appended keys (never renamed/removed; list endpoints unchanged):

```ts
{ ...existing,
  participants, payments,                       // existing, same order
  reviewedByName: string | null,
  canEditAddress: boolean,
  notes: OrderNoteView[],                       // ascending createdAt
  timeline: OrderTimelineEntry[] }              // ascending at

OrderNoteView = { id, orderId, text, createdAt, author: { id, name } | null }
OrderTimelineEntry = { id: string, kind: TimelineKind, at: Date, actor: { id, name } | null, detail: string | null }
TimelineKind = "created" | "slip_uploaded" | "slip_rejected" | "paid" | "cancelled"
             | "expired" | "tracking_set" | "address_updated" | "note"
```
`actor` is `null` for customer actions (created, slip upload) and for legacy rows without an actor. `detail` is already plain text (reason, transaction ref, note text, "ผู้ให้บริการ · เลขพัสดุ"); labels per kind are Thai strings in the admin (`format.ts`), so the API stays language-neutral for the label but Thai for messages as elsewhere.

Views (pure, no DB, no `Date.now()`):
- `views/order-note.view.ts`: `toOrderNoteView(note, names)`.
- `views/order-timeline.view.ts`: `toOrderTimelineView({ order, payments, notes, audit, names })`. Rules:
  - `created` at `order.createdAt`.
  - per payment: `slip_uploaded` at `payment.createdAt`; if `payment.status === "rejected" && payment.reviewedAt`: `slip_rejected` at `reviewedAt`, actor = `reviewedBy`, detail = `rejectReason`.
  - `paid` at `order.paidAt` when set, actor = `order.reviewedBy`, detail = `transactionRef`.
  - `cancelled`: the audit row `order.cancel` (time, actor, `meta.reason`); legacy fallback when `status === "cancelled"` and no audit row: at `order.updatedAt`, actor `null`, detail `order.cancelReason`. (There is no `cancelledAt` field; the audit row is the source of the time.)
  - `expired` when `status === "expired"`: at `order.expiresAt ?? order.updatedAt`.
  - `tracking_set`: every audit row `order.tracking`, detail `provider · trackingNo` (see audit change below; old rows show only the provider).
  - `address_updated`: every audit row `order.address.update`.
  - `note`: each note (time, author, text). Audit rows `order.note.*`, `order.approve`, `order.reject` are NOT turned into entries (notes/payments already represent them), which is what prevents duplicates.
  - Sorted by `at`, then by a fixed kind rank, then by `id`. Entry ids are stable strings (`created`, `payment:<id>:uploaded`, `audit:<id>`, `note:<id>`).
- `views/order.view.ts`: `toAdminOrderDetailView(order, participants, payments, extras?)`. With `extras` omitted the output is byte-identical to today (keeps `golden-views.json` green); with it, `reviewedByName`, `canEditAddress`, `notes`, `timeline` are appended after `payments`.

Service: new `services/order/order-detail.service.ts` with `loadDetailExtras(order, payments)`:
`Promise.all` of `OrderNote.find({ orderId }).sort({ createdAt: 1 }).limit(ORDER_NOTES_MAX_PER_ORDER).lean()` and `AuditLog.find({ entity: "Order", entityId: id, action: { $in: TIMELINE_AUDIT_ACTIONS } }).sort({ createdAt: -1 }).limit(200).lean()` (newest 200 are kept; the view sorts ascending) (uses the existing `{entity, entityId, createdAt}` index), then one `User.find({ _id: { $in: ids } }).select("name")` for reviewer, payment reviewers, note authors and audit actors. `getAdmin` in `order-admin.service.ts` calls it. Failures: a failing extras query makes the whole GET fail with the standard 500/503 (no half-built timeline); nothing is swallowed. Unknown/deleted user -> `actor: null` / `reviewedByName: null`.

Audit change for tracking: `setTracking` audits `{ provider, trackingNo }` (the tracking number is operational data, not a secret). Old rows still render.

Admin UI `features/admin/order-detail.tsx` (extract the new parts into `features/admin/order-notes.tsx`, `order-timeline.tsx`, `order-address-form.tsx` so the 385-line file does not double):
- Reviewer line uses `order.reviewedByName ?? order.reviewedBy`.
- Address row: if `order.canEditAddress && canWrite(user.role)` a "แก้ไขที่อยู่" button switches the modal into an inline form (street, subdistrict, district, `<select>` of provinces from `lib/constants.ts` `PROVINCES` copied from the API list with the same "keep in sync" comment as the image constants, postal code). Submit calls `ordersApi.updateAddress`, shows field errors via `fieldErrorsFor`, toast "บันทึกที่อยู่แล้ว", then `reload()` and `onChanged?.()` (does not close the modal). 409 shows "ไม่สามารถแก้ไขที่อยู่ได้ในสถานะปัจจุบัน" and reloads (the button then disappears).
- Notes section "บันทึกภายใน" (visible to all roles, read-only for viewer): list (author, `date(createdAt, true)`, text with `white-space: pre-wrap`), delete button per note when `isSuper(role)` or note author is me (confirm via inline two-step "ยืนยันลบ", same pattern as image delete), textarea with `maxLength` 1000 and a live counter, "เพิ่มบันทึก" button (`canWrite`). Uses its own pending state; `reload()` after each call.
- Timeline section "ไทม์ไลน์" (all roles): ordered list `<ol>` with an icon per kind, Thai label from `timelineLabels`, time, actor name, detail. Empty can not happen (always `created`).
- The old `run()` helper (closes the modal) stays for cancel/approve/reject.

### 3.6 Audit log read API and page

`models/audit-log.model.ts`: add indexes `{ createdAt: -1 }`, `{ userId: 1, createdAt: -1 }`, `{ action: 1, createdAt: -1 }` (existing `{entity, entityId, createdAt}` stays). `syncAllIndexes` already includes `AuditLog` and runs at start-up. Export `AuditLogLean` type derived with `InferSchemaType`.

Endpoint `GET /admin/audit-logs` (`superOnly`, `validate({ query: v.auditLogsQuery })`):

```ts
auditLogsQuery = pageQuery.extend({
  userId: optObjectId,           // actor
  action: optStr,                // exact match, max 200 (optStr rule), e.g. "order.cancel"
  entity: z.preprocess(emptyToUndef, z.enum(["User","Event","Order","Participant"]).optional()),
  entityId: optObjectId,         // order id or event id
  from: optDate, to: optDate,    // YYYY-MM-DD, Bangkok, bangkokRange
})
```
Success: `200 data: AuditLogView[], meta: PageMeta`, sorted `createdAt desc, _id desc`, default 20, max 100 per page (`pageQuery`). Errors: 401/403 by guards, 422 invalid filter.

```ts
AuditLogView = { id, action, entity, entityId: string | null,
                 meta: Record<string, unknown> | null,
                 actor: { id, name, email } | null, createdAt }
```
Files: `validators/admin.validator.ts` (query + type), `views/audit-log.view.ts` (`toAuditLogView(row, actors)`), `services/audit-log.service.ts` (`list(q)`: build filter, `find/countDocuments` in parallel, one `User.find` for actors, `toAuditLogView`), `controllers/audit-log.controller.ts`, route in `admin.routes.ts` (`--- audit ---` section). `audit.service.ts` stays write-only. `meta` is returned as stored. Audit rows for address edits contain address PII; the endpoint is super_admin only, which is the same audience that can already read all orders.

Actions recorded after this task (all via the existing `audit()` helper, which never throws): existing `auth.*`, `event.create|update|image.*`, `order.cancel|tracking|approve|reject`, `participant.patch`, `user.create|update`, plus NEW `event.archive`, `event.restore`, `event.delete`, `user.delete`, `order.note.add`, `order.note.delete`, `order.address.update`; `user.update` meta gains `email`; `order.tracking` meta gains `trackingNo`.

Admin:
- `lib/api/endpoints/audit-logs.ts` (`getPage<AuditLogEntry>("/audit-logs", filters, signal)`), re-exported as `auditLogsApi` in `lib/api/index.ts`; types in `types.ts`.
- New page `app/(admin)/audit-logs/page.tsx` titled "ประวัติการใช้งาน": wrapper checks `isSuper` and shows the same "ไม่มีสิทธิ์เข้าถึง" `EmptyState` as the users page. Filters: actor `<select>` (from `usersApi.listUsers`), action `<select>` (`AUDIT_ACTION_LABELS` in `features/admin/format.ts`, includes "ทั้งหมด"), entity `<select>`, `from`/`to` date inputs (invalid range like the reports page), and a text input "รหัสออเดอร์ / งานวิ่ง" validated as 24 hex before it is sent. Filter changes reset the page to 1 (same `changeFilter` pattern as the orders page). Table: time, actor, action label, target (for `Order` a `Link` to `/orders?order=<id>` which the orders page already reads; for others the entity name + short id), details (`<details>` summary with formatted JSON `meta` in `<pre>`). `LoadingState`, `ErrorState`, `EmptyState`, `Pager unit="รายการ"`.
- Navigation in `components/admin-shell.tsx`: add `{ href: "/audit-logs", title: "ประวัติการใช้งาน", icon: History, scope: "global", superOnly: true }`; generalize the existing `item.href !== "/users" || isSuper(...)` filter to `!item.superOnly || isSuper(user.role)` and mark `/users` with `superOnly` too. `proxy.ts` needs no change (it only checks the cookie).

### 3.7 Shipping search

- `validators/admin.validator.ts`: `shippingQuery` gains `q: optStr` (so `exportShippingQuery`, derived with `.omit`, gets it for free).
- `services/shipping.service.ts`: `filterOf` becomes async `buildFilter(q)`. With `q`: `re = new RegExp(escapeRegex(q), "i")`; `paidIds = Order.find(baseFilter).distinct("_id")` (paid orders only, already narrowed by event/delivery); `participantOrderIds = Participant.distinct("orderId", { orderId: { $in: paidIds }, $or: [{ $expr: { $regexMatch: { input: { $concat: ["$firstName", " ", "$lastName"] }, regex: escapeRegex(q), options: "i" } } }, { bibNo: re }] })`. The `$concat` full-name match keeps parity with the client filter, which matched `name + " " + bibNo` as one string, so "สมชาย ใจดี" (first + last) matches. If `paidIds.length` exceeds `SHIPPING_SEARCH_ID_LIMIT = 5000` (constant in `config/constants.ts`), the participant match instead runs as `Participant.aggregate([{ $match: <name/bib match> }, { $lookup: orders, pipeline matching baseFilter }, ...])` to get `orderId`s, so no `$in` list above the limit is ever built. Filter `$or: [{ orderNo: re }, { contactName: re }, { contactPhone: re }, { trackingNo: re }, { _id: { $in: participantOrderIds } }]`. The base filter `{ status: "paid", eventId?, delivery? }` keeps using the `{eventId, status, createdAt}` index to narrow the set before the regex runs; the regexes are unanchored and case-insensitive like `adminFilter` and `participant.service` (no new index can help an unanchored regex; accepted for the same reason). `list`, `listForExport` call `buildFilter`. Input limit: `optStr` (trimmed, max 200, empty becomes undefined).
- No change to the response shape.
- Admin `shipping/page.tsx`: `const q = useDebounced(query.trim())`, pass `q` in `shippingApi.listShipping` and `exportsApi.exportFulfillmentCsv`, include `q` in `useAsync` deps, reset `page` to 1 in the search `onChange`, delete the client `.filter`, placeholder "ค้นหาชื่อ เลขออเดอร์ เบอร์โทร เลขพัสดุ หรือเลข BIB", count text `data.meta.total` "ออเดอร์" instead of "ในหน้านี้". `ShippingFilters` gets `q?: string`; `exportFulfillmentCsv` query type gets `q`.

### 3.8 Server CSV for overview and shirt sizes

The export pattern is cheap to reuse: `toCsv` (BOM, quoting, `safeCell` formula guard), `sendCsv`, and the data comes from services that already exist (`dashboard.service.get`, `report.service.shirtSizeReport`), so the decision is to move both to the server.

| Method, path | Query | Success | Errors |
|---|---|---|---|
| `GET /admin/export/overview.csv` (`read`) | `dashboardQuery` (`eventId` optional) | `text/csv`, `attachment; filename="overview.csv"`, `Cache-Control: private, no-store` | 422 invalid `eventId` |
| `GET /admin/export/shirt-sizes.csv` (`read`) | `shirtSizesQuery` (`eventId`, `status` default `paid`) | same, `filename="shirt-sizes.csv"` | 422 |

- `services/export.service.ts`: `overviewCsv(q: DashboardQuery)` and `shirtSizesCsv(q: ShirtSizesQuery)`. Rows are identical to today's browser output: overview = `["รายการ","จำนวน"]`, `["ที่นั่งที่จอง", participants]`, `["ยอดชำระแล้ว", paidRevenue]`, `["สลิปรอตรวจ", pendingReview]`, then one `["<event> · <race> (จอง/โควตา)", "reserved/quota"]` per race; shirts = `["ไซซ์เสื้อ","จำนวน"]` plus one row per size in `shirtSizes` order. (Exact strings are copied from `exportOverview` and the reports page at implementation time so the file content does not change.) Note: an overview now excludes races of archived events when no event is selected (3.1), which is intended.
- `controllers/export.controller.ts`: `overview`, `shirtSizes`; routes under `// --- CSV export ---`. The three existing export handlers and their routes are not touched.
- Admin: `lib/api/endpoints/exports.ts` adds `exportOverviewCsv({ eventId })` and `exportShirtSizesCsv({ eventId, status })` via `downloadCsv`; `app/(admin)/page.tsx` and `reports/page.tsx` use them with an `exporting` flag, `notify(errorMessage(failure))` on error; `features/admin/client-csv.ts` is deleted (grep confirms only those two callers). `EXPORT_LIMIT` warning is not needed for these small files.

### 3.9 Events UI

`app/(admin)/events/page.tsx` and `lib/api/endpoints/events.ts`:
- `EventBody`: `category?: EventCategory | null`, `theme?: EventTheme | null`, `registrationEnds?: string | null`; `RaceBody.start?: string | null`. `toEventBody` sends `category: form.category || null`, `theme: form.theme || null`, `registrationEnds: form.registrationEnds || null`, race `start: race.start || null` (the doc comment about "cannot be cleared" is replaced). The API ignores nulls on create.
- Remove the three "ตั้งค่าแล้วไม่สามารถล้างได้" hints and `required={Boolean(original?.registrationEnds)}`; add a small "ล้างค่า" affordance only where the native input cannot be emptied easily (`<select>` already has an empty option; date input has the browser clear control, plus a text button "ล้างวันที่" for keyboard users).
- `EventFilters` gets `archived?: boolean`; a new select "การแสดงผล": "ใช้งานอยู่" (default) / "เก็บถาวร". Archived cards show a "เก็บถาวร" badge; the "จัดการงาน" (edit) button is hidden for archived events; footer buttons for super_admin: active event -> "เก็บถาวร" and "ลบ"; archived event -> "กู้คืน" and "ลบ".
- Confirm dialogs (`Modal`, focus on the cancel button, danger style):
  - Archive: "เก็บถาวรงาน «{name}»? งานจะถูกซ่อนจากหน้าเว็บสาธิตสมัครและรายการหลัก สามารถกู้คืนได้ภายหลัง".
  - Delete: "ลบงาน «{name}» ถาวร? ระยะวิ่งและรูปภาพจะถูกลบ ไม่สามารถกู้คืนได้ ลบได้เฉพาะงานที่ไม่มีออเดอร์". On 409 `EVENT_HAS_ORDERS` the same dialog changes to "งานนี้มีออเดอร์แล้ว ลบถาวรไม่ได้" with the primary button "เก็บถาวรแทน".
  - Restore needs no confirm (reversible, non-destructive).
- After any of the three: toast, `reload()` of the list, `reloadEvents()` from `useScope` (the scope provider already falls back to "all events" when the selected id vanished).
- `lib/api/endpoints/events.ts`: `archiveEvent`, `restoreEvent` (`mutate<AdminEvent>("POST", ...)`), `deleteEvent` (`mutate<null>("DELETE", ...)`).

### 3.10 Admin client plumbing (summary of file changes)

- `lib/api/types.ts`: `User.mustChangePassword?: boolean`; `OrderDetail` gains `reviewedByName: string | null`, `canEditAddress: boolean`, `notes: OrderNote[]`, `timeline: OrderTimelineEntry[]`; new `OrderNote`, `OrderTimelineEntry`, `TimelineKind`, `AuditLogEntry`, `AuditLogFilters`, `AddressBody`; `UserPatchBody.email?: string`; body types per section 3.9.
- `lib/api/endpoints/orders.ts`: `addNote`, `deleteNote`, `updateAddress`. `users.ts`: `deleteUser`. `shipping.ts`/`exports.ts`/`events.ts` per above. New `audit-logs.ts`.
- `lib/constants.ts`: `PROVINCES`, `ORDER_NOTE_MAX = 1000`, `AUDIT_ENTITIES`.
- `features/admin/format.ts`: `timelineLabels`, `auditActionLabels` (Thai), reuse `roleLabels`.
- `features/admin/auth-provider.tsx`: `refresh()`.
- Docs: replace the README "Gaps" section with a "Admin features backed by the API" note and the remaining honest limits; update `docs/SYSTEM.md` features and gap lists; API `README.md` endpoint table and error-code list (`EVENT_HAS_ORDERS` on delete, `USER_HAS_HISTORY`, `USER_STILL_ACTIVE`, `CANNOT_DELETE_SELF`, `NOTE_LIMIT_REACHED`, `NOTE_NOT_FOUND`), project structure list, and `postman/running-event-api.postman_collection.json` requests for each new endpoint.

---

## 4. Role matrix

| Capability | viewer | reviewer | super_admin |
|---|---|---|---|
| Read orders, timeline, notes, shipping, exports (incl. 2 new) | yes | yes | yes |
| Add note | no | yes | yes |
| Delete note | no | own | any |
| Edit order address | no | yes | yes |
| Archive/restore/delete event, clear event fields (PUT) | no | no | yes |
| Create/edit/deactivate/delete user, edit email | no | no | yes |
| Read audit log | no | no | yes |

All gating is on the API (`read`/`write`/`superOnly`, the own-note check in `removeNote`, and the `CANNOT_MODIFY_SELF` / `CANNOT_DELETE_SELF` guards in `user.service`); the UI hides or disables controls as a convenience only.

## 5. Validation rules for external input

| Input | Rule | On failure |
|---|---|---|
| `:id`, `:noteId` | ObjectId (`objectIdParam`/`noteParams`) | 400 `INVALID_PARAM` |
| `archived` query | optional, `true`/`false`, default `false` | 422 |
| Event body null fields | `null` only for `category`, `theme`, `registrationEnds`, `races[].start` | 422 `VALIDATION_ERROR` with the field path |
| User `email` | optional, trimmed, lowercased, valid email, max 200 | 422; 409 `EMAIL_TAKEN` |
| Note `text` | required, trimmed, 1..1000 | 422 `fields.text` |
| Address | all five required; street <= 300, subdistrict/district/province <= 100, postal <= 10 before `validateAddress`; province in list; postal 5 digits | 422 with `fields.<name>` |
| `shipping q` | optional, trimmed, max 200, regex-escaped | empty -> ignored; >200 -> 422 |
| Audit filters | `userId`, `entityId` ObjectId; `entity` enum; `action` <= 200; dates `YYYY-MM-DD` | 422 |
| CSV queries | `dashboardQuery`, `shirtSizesQuery` as for the JSON endpoints | 422 |

## 6. Error handling table

| Operation | Condition | Kind | Caller receives | Logged |
|---|---|---|---|---|
| Event hard delete | not found | recoverable | 404 `EVENT_NOT_FOUND` | no |
| | has any order (pre-check, no write) | recoverable | 409 `EVENT_HAS_ORDERS` | no |
| | order appeared after pre-check, or reserved quota > 0 | recoverable | 409 `EVENT_HAS_ORDERS` / `EVENT_QUOTA_RESERVED`, flag restored | no |
| | DB failure at step 6/7 | fatal for this call, retryable | 500 `INTERNAL_ERROR` (event remains archived, hidden) | `console.error("Unhandled error:")` |
| | image dir removal fails | ignored | 200 | `console.warn` |
| | undo of the archive flag fails | ignored, event stays archived | the original 409 | `runUndo` logs each failed step |
| Archive/restore | missing | recoverable | 404 | no |
| User delete | self / active / has history / concurrently reactivated | recoverable | 409 with the codes in 3.2 | no |
| User update | self deactivate / self role change | recoverable | 409 `CANNOT_MODIFY_SELF` | no |
| User email | taken (check or E11000) | recoverable | 409 `EMAIL_TAKEN` | no |
| Note add | order missing / cap / bad text | recoverable | 404 / 422 `NOTE_LIMIT_REACHED` / 422 | no |
| Note delete | missing / not allowed | recoverable | 404 `NOTE_NOT_FOUND` / 403 | no |
| Address edit | wrong delivery or state, or lost the guarded write | recoverable | 409 `INVALID_STATE` | no |
| Audit write | any failure | swallowed by `audit()` (existing rule) | the main response is unaffected | `console.error("audit log failed")` |
| Order detail extras | any DB failure | fatal for the request | 500/503 via global handler | handler logs |
| Audit log list / CSV | DB failure | fatal for the request | 500/503 | handler logs |

## 7. Invariants and who enforces them

- "Event with orders is never hard deleted": service (`remove`) via a write-free order pre-check, then order + reserved-quota re-checks after the archive step. The UI cannot know (the list `orderCount` excludes cancelled/expired), so the API is the owner; the UI reacts to 409.
- "Archived events are not public": already enforced in queries (`archived: false`) in the service layer; reused, not duplicated.
- "Address editable only before shipping": service via the conditional `updateOne` filter (atomic with the write), mirrored for display by `canEditAddress` computed from the same `canEditAddress()` function.
- "Users with history are never deleted; at least one active super_admin exists; no self delete": `user.service.remove` / `update`; the DB unique index owns email uniqueness.
- "Notes belong to an existing order and respect ownership on delete": service (`removeNote`), role comes from `req.user` reloaded from the DB on every request.
- "Additive contract": enforced by `golden.test.ts` plus new tests asserting key order of the extended detail view.
- "No dangling nulls in the DB": `splitEventFields`/`createFields`/`raceCreateFields` are the only way event and new-race fields reach Mongo.

## 8. Testability

Unit (vitest, no Mongo, same style as `tests/views/*.test.ts` and `event-images.test.ts`):
- `tests/event-fields.test.ts`: `splitEventFields` for omitted / null / value, `createFields` drops null, `raceCreateFields` with `start` `null` / `undefined` / `"06:00"`.
- Validators: `eventBody` nullable rules, `updateUserBody` email + strict, `noteBody`, `addressBody`/`validateAddress` (and a regression that `validateDelivery` is unchanged), `shippingQuery.q`, `auditLogsQuery`, `adminEventsQuery.archived`.
- `canEditAddress` truth table over all statuses x delivery x trackingNo.
- Views: `toOrderTimelineView` (ordering, no duplicates, fallbacks for cancel/expired, deleted users), `toAdminOrderDetailView` without extras equals the golden, with extras appends keys in order, `toOrderNoteView`, `toAuditLogView`.
- `resolveError` maps new E11000/ApiError codes (existing pattern).
- Deactivated-user rule helper: pure function `canHardDelete({ self, active, hasHistory })` in `user.service.ts` exported for the test.
Integration (needs a standalone `mongod`; the repo has none today, so this is a manual checklist plus optional script, run once before handing over): delete event with/without orders and with images on disk, archive/restore visibility in public routes, user delete matrix, note permissions, address edit state matrix and concurrent tracking, shipping search across pages, audit list filters, new CSVs, PUT null clearing and omitted keys keeping values.
Admin: no test runner exists and none is added; verification is `npm run typecheck`, `npm run build` and a manual pass of each acceptance criterion in the browser.

## 9. Implementation order

1. API foundations: constants, models (`OrderNote`, user flag, audit indexes), validators, `validateAddress` extraction, `slip-file` helper. Typecheck.
2. API features in this order, each with its tests: event fields/null clearing -> archive/restore/delete + dashboard filter -> users -> notes + address + detail extras/timeline -> audit list -> shipping q -> two CSVs.
3. API docs/postman. `npm run typecheck && npm test && npm run build`.
4. Admin: types and endpoints, then pages in the same order, then nav/auth-provider, then deleting `client-csv.ts` and the stale hints, then docs. `npm run typecheck && npm run build`.
5. Manual verification checklist (section 1.6) against a local API with a standalone Mongo; clean up temp files and uploads.

---

## 10. Decisions made for you

- D1 Archive uses the existing `archived` flag, not a new status value (reason in 3.1). Restore is a dedicated `POST /events/:id/restore` and an "archived" list filter, instead of "reversible by editing status", because `PUT` is blocked on archived events and the status enum is a public contract.
- D2 `GET /admin/events/:id` now also returns archived events; the admin image file route also works for archived events; public routes are unchanged.
- D3 Dashboard race list excludes races of archived events when no event is selected (found during verification; order counts untouched).
- D4 Hard delete is checked against orders of any status plus reserved quota, and deletes races, event, and the image directory; it first archives to stop new checkouts and leaves the event archived if a later step fails.
- D5 User permanent delete requires the user to be deactivated first, which satisfies "never the last active super_admin" structurally; it also refuses any user with audit, review or note references (practically: never logged in and never acted). Everyone else is "deleted" by deactivation.
- D6 Clearing `category`/`theme` unsets the fields as specified. They then disappear from the event JSON (the schema defaults only apply to hydrated documents, not `.lean()`), so the public platform must treat them as optional. `run-event-platform` currently reads `event.category`/`event.theme` unguarded from its mock data, and it is out of scope, so this is flagged as a follow-up risk, not fixed.
- D7 Notes live in their own `ordernotes` collection (not embedded) to keep order list rows and golden views untouched; cap 100 per order (soft, non-atomic); deleting a note removes it from the timeline but its `order.note.delete` audit row remains. Note text is not copied into audit meta.
- D8 `mustChangePassword` is a stored flag set on admin-created users and on password resets by another admin, cleared on change-password, returned by `/auth/me`. The UI nudges with a dismissible dialog; the server does not block anything.
- D9 "Before shipping" for address edit = delivery `shipping`, status in `pending|slip_uploaded|rejected|paid`, and no tracking number. The state machine has no shipped state, the tracking number is the only marker.
- D10 Timeline cancel/tracking/address times come from audit rows (no `cancelledAt`/`trackingAt` fields exist); legacy cancelled orders without an audit row fall back to `updatedAt`; expiry time is `expiresAt`. Tracking audit now records the tracking number.
- D11 Order detail also carries `reviewedByName` and `canEditAddress` (added keys beyond notes/timeline) so the UI does not print an ObjectId and does not duplicate the state rule.
- D12 No new rate limiter on the note/address/delete routes: they are authenticated, role-gated, origin-checked and low volume, and the only existing admin limiters protect login and uploads. Easy to add later with the `uploadLimiter` pattern.
- D13 Shipping `q` also matches participant full name (first + last) and BIB (parity with today's client filter), restricted to paid orders with a bounded id set; `contactPhone` is a deliberate addition beyond the client filter. It applies to the fulfillment CSV export too.
- D14 Overview/shirt CSVs move to the server with identical rows; `client-csv.ts` is removed.
- D15 Temporary-password generator is client-side (`crypto.getRandomValues`), shown to the super_admin once in the form; the API never returns or logs passwords.
- D16 Email change does not revoke sessions (JWT subject is the id) and the audit row stores old and new email.
- D17 No new dependency; admin gets no test framework (as today).
- D18 Clearing `category`/`theme` removes the keys from event JSON (the one bend of "keys never removed"); documented in the API README contract notes and the platform follow-up, and the admin UI shows a fallback label ("ไม่ระบุ") when the key is missing.
- D19 Self-deactivate and self-role-change are blocked on the API with 409 `CANNOT_MODIFY_SELF`; the UI disabled state is only a hint.

---

## 11. Responses to design review findings

- 1 (MEDIUM) Addressed: `raceCreateFields` shared by `create()` and `updateRaces` (3.1, section 7, section 8).
- 2 (MEDIUM) Addressed: API guard 409 `CANNOT_MODIFY_SELF` in `user.service.update` (3.2), acceptance 5a, error table, role-matrix note, D19. Self-demotion is deliberately blocked too.
- 3 (MEDIUM) Addressed: write-free `Order.exists` pre-check before the archive step; archive then re-check only as TOCTOU guard; acceptance 2 and error table restated (3.1).
- 4 (MEDIUM) Addressed: full-name regex match, paid-only bounded id set with a fallback above 5000, D13 and acceptance 15 updated; phone is a documented addition. (Superseded: plan.md amendment 3 replaces the bounded id set and fallback with one always-on aggregation.)
- 5 (NIT) Addressed: acceptance 16 reworded.
- 6 (NIT) Addressed: D18 (README note, UI fallback label). (Superseded: plan.md amendment 1.)
- 7 (NIT) Addressed: timeline audit query sorts descending with limit 200, view sorts ascending.
- 8 (NIT) Addressed: reserved-quota guard returns distinct 409 `EVENT_QUOTA_RESERVED`. Add it to the API README error-code list in the 3.10 docs work.
