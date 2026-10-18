# Implementation Plan: admin full integration

Source of truth, in this order: (1) this file, (2) `design.md` (same folder), (3) `design-review.md` ("Verified Assumptions" can be trusted). Where this file and `design.md` disagree, this file wins. `design.md` carries a banner that points here.

## 0. Roots and rules (stated once)

- API root: `c:/Project/running-event-api/` . Source is `API/src/`, tests are `API/tests/` (vitest, no Mongo, `vitest.config.mts` sets throwaway env). In this plan `API/` means `c:/Project/running-event-api/`.
- Admin root: `c:/Project/running-event-admin/src/` . Every admin path in this plan and in `design.md` is relative to it. `ADMIN/` below means `c:/Project/running-event-admin/src/`.
- Never touch `c:/Project/run-event-platform`. Never contact the deployed server `http://14.207.142.107:4000`.
- No git add, no commits, no worktree (design: "current branch, no worktree, no commits"; the user has not asked for commits). Leave changes in the working tree. Artifacts under `.agents/` stay untracked.
- Commands (real ones, from `package.json`): API `npm run typecheck`, `npm test`, `npm run build`. Admin `npm run typecheck`, `npm run build` (no test runner, none is added). When building the admin, clear any leaked `NODE_ENV=development` and set `API_PROXY_TARGET=http://localhost:4010` in the same command (the rewrite is baked at build time).
- MongoDB is STANDALONE: no transactions, no sessions. Use conditional single-document updates and `API/src/utils/compensation.ts` `runUndo`.
- Layering: `routes -> controllers -> services -> models`; models hold `*Lean` types; `views/*.view.ts` are pure; services hold rules and DB access. Zod validators; guards `read` / `write` / `superOnly` already declared in `API/src/routes/admin.routes.ts`; response helpers `ok`, `created`, `done` in `API/src/utils/response.ts`; `HTTP_STATUS` from `API/src/config/constants.ts`; UPPER_SNAKE error codes with Thai messages via `ApiError` (`conflict`, `notFound`, `forbidden`, `validation`, or `new ApiError(HTTP_STATUS.UNPROCESSABLE_ENTITY, code, msg)` like `IMAGE_LIMIT_REACHED`).
- Additive contract: existing responses only gain keys. `API/tests/views/golden.test.ts` (byte comparison against `tests/fixtures/golden-views.json`) must pass unchanged, and `golden-views.json` is never regenerated.
- No new runtime dependencies. No `any` in the admin. Thai copy. Native `<dialog>` `Modal` from `ADMIN/components/ui.tsx` for confirm dialogs, destructive actions always confirm, role hiding is convenience only.
- Temporary files: any smoke script, throwaway mongod data dir and upload dir live outside both repos (for example `C:/Users/in_Su/AppData/Local/Temp/admin-full-smoke/`) and are deleted at the end. `vitest.config.mts` points `UPLOAD_DIR` at `./uploads-unit-test` (not gitignored): any test that writes files must remove them in `afterAll`.

## 1. Binding amendments and how this plan applies them

| # | Amendment | How it is applied |
|---|---|---|
| 1 | Clearing category/theme must not remove keys | `API/src/config/constants.ts` gets `DEFAULT_EVENT_CATEGORY = "road"` and `DEFAULT_EVENT_THEME = "orange"`, used by `event.model.ts` defaults AND by `event.view.ts`, which always emits `category: e.category ?? DEFAULT_EVENT_CATEGORY` and `theme: e.theme ?? DEFAULT_EVENT_THEME` in both `toPublicEventView` and `toAdminEventView`. Decision: on `null` the service `$set`s the default (it does not `$unset`), so the DB stays consistent and the public `category` filter (`filter.category = f.category`) still matches. `registrationEnds` null is `$unset`. A view unit test covers a lean event without the fields. Design D6, D18, the "ไม่ระบุ" fallback wording and "key removed" text are void. In the admin the empty option reads "ใช้ค่าเริ่มต้น (ถนน)" / "ใช้ค่าเริ่มต้น (ส้ม)" and sends `null`. |
| 2 | Do NOT change the dashboard | Gap 9, D3 and the `archivedIds` / `$nin` filter are dropped. `API/src/services/dashboard.service.ts` and `dashboard.view.ts` are not edited. Overview CSV rows come from the unchanged `dashboard.service.get`. See open decision O1. |
| 3 | Shipping search: one always-on pipeline | Exactly the aggregation in FEAT-005 item 25. No limit, no branch, no `distinct`, no `SHIPPING_SEARCH_ID_LIMIT`. See open decision O2 about the real minimum MongoDB version (5.0, not 4.2). |
| 4 | Timeline `paid` entry | `at = order.paidAt`, `detail = transactionRef` of the payment with `status === "approved"` (latest by `reviewedAt`), else `null`. Test with a superseded plus an approved payment. See open decision O3 (the Order model does have `transactionRef`; the plan still follows the amendment). |
| 5 | `address_updated` has `detail: null` | Before/after addresses live only in the audit `meta`, visible only through `GET /audit-logs` (super_admin). |
| 6 | Design typos | Done in `design.md`: section 11 text repaired, D17 moved before D18/D19, admin root stated in the banner. |
| 7 | `mustChangePassword` nudge | Implemented (cheap): constant `MUST_CHANGE_PASSWORD_SHOWN_KEY = "runops-password-nudge-shown"` in `ADMIN/lib/constants.ts`, `sessionStorage` read/written inside `ADMIN/components/admin-shell.tsx` (try/catch like `scope-provider.tsx`), plus a UI hint on the create-user form. |
| 8 | `EMAIL_TAKEN` | Shown as the form-level alert (`formMessage`, `role="alert"`), not a field error. `ADMIN/lib/api/errors.ts` needs no change because `formMessage` returns `error.message` when the 409 has no `fields`. |

## 2. Open decisions and flags (report these in the final summary)

- O1 (amendment 2): after archiving, the dashboard still lists races of archived events and counts their orders; `participants`, `races` and `overview.csv` values are unchanged on purpose. If the product wants archived events excluded, that is a separate, value-changing decision. Not implemented.
- O2: the amendment's pipeline uses `$lookup` with `localField`/`foreignField` AND `pipeline` together (the "concise correlated subquery" form). MongoDB documents that form as available from 5.0, while `$regexMatch` is 4.2+. So the minimum MongoDB version is 5.0. The repo's `docker-compose.yml` uses `mongo:7` and the local binary is 7.0.12; the version of the existing production server is unknown. The README must state "MongoDB 5.0+". If production is older than 5.0, switch the `$lookup` to the `let` + `$expr` form (same result).
- O3: `design-review.md` finding 4 says Order has no `transactionRef`. That is wrong: `API/src/models/order.model.ts` has `transactionRef`, `reviewedBy`, `reviewedAt`, and `review.service.approve` writes it to both Order and Payment. The plan follows amendment 4 (Payment is the source, else `null`). Edge case: if `reviewSlip`'s second write (the Payment update) failed, the Order has the ref but no approved Payment, so the timeline shows `detail: null`. A one-line fallback to `order.transactionRef` would fix that; left out because the amendment says "else null".
- O4: `CANNOT_MODIFY_SELF` (design D19) blocks self-deactivation and self role change, including a super_admin demoting themself. Kept as designed.
- O5: no commits are made (see section 0).

## 3. FEAT overview and order

| FEAT | Scope | Depends on |
|---|---|---|
| FEAT-001 | Events: view defaults, null clears, archive / restore / hard delete, admin events UI | none |
| FEAT-002 | Users: deactivate row action, safe delete, temp-password create, email edit, lastLoginAt, nudge | none (adds OrderNote check in FEAT-004) |
| FEAT-003 | Audit log: API read endpoint + `ประวัติการใช้งาน` page + nav | none |
| FEAT-004 | Orders: notes, timeline, address edit, reviewer name | FEAT-003 (`AuditLogLean`), FEAT-002 (`user.service.remove`) |
| FEAT-005 | Shipping search, overview/shirt CSV, remaining-gap sweep, docs and Postman | FEAT-001..004 |

Each FEAT leaves both repos building. Do them in order; they share `admin.routes.ts`, `constants.ts`, `models/index.ts`, `ADMIN/lib/api/types.ts`.

---

## FEAT-001: Events (view defaults, null clears, archive / restore / delete)

Read first: `design.md` 3.1 and 3.9, amendment 1 above. Roles: delete / archive / restore are `superOnly`. Audit: `event.archive`, `event.restore`, `event.delete` (meta `{ slug }`, delete meta `{ slug, name, raceCount, imageCount }`).

- [ ] 1. Shared defaults and always-emitted keys (amendment 1).
      Add `DEFAULT_EVENT_CATEGORY` / `DEFAULT_EVENT_THEME` (typed as members of `eventCategories` / `eventThemes`) to `API/src/config/constants.ts`; use them in the `default:` of `category` and `theme` in `API/src/models/event.model.ts`; in `API/src/views/event.view.ts` spread `withId(e, ["images"])` first and then set `category`/`theme` with the `??` defaults in BOTH views (assigning an existing key keeps its position, so key order and the golden JSON stay identical). Add `API/tests/views/event.view.test.ts`: a lean event without `category`/`theme` still outputs both keys (public and admin), explicit values pass through, `Object.keys` order of the fixture event is unchanged.
      Files: `API/src/config/constants.ts`, `API/src/models/event.model.ts`, `API/src/views/event.view.ts`, `API/tests/views/event.view.test.ts`
      Verify: `npm test` in `API/` (golden.test.ts unchanged and green, new test green) and `npm run typecheck`.

- [ ] 2. Validators: nullable clears and the `archived` list filter.
      In `API/src/validators/event.validator.ts` make `category`, `theme` `z.enum(...).nullish()`, `registrationEnds` `ymd.nullish()`, `raceBody.start` `z.string().regex(TIME_HHMM, ...).nullish()`; `adminEventsQuery` gains `archived: z.preprocess(v => v === "" ? undefined : v, z.enum(["true","false"]).default("false").transform(v => v === "true"))`. Everything else (name, slug, date, venue, status, races) stays non-null so `null` there gives 422. Add `API/tests/event-validators.test.ts`: null accepted for the four clearable keys, null rejected for name/slug/date/venue/status/races, null `subtitle` still rejected, `archived` values `"true"`, `"false"`, `""`, missing, `"x"`.
      Files: `API/src/validators/event.validator.ts`, `API/tests/event-validators.test.ts`
      Verify: `npm test` and `npm run typecheck` in `API/` (typecheck will flag `EventBody` consumers; fix them in the next items if they fail, or do item 3 first).

- [ ] 3. Pure field helpers.
      New `API/src/services/event/event-fields.ts`: `splitEventFields(body) -> { set, unset }` (drops `races`; `undefined` skipped; `category`/`theme` `null` -> `set[key] = DEFAULT_*`; `registrationEnds` `null` -> `unset.registrationEnds = ""`; the same key is never in both), `createFields(body)` (nulls dropped), `raceCreateFields(r, i, eventId)` (`start` only when a non-empty string), `raceUpdateOps(r, i)` -> `{ set, unset }` (`start` in `set` only when a string, `unset.start = ""` when `null`), `raceRestoreOps(before)` -> `{ set, unset }` (`unset.start` when `before.start === undefined`, closing the existing hole where the inverse `$set` could not remove a just-written start). Add `API/tests/event-fields.test.ts` covering omitted / null / value for each key, `raceCreateFields` with `null`/`undefined`/`"06:00"`, and restore ops.
      Files: `API/src/services/event/event-fields.ts`, `API/tests/event-fields.test.ts`
      Verify: `npm test` in `API/`.

- [ ] 4. Image directory helper.
      Add `deleteEventImageDir(eventId)` to `API/src/utils/slip-file.ts`: validate `EVENT_ID`, resolve `events/<id>` under `eventImagesBase()`, check `path.dirname(full) === base`, `rm(dir, { recursive: true, force: true })`, `console.warn` and never throw. Test in `API/tests/event-images.test.ts` (or a new `API/tests/event-image-dir.test.ts`): create `UPLOAD_DIR/events/<id>/a.jpg`, delete it, assert gone; invalid ids (`"abc"`, `"../slips"`) do not throw and delete nothing; clean up in `afterAll`.
      Files: `API/src/utils/slip-file.ts`, `API/tests/event-images.test.ts` (or new test file)
      Verify: `npm test` in `API/`.

- [ ] 5. Event service: wire helpers, add archive / restore / remove, admin reads.
      `API/src/services/event/event-write.service.ts`: replace `eventFields` with `splitEventFields` / `createFields` / `raceCreateFields` / `raceUpdateOps` / `raceRestoreOps` in `create`, `updateRaces` (new-race branch and the `before` snapshot undo) and `update` (`$set: set` plus `$unset` only when non-empty). Add `archive(actorId, id)`, `restore(actorId, id)` (conditional `updateOne({ _id, archived: false|true })`, `matchedCount === 0` then `exists` -> 404 `EVENT_NOT_FOUND` or idempotent return of `getAdmin`) and `remove(actorId, id)` following `design.md` 3.1 steps 1-9 (order pre-check `Order.exists({ eventId })` before any write -> 409 `EVENT_HAS_ORDERS` "งานนี้มีออเดอร์แล้ว ไม่สามารถลบถาวรได้ ให้เก็บถาวรแทน"; archive; TOCTOU re-check; `Race.exists({ eventId, reserved: { $gt: 0 } })` -> 409 `EVENT_QUOTA_RESERVED`; undo of the flag via `runUndo` label `unarchive event` only if this call changed it; `Race.deleteMany({ eventId, reserved: 0 })`; `EventModel.deleteOne`; `deleteEventImageDir`; `audit`). `API/src/services/event/event-read.service.ts`: `listAdmin` uses `archived: q.archived`; `getAdmin` drops `archived: false`. `API/src/services/event.service.ts` barrel exports `archive`, `restore`, `remove`. `API/src/services/event-image.service.ts` `getImageFile`: the admin variant drops `archived: false` (the public variant keeps it). Do NOT touch `dashboard.service.ts`.
      Files: `API/src/services/event/event-write.service.ts`, `API/src/services/event/event-read.service.ts`, `API/src/services/event.service.ts`, `API/src/services/event-image.service.ts`
      Verify: `npm run typecheck && npm test` in `API/`.

- [ ] 6. Controller and routes.
      `API/src/controllers/admin-event.controller.ts`: `archive`, `restore` (`ok`), `remove` (`done(res, "ลบงานวิ่งแล้ว")`). `API/src/routes/admin.routes.ts`: `POST /events/:id/archive`, `POST /events/:id/restore`, `DELETE /events/:id`, each `superOnly, id`, placed after `PUT /events/:id`.
      Files: `API/src/controllers/admin-event.controller.ts`, `API/src/routes/admin.routes.ts`
      Verify: `npm run typecheck && npm test && npm run build` in `API/` all exit 0.

- [ ] 7. Admin API layer for events.
      `ADMIN/lib/api/types.ts`: `EventBody.category?: EventCategory | null`, `theme?: EventTheme | null`, `registrationEnds?: string | null`, `RaceBody.start?: string | null`. `ADMIN/lib/api/endpoints/events.ts`: `EventFilters.archived?: boolean`; `archiveEvent(id)`, `restoreEvent(id)` (`mutate<AdminEvent>("POST", ...)`), `deleteEvent(id)` (`mutate<null>("DELETE", ...)`); `toEventBody` sends `category: form.category || null`, `theme: form.theme || null`, `registrationEnds: form.registrationEnds || null`, race `start: race.start || null` and the "cannot be cleared" doc comment is replaced.
      Files: `ADMIN/lib/api/types.ts`, `ADMIN/lib/api/endpoints/events.ts`
      Verify: `npm run typecheck` in `c:/Project/running-event-admin`.

- [ ] 8. Admin events page.
      `ADMIN/app/(admin)/events/page.tsx`: remove the three "ตั้งค่าแล้วไม่สามารถล้างได้" hints, `required={Boolean(original?.registrationEnds)}`, `required={Boolean(originalStart)}` on race start and the `disabled` empty options; empty options read "ใช้ค่าเริ่มต้น (ถนน)" / "ใช้ค่าเริ่มต้น (ส้ม)" (labels derived from `categoryLabels`/`themeLabels` and the defaults, mirrored as constants in `ADMIN/lib/constants.ts` with a "keep in sync with the API" comment); add "ล้างวันที่" and "ล้างเวลา" text buttons (keyboard users); add the "การแสดงผล" select (ใช้งานอยู่ / เก็บถาวร, resets page to 1 via `changeFilter`, passes `archived`); archived cards show a "เก็บถาวร" badge and no "จัดการงาน"; super_admin footer buttons: active -> "เก็บถาวร" + "ลบ", archived -> "กู้คืน" + "ลบ". Confirm `Modal`s per `design.md` 3.9 (names the event, danger style, focus on the cancel button, error text shown inside the dialog); on 409 `EVENT_HAS_ORDERS` the delete dialog switches to "งานนี้มีออเดอร์แล้ว ลบถาวรไม่ได้" with primary "เก็บถาวรแทน"; 409 `EVENT_QUOTA_RESERVED` shows its message. After success: toast, `reload()` and `reloadEvents()` from `useScope`. Restore needs no confirm.
      Files: `ADMIN/app/(admin)/events/page.tsx`, `ADMIN/lib/constants.ts`
      Verify: `npm run typecheck` and `npm run build` in `c:/Project/running-event-admin` (with the env guard from section 0).

---

## FEAT-002: Users

Read first: `design.md` 3.2. All `superOnly`. Audit: existing `user.create` / `user.update` (meta gains `email: { from, to }`), new `user.delete` (meta `{ email, name, role }`).

- [ ] 9. Model, validator, auth.
      `API/src/models/user.model.ts`: `mustChangePassword: { type: Boolean, default: false }`. `API/src/validators/user.validator.ts`: `updateUserBody` gains `email: z.string().trim().toLowerCase().email("อีเมลไม่ถูกต้อง").max(200).optional()` (still `.strict()`). `API/src/services/auth.service.ts` `changePassword` sets `user.mustChangePassword = false` before `save()`.
      Files: `API/src/models/user.model.ts`, `API/src/validators/user.validator.ts`, `API/src/services/auth.service.ts`
      Verify: `npm run typecheck` in `API/`.

- [ ] 10. User service rules, controller, route.
      `API/src/services/user.service.ts`: `create` sets `mustChangePassword: true`; `update` adds the self guard (`CANNOT_MODIFY_SELF` 409 when `actorId === id` and (`patch.active === false` or `patch.role` differs from the stored role)), email change (`User.exists({ email, _id: { $ne: id } })` -> 409 `EMAIL_TAKEN`; unique index stays the race-proof guard), sets `mustChangePassword = true` when another admin resets the password (a self reset leaves it), adds `email` and `mustChangePassword` to the `before` snapshot used by the last-super-admin rollback, audit meta gains `email: { from, to }` when changed. New `remove(actorId, id)`: self -> 409 `CANNOT_DELETE_SELF`; missing -> 404 `USER_NOT_FOUND`; active -> 409 `USER_STILL_ACTIVE`; references `AuditLog.exists({ userId })`, `Order.exists({ reviewedBy })`, `Payment.exists({ reviewedBy })` -> 409 `USER_HAS_HISTORY`; `User.deleteOne({ _id, active: false })` with `deletedCount === 0` -> 409 `INVALID_STATE`; audit `user.delete`. Export pure helpers `canHardDelete({ self, active, hasHistory })` and `violatesSelfGuard(actorId, id, user, patch)` for tests. `API/src/controllers/user.controller.ts` `remove` uses `done(res, "ลบผู้ใช้แล้ว")`; `API/src/routes/admin.routes.ts` `DELETE /users/:id` with `superOnly, id`. (The `OrderNote` reference is added to `remove` in FEAT-004 item 21.)
      Files: `API/src/services/user.service.ts`, `API/src/controllers/user.controller.ts`, `API/src/routes/admin.routes.ts`
      Verify: `npm run typecheck && npm run build` in `API/`.

- [ ] 11. User tests.
      `API/tests/user-rules.test.ts`: `updateUserBody` accepts/lowercases email, rejects unknown keys and bad email; `canHardDelete` truth table (self, active, history precedence in the order self -> active -> history); `violatesSelfGuard` (self deactivate, self role change, self rename allowed, other user allowed); `resolveError` maps an E11000 containing `email_unique` to `EMAIL_TAKEN` 409.
      Files: `API/tests/user-rules.test.ts`
      Verify: `npm test` in `API/`.

- [ ] 12. Admin API layer, password helper, auth refresh.
      `ADMIN/lib/api/types.ts`: `User.mustChangePassword?: boolean`, `UserPatchBody.email?: string`. `ADMIN/lib/api/endpoints/users.ts`: `deleteUser(id)` (`mutate<null>("DELETE", ...)`). New `ADMIN/lib/password.ts`: `generateTemporaryPassword(length = 16)` using `crypto.getRandomValues` with rejection sampling over an alphabet without look-alike characters (no `0 O o 1 l I`). `ADMIN/features/admin/auth-provider.tsx`: add `refresh()` (re-run `authApi.me` and `setUser`, no loader flash) to the context. `ADMIN/lib/constants.ts`: `MUST_CHANGE_PASSWORD_SHOWN_KEY` (amendment 7), `TEMP_PASSWORD_LENGTH`.
      Files: `ADMIN/lib/api/types.ts`, `ADMIN/lib/api/endpoints/users.ts`, `ADMIN/lib/password.ts`, `ADMIN/features/admin/auth-provider.tsx`, `ADMIN/lib/constants.ts`
      Verify: `npm run typecheck` in `c:/Project/running-event-admin`.

- [ ] 13. Admin users page and first-login nudge.
      `ADMIN/app/(admin)/users/page.tsx`: header button "เชิญผู้ใช้ใหม่" with the helper text "ระบบไม่ส่งอีเมล ..." from `design.md`; create form gets "สร้างรหัสผ่านชั่วคราว" (fills the field), a show/hide toggle and "คัดลอก" (`navigator.clipboard` in try/catch, toast, visible field is the fallback), plus the hint that the user is nudged to change it; edit form: email editable (remove `readOnly` and "ไม่สามารถแก้ไขอีเมลได้"), sends `email` only when changed from the original, 409 `EMAIL_TAKEN` appears in the form-level alert; for your own row the role and status controls are disabled with a visible hint; row actions "แก้ไข", "ปิดใช้งาน"/"เปิดใช้งาน" (confirm `Modal`, disabled with `aria-describedby` hint for yourself), "ลบถาวร" (only when `!u.active` and not yourself; confirm `Modal` naming the user; `USER_HAS_HISTORY` shows its message and suggests keeping the user inactive); new columns "เข้าสู่ระบบล่าสุด" (`date(u.lastLoginAt, true)` or "–") and a badge "ต้องเปลี่ยนรหัสผ่าน". `ADMIN/components/change-password-modal.tsx`: optional props `notice?: string` and `onChanged?: () => void`. `ADMIN/components/admin-shell.tsx`: effect that, when `user.mustChangePassword` and `sessionStorage[MUST_CHANGE_PASSWORD_SHOWN_KEY]` is unset, sets the key and opens `ChangePasswordModal` with the notice "บัญชีนี้ใช้รหัสผ่านชั่วคราว กรุณาเปลี่ยนรหัสผ่านใหม่" and `onChanged={refresh}`; storage access wrapped in try/catch; dismissible.
      Files: `ADMIN/app/(admin)/users/page.tsx`, `ADMIN/components/change-password-modal.tsx`, `ADMIN/components/admin-shell.tsx`
      Verify: `npm run typecheck` and `npm run build` in `c:/Project/running-event-admin`.

---

## FEAT-003: Audit log (API + page)

Read first: `design.md` 3.6. `superOnly`. Entities in use today: `User`, `Event`, `Order`, `Participant`.

- [ ] 14. Constants, model, validator, view.
      `API/src/config/constants.ts`: `AUDIT_ENTITIES = ["User","Event","Order","Participant"] as const`. `API/src/models/audit-log.model.ts`: add indexes `{ createdAt: -1 }`, `{ userId: 1, createdAt: -1 }`, `{ action: 1, createdAt: -1 }`, export `AuditLogLean` (`InferSchemaType` plus `_id`); export it from `API/src/models/index.ts` if types are re-exported there. `API/src/validators/admin.validator.ts`: `auditLogsQuery = pageQuery.extend({ userId: optObjectId, action: optStr, entity: z.preprocess(emptyToUndef, z.enum(AUDIT_ENTITIES).optional()), entityId: optObjectId, from: optDate, to: optDate })` and its type. New `API/src/views/audit-log.view.ts`: `toAuditLogView(row, actors)` -> `{ id, action, entity, entityId: string | null, meta: Record<string, unknown> | null, actor: { id, name, email } | null, createdAt }`.
      Files: `API/src/config/constants.ts`, `API/src/models/audit-log.model.ts`, `API/src/models/index.ts`, `API/src/validators/admin.validator.ts`, `API/src/views/audit-log.view.ts`
      Verify: `npm run typecheck` in `API/`.

- [ ] 15. Service, controller, route, tests.
      New `API/src/services/audit-log.service.ts` `list(q)` (filter: `userId`, `action` exact, `entity`, `entityId`, `createdAt: bangkokRange(q.from, q.to)`; `find` sorted `{ createdAt: -1, _id: -1 }` with `skipOf`/`limit` and `countDocuments` in parallel; one `User.find({ _id: { $in } }).select("name email")` for actors; `pageMeta`). New `API/src/controllers/audit-log.controller.ts` (`ok(res, data, meta)`). Route `GET /audit-logs` with `superOnly, validate({ query: v.auditLogsQuery })` under a `// --- audit ---` section in `API/src/routes/admin.routes.ts`. Tests `API/tests/audit-log.test.ts`: `auditLogsQuery` defaults and each filter (bad entity, bad ObjectId, bad date), `toAuditLogView` (actor null, meta null, entityId null).
      Files: `API/src/services/audit-log.service.ts`, `API/src/controllers/audit-log.controller.ts`, `API/src/routes/admin.routes.ts`, `API/tests/audit-log.test.ts`
      Verify: `npm run typecheck && npm test && npm run build` in `API/`.

- [ ] 16. Admin API layer.
      `ADMIN/lib/api/types.ts`: `AuditLogEntry`, `AuditLogFilters`, `AuditEntity`. New `ADMIN/lib/api/endpoints/audit-logs.ts` (`getPage<AuditLogEntry>("/audit-logs", filters, signal)`), re-exported as `auditLogsApi` in `ADMIN/lib/api/index.ts`. `ADMIN/lib/constants.ts`: `AUDIT_ENTITIES`. `ADMIN/features/admin/format.ts`: `auditActionLabels` (Thai) covering every action the API writes: grep `audit(` and `"auth.` in `API/src` for the full list (at least `auth.login`, `auth.change_password`, `event.create|update|archive|restore|delete|image.add|image.update|image.reorder|image.delete`, `order.cancel|tracking|approve|reject|note.add|note.delete|address.update`, `participant.patch`, `user.create|update|delete`) and `auditEntityLabels`.
      Files: `ADMIN/lib/api/types.ts`, `ADMIN/lib/api/endpoints/audit-logs.ts`, `ADMIN/lib/api/index.ts`, `ADMIN/lib/constants.ts`, `ADMIN/features/admin/format.ts`
      Verify: `npm run typecheck` in `c:/Project/running-event-admin`.

- [ ] 17. Admin page and navigation.
      New `ADMIN/app/(admin)/audit-logs/page.tsx` titled "ประวัติการใช้งาน": wrapper uses `isSuper` and the same "ไม่มีสิทธิ์เข้าถึง" `EmptyState` as the users page. Filters: actor `<select>` (from `usersApi.listUsers`), action `<select>` (labels + "ทั้งหมด"), entity `<select>`, `from`/`to` date inputs (invalid range message like the reports page), text input "รหัสออเดอร์ / งานวิ่ง" validated as 24 hex before it is sent; every filter change resets page to 1 (`changeFilter` pattern from the orders page). Table: time (`date(..., true)`), actor name/email or "ระบบ", action label, target (`Order` -> `Link` to `/orders?order=<id>`, others entity name + short id), details (`<details>` with formatted JSON `meta` in `<pre>`). `LoadingState`, `ErrorState`, `EmptyState`, `Pager unit="รายการ"`. `ADMIN/components/admin-shell.tsx`: add nav `{ href: "/audit-logs", title: "ประวัติการใช้งาน", icon: History, scope: "global", superOnly: true }`, mark `/users` `superOnly` too, and replace the `item.href !== "/users"` filter with `!item.superOnly || isSuper(user.role)`; help text mentions the audit page. `proxy.ts` needs no change.
      Files: `ADMIN/app/(admin)/audit-logs/page.tsx`, `ADMIN/components/admin-shell.tsx`
      Verify: `npm run typecheck` and `npm run build` in `c:/Project/running-event-admin`.

---

## FEAT-004: Order notes, timeline, address edit, reviewer name

Read first: `design.md` 3.3, 3.4, 3.5 plus amendments 4 and 5. Roles: notes add = `write`, delete = own (reviewer) or any (super_admin) enforced in the service; address edit = `write`. Audit: `order.note.add` (meta `{ noteId }`, never the text), `order.note.delete` (`{ noteId, authorId }`), `order.address.update` (`{ before, after }`), and `order.tracking` now `{ provider, trackingNo }`.

- [ ] 18. Constants, note model, state rule, address helpers.
      `API/src/config/constants.ts`: `ORDER_NOTE_MAX = 1000`, `ORDER_NOTES_MAX_PER_ORDER = 100`. New `API/src/models/order-note.model.ts` (schema from `design.md` 3.3, `OrderNoteLean`, indexes `{ orderId: 1, createdAt: 1 }` and `{ authorId: 1 }`, `cleanJson`), registered and added to `syncAllIndexes` in `API/src/models/index.ts`. `API/src/services/order/order-state.ts`: `ADDRESS_EDITABLE = ["pending","slip_uploaded","rejected","paid"]` and pure `canEditAddress(o)` (`delivery === "shipping" && ADDRESS_EDITABLE.includes(status) && !trackingNo`). `API/src/validators/order.validator.ts`: extract `validateAddress(a)` (same messages and rules) and make `validateDelivery` call it for `method === "shipping"`. New `API/src/services/order/order-address.ts` exporting the trim logic of `addressOf` (`trimAddress`), imported by `order-create.service.ts` (checkout output unchanged).
      Files: `API/src/config/constants.ts`, `API/src/models/order-note.model.ts`, `API/src/models/index.ts`, `API/src/services/order/order-state.ts`, `API/src/validators/order.validator.ts`, `API/src/services/order/order-address.ts`, `API/src/services/order/order-create.service.ts`
      Verify: `npm run typecheck && npm test` in `API/` (existing tests green).

- [ ] 19. Admin validators.
      `API/src/validators/admin.validator.ts`: `noteBody` (`text` trimmed, 1..`ORDER_NOTE_MAX`, `required_error`), `noteParams = z.object({ id: objectId, noteId: objectId })`, `addressBody` (street/subdistrict/district/province/postalCode strings with maxima 300/100/100/100/10 matching `deliveryShape`, `.superRefine` calling `validateAddress` so errors come out as `fields.street` etc.) and inferred types.
      Files: `API/src/validators/admin.validator.ts`
      Verify: `npm run typecheck` in `API/`.

- [ ] 20. Views: note, timeline, extended detail.
      New `API/src/views/order-note.view.ts` (`toOrderNoteView(note, names)` -> `{ id, orderId, text, createdAt, author: { id, name } | null }`). New `API/src/views/order-timeline.view.ts` `toOrderTimelineView({ order, payments, notes, audit, names })` per `design.md` 3.5 with the amendments: `created`; per payment `slip_uploaded` at `payment.createdAt` and, when `status === "rejected" && reviewedAt`, `slip_rejected` (actor = reviewer, detail = `rejectReason`); `paid` at `order.paidAt` with actor `order.reviewedBy` and `detail` = `transactionRef` of the payment whose `status === "approved"` (latest by `reviewedAt`) else `null`; `cancelled` from audit `order.cancel` (detail `meta.reason`) with the legacy fallback (`status === "cancelled"` and no audit row -> `order.updatedAt`, actor null, detail `cancelReason`); `expired` at `expiresAt ?? updatedAt`; `tracking_set` from audit `order.tracking` (detail `provider · trackingNo`, provider only for old rows); `address_updated` from audit `order.address.update` with `detail: null`; `note` per note; no entries for `order.note.*`, `order.approve`, `order.reject`; sort by `at`, kind rank, `id`; stable ids (`created`, `payment:<id>:uploaded`, `payment:<id>:rejected`, `audit:<id>`, `note:<id>`). Export `TIMELINE_AUDIT_ACTIONS`. `API/src/views/order.view.ts`: `toAdminOrderDetailView(order, participants, payments, extras?)`; without `extras` output is byte-identical (golden), with it `reviewedByName`, `canEditAddress`, `notes`, `timeline` are appended after `payments`.
      Files: `API/src/views/order-note.view.ts`, `API/src/views/order-timeline.view.ts`, `API/src/views/order.view.ts`
      Verify: `npm run typecheck && npm test` in `API/` (golden unchanged and green).

- [ ] 21. Services, controllers, routes.
      New `API/src/services/order/order-detail.service.ts` `loadDetailExtras(order, payments)`: `Promise.all` of `OrderNote.find({ orderId }).sort({ createdAt: 1 }).limit(ORDER_NOTES_MAX_PER_ORDER).lean()` and `AuditLog.find({ entity: "Order", entityId: id, action: { $in: TIMELINE_AUDIT_ACTIONS } }).sort({ createdAt: -1 }).limit(200).lean()`, then one `User.find({ _id: { $in } }).select("name")` for reviewer, payment reviewers, note authors and audit actors; failures propagate (no half-built timeline). `API/src/services/order/order-admin.service.ts`: `getAdmin` calls it and passes `extras`; `setTracking` audits `{ provider, trackingNo }`; new `updateAddress(actorId, id, input)` (`findOrderOr404(id, "status delivery trackingNo address")`, `canEditAddress` false -> 409 `INVALID_STATE` with the design message, guarded `Order.updateOne({ _id, delivery: "shipping", status: { $in: [...ADDRESS_EDITABLE] }, trackingNo: null }, { $set: { address } })`, `matchedCount === 0` -> 409, audit `{ before, after }`, return `getAdmin`). New `API/src/services/order/order-notes.service.ts`: `addNote(actor, orderId, text)` (404 `ORDER_NOT_FOUND`; `countDocuments >= cap` -> 422 `NOTE_LIMIT_REACHED` "บันทึกครบ 100 รายการแล้ว"; create; audit; return `getAdmin`) and `removeNote(actor, orderId, noteId)` (404 `NOTE_NOT_FOUND`; non-super deleting a note they do not own -> `ApiError.forbidden("ลบได้เฉพาะบันทึกของตัวเอง")`; `deleteOne({ _id: noteId, orderId })`; audit; return `getAdmin`). `API/src/services/order.service.ts` barrel exports `updateAddress`, `addNote`, `removeNote`. `API/src/controllers/admin-order.controller.ts`: `addNote` (`created`), `removeNote` (`ok`), `address` (`ok`), passing `req.user!` ({ id, role }). Routes in `API/src/routes/admin.routes.ts`: `POST /orders/:id/notes` (write, `validate({ params: objectIdParam, body: v.noteBody })`), `DELETE /orders/:id/notes/:noteId` (write, `validate({ params: v.noteParams })`), `PATCH /orders/:id/address` (write, `validate({ params: objectIdParam, body: v.addressBody })`). Finally add `OrderNote.exists({ authorId: id })` to the `USER_HAS_HISTORY` check in `API/src/services/user.service.ts` `remove`.
      Files: `API/src/services/order/order-detail.service.ts`, `API/src/services/order/order-admin.service.ts`, `API/src/services/order/order-notes.service.ts`, `API/src/services/order.service.ts`, `API/src/controllers/admin-order.controller.ts`, `API/src/routes/admin.routes.ts`, `API/src/services/user.service.ts`
      Verify: `npm run typecheck && npm test && npm run build` in `API/`.

- [ ] 22. API tests for orders.
      `API/tests/views/order-timeline.view.test.ts`: ordering ascending, no duplicates, `created` always present, rejected payment -> `slip_rejected` with reviewer name and reason, order with a SUPERSEDED plus an APPROVED payment -> `paid` entry `at === order.paidAt` and `detail` equals the approved payment's `transactionRef` (and `null` with no approved payment), `address_updated.detail === null` while the audit meta holds addresses, cancel fallback without audit row, `expired`, deleted/unknown users -> `actor: null`, `order.note.add` audit rows produce no entry. Extend `API/tests/views/order.view.test.ts`: detail without extras equals today's keys, with extras appends the four keys after `payments` in order. `API/tests/order-state.test.ts`: `canEditAddress` truth table over all statuses x delivery x trackingNo. `API/tests/validators.test.ts`: `validateAddress` cases, `validateDelivery` regression for pickup and shipping, `noteBody` (0, 1, 1000, 1001 chars, whitespace only), `addressBody` field keys, `noteParams`.
      Files: `API/tests/views/order-timeline.view.test.ts`, `API/tests/views/order.view.test.ts`, `API/tests/order-state.test.ts`, `API/tests/validators.test.ts`, `API/tests/fixtures/view-fixtures.ts` (append-only additions if needed; do not change existing exports)
      Verify: `npm test` in `API/` all green, `golden-views.json` untouched.

- [ ] 23. Admin API layer and format helpers.
      `ADMIN/lib/api/types.ts`: `OrderNote`, `TimelineKind`, `OrderTimelineEntry`, `AddressBody`; `OrderDetail` gains `reviewedByName: string | null`, `canEditAddress: boolean`, `notes: OrderNote[]`, `timeline: OrderTimelineEntry[]`. `ADMIN/lib/api/endpoints/orders.ts`: `addNote(id, text)`, `deleteNote(id, noteId)`, `updateAddress(id, body)`. `ADMIN/lib/constants.ts`: `PROVINCES` (copy of the API list, with the "keep in sync" comment), `ORDER_NOTE_MAX = 1000`. `ADMIN/features/admin/format.ts`: `timelineLabels` (Thai, per `TimelineKind`).
      Files: `ADMIN/lib/api/types.ts`, `ADMIN/lib/api/endpoints/orders.ts`, `ADMIN/lib/constants.ts`, `ADMIN/features/admin/format.ts`
      Verify: `npm run typecheck` in `c:/Project/running-event-admin`.

- [ ] 24. Admin order detail UI.
      New `ADMIN/features/admin/order-notes.tsx` ("บันทึกภายใน": read-only for viewer; list with author, `date(createdAt, true)`, `white-space: pre-wrap`; add form with `maxLength` 1000, live counter, "เพิ่มบันทึก" for `canWrite`; delete with inline two-step "ยืนยันลบ" (same pattern as image delete) when `isSuper(role)` or `note.author?.id === user.id`; own pending state; `reload()` after each call; shows `NOTE_LIMIT_REACHED` message). New `ADMIN/features/admin/order-timeline.tsx` ("ไทม์ไลน์": `<ol>`, icon per kind, label, time, actor, detail). New `ADMIN/features/admin/order-address-form.tsx` (inline form: street, subdistrict, district, province `<select>` from `PROVINCES`, postal code; `fieldErrorsFor`; submit `ordersApi.updateAddress`, toast "บันทึกที่อยู่แล้ว", `reload()`, does not close the modal; 409 shows "ไม่สามารถแก้ไขที่อยู่ได้ในสถานะปัจจุบัน" and reloads). `ADMIN/features/admin/order-detail.tsx`: reviewer line uses `order.reviewedByName ?? order.reviewedBy`; "แก้ไขที่อยู่" button when `order.canEditAddress && canWrite(user.role)`; mount the notes and timeline sections; existing `run()` (closes the modal) stays for cancel / approve / reject only. Add minimal CSS for timeline and notes to `ADMIN/app/globals.css` following the existing variables.
      Files: `ADMIN/features/admin/order-notes.tsx`, `ADMIN/features/admin/order-timeline.tsx`, `ADMIN/features/admin/order-address-form.tsx`, `ADMIN/features/admin/order-detail.tsx`, `ADMIN/app/globals.css`
      Verify: `npm run typecheck` and `npm run build` in `c:/Project/running-event-admin`.

---

## FEAT-005: Shipping search, server CSVs, gap sweep, docs

Read first: `design.md` 3.7 (replaced by amendment 3), 3.8, 3.10. No dashboard change (amendment 2).

- [ ] 25. Shipping query and service (amendment 3).
      `API/src/validators/admin.validator.ts`: `shippingQuery` gains `q: optStr` (so `exportShippingQuery` gets it through `.omit`). `API/src/services/shipping.service.ts`: `filterOf` becomes `async buildFilter(q)` used by `list` and `listForExport`. The base filter is `{ status: "paid", eventId?, delivery? }`. When `q.q` is set, `re = new RegExp(escapeRegex(q.q), "i")` and the order ids come from ONE always-on aggregation, with the base filter's `eventId` converted to `new Types.ObjectId(...)` because aggregation does not cast strings:
      `Participant.aggregate([{ $match: { $or: [ { $expr: { $regexMatch: { input: { $concat: ["$firstName", " ", "$lastName"] }, regex: escapeRegex(q.q), options: "i" } } }, { bibNo: re } ] } }, { $lookup: { from: "orders", localField: "orderId", foreignField: "_id", pipeline: [{ $match: baseFilter }, { $project: { _id: 1 } }], as: "o" } }, { $match: { "o.0": { $exists: true } } }, { $group: { _id: "$orderId" } }])`
      then the order query is `{ ...base, $or: [{ orderNo: re }, { contactName: re }, { contactPhone: re }, { trackingNo: re }, { _id: { $in: ids } }] }` with the existing sort, `skipOf` / `pageMeta` and `EXPORT_LIMIT`. No limit constant, no `distinct`, no branch. Non-paid orders never appear because the base filter is part of the lookup and the final query. Add `API/tests/shipping-search.test.ts`: `shippingQuery.q` (trim, empty -> undefined, > 200 chars rejected), `exportShippingQuery` keeps `q`, and a pure exported helper `shippingSearchPipeline(q, base)` is asserted to equal the exact pipeline above (stage order, `$regexMatch` regex escaped for input like `a.b(c)`, `$lookup` shape).
      Files: `API/src/validators/admin.validator.ts`, `API/src/services/shipping.service.ts`, `API/tests/shipping-search.test.ts`
      Verify: `npm run typecheck && npm test` in `API/`.

- [ ] 26. Overview and shirt-size CSV on the server.
      `API/src/services/export.service.ts`: `overviewCsv(q: DashboardQuery)` (uses the unchanged `dashboard.service.get(q.eventId)`; rows: `["รายการ","จำนวน"]`, `["ที่นั่งที่จอง", participants]`, `["ยอดชำระแล้ว", paidRevenue]`, `["สลิปรอตรวจ", pendingReview]`, then per race `["<eventName> · <raceName> (จอง/โควตา)", "<reserved>/<quota>"]`) and `shirtSizesCsv(q: ShirtSizesQuery)` (uses `report.service.shirtSizeReport`; rows `["ไซซ์เสื้อ","จำนวน"]` plus one row per entry of `sizes`, in `shirtSizes` order, zeros included). `API/src/controllers/export.controller.ts`: `overview`, `shirtSizes` via the existing `sendCsv` (`overview.csv`, `shirt-sizes.csv`). Routes `GET /export/overview.csv` (`read`, `validate({ query: v.dashboardQuery })`) and `GET /export/shirt-sizes.csv` (`read`, `validate({ query: v.shirtSizesQuery })`) in the `// --- CSV export ---` section; the three existing export handlers and routes are not edited. Extract the row builders as pure functions so `API/tests/export-rows.test.ts` can assert the rows and the BOM / quoting through `toCsv` without Mongo.
      Files: `API/src/services/export.service.ts`, `API/src/controllers/export.controller.ts`, `API/src/routes/admin.routes.ts`, `API/tests/export-rows.test.ts`
      Verify: `npm run typecheck && npm test && npm run build` in `API/`.

- [ ] 27. Admin shipping search and CSV buttons.
      `ADMIN/lib/api/endpoints/shipping.ts`: `ShippingFilters` gains `q?: string`. `ADMIN/lib/api/endpoints/exports.ts`: `exportFulfillmentCsv` query type gains `q`; add `exportOverviewCsv({ eventId })` and `exportShirtSizesCsv({ eventId, status })` via `downloadCsv` (`overview.csv`, `shirt-sizes.csv`). `ADMIN/app/(admin)/shipping/page.tsx`: `const q = useDebounced(query.trim())`, pass `q` to `listShipping` and `exportFulfillmentCsv`, add `q` to the `useAsync` deps, reset `page` to 1 in the search `onChange` (and keep the tab-change reset), delete the client `.filter`, placeholder "ค้นหาชื่อ เลขออเดอร์ เบอร์โทร เลขพัสดุ หรือเลข BIB", count `data.meta.total` "ออเดอร์" (no "ในหน้านี้"). `ADMIN/app/(admin)/page.tsx` (`exportOverview`) and `ADMIN/app/(admin)/reports/page.tsx` use the new endpoints with an `exporting` flag and `notify(errorMessage(failure))`; delete `ADMIN/features/admin/client-csv.ts` and its imports.
      Files: `ADMIN/lib/api/endpoints/shipping.ts`, `ADMIN/lib/api/endpoints/exports.ts`, `ADMIN/app/(admin)/shipping/page.tsx`, `ADMIN/app/(admin)/page.tsx`, `ADMIN/app/(admin)/reports/page.tsx`, `ADMIN/features/admin/client-csv.ts` (delete)
      Verify: `npm run typecheck` and `npm run build` in `c:/Project/running-event-admin`; the build fails if any `clientCsv` import remains.

- [ ] 28. Remaining dead / fake / client-only control sweep.
      Re-read every page under `ADMIN/app/(admin)/` (orders, slips, participants, events, users, shipping, reports, dashboard, audit-logs), `ADMIN/components/` and `ADMIN/features/admin/` for controls that are disabled, hidden, TODO / demo text, client-only filtering of a paginated list, or state not backed by a real API call. Already confirmed from code: the five items above plus `reviewedBy` raw id (fixed in item 24) and `lastLoginAt` (fixed in item 13). Needs verification during implementation: `participants/page.tsx` race `<select>` options come from loaded scope events (not a dead control, but confirm it still works with archived events hidden), `slips/page.tsx` actions, `event-images*.tsx` upload / reorder / delete paths, and help-modal text in `admin-shell.tsx`. Wire anything else found, or record it in the FEAT file `findings` with the reason it cannot be wired.
      Files: whichever the sweep touches, listed in FEAT-005 `findings`
      Verify: `npm run typecheck` and `npm run build` in `c:/Project/running-event-admin`; `Select-String` for `ไม่สามารถล้างได้`, `ไม่สามารถแก้ไขอีเมลได้`, `ในหน้านี้`, `clientCsv` under `ADMIN/` returns nothing.

- [ ] 29. Docs and Postman.
      `API/README.md`: endpoint table rows for every new route (archive, restore, delete event; delete user; notes; address; `GET /audit-logs`; the two CSVs; shipping `q`), the 409 / 422 / 403 codes (`EVENT_HAS_ORDERS` on delete, `EVENT_QUOTA_RESERVED`, `USER_HAS_HISTORY`, `USER_STILL_ACTIVE`, `CANNOT_DELETE_SELF`, `CANNOT_MODIFY_SELF`, `NOTE_LIMIT_REACHED`, `NOTE_NOT_FOUND`), the project-structure list for new files, a "MongoDB 5.0+" line (open decision O2), and the contract note that `category`/`theme` are always present. `API/postman/running-event-api.postman_collection.json`: requests for each new endpoint in the matching folders (Admin - Events, Admin - Users, Admin - Orders, Admin - Export CSV, Admin - Shipping) and a new "Admin - Audit logs" folder; do not edit the two environment files; the JSON must still parse. `c:/Project/running-event-admin/README.md`: replace the "Gaps" section with a short "Backed by the API" note and the honest remaining limits, update Roles and Layout (no `client-csv`, new files). `c:/Project/running-event-admin/docs/SYSTEM.md` (Thai): update the feature list and the gap list to match.
      Files: `API/README.md`, `API/postman/running-event-api.postman_collection.json`, `c:/Project/running-event-admin/README.md`, `c:/Project/running-event-admin/docs/SYSTEM.md`
      Verify: `node -e "JSON.parse(require('fs').readFileSync('postman/running-event-api.postman_collection.json','utf8'))"` in `API/` exits 0; `npm run typecheck && npm test && npm run build` in `API/` and `npm run typecheck && npm run build` in the admin all exit 0.

---

## 4. Endpoints added or changed (summary)

| Method, path | Guard | Request | Result | Errors |
|---|---|---|---|---|
| `GET /admin/events` | read | `archived=true\|false` (default false) | list | 422 |
| `GET /admin/events/:id` | read | | returns archived events too | 404 |
| `PUT /admin/events/:id` | superOnly | `null` clears `registrationEnds`, `category`, `theme` (-> defaults), `races[].start`; omitted keys keep values | `AdminEvent` | 404, 409, 422 |
| `POST /admin/events/:id/archive`, `/restore` | superOnly | none | `AdminEvent` | 404, 400 |
| `DELETE /admin/events/:id` | superOnly | none | 200 `data: null` | 404, 409 `EVENT_HAS_ORDERS`, 409 `EVENT_QUOTA_RESERVED` |
| `POST /admin/users` | superOnly | as today | 201, `mustChangePassword: true` | 409 `EMAIL_TAKEN` |
| `PATCH /admin/users/:id` | superOnly | adds `email` | `User` | 409 `EMAIL_TAKEN`, `CANNOT_MODIFY_SELF`, `LAST_SUPER_ADMIN` |
| `DELETE /admin/users/:id` | superOnly | none | 200 `data: null` | 404, 409 `CANNOT_DELETE_SELF`, `USER_STILL_ACTIVE`, `USER_HAS_HISTORY`, `INVALID_STATE` |
| `GET /admin/orders/:id` (+ every mutation returning detail) | read | | adds `reviewedByName`, `canEditAddress`, `notes`, `timeline` | |
| `POST /admin/orders/:id/notes` | write | `{ text }` 1..1000 | 201 `OrderDetail` | 404, 422 `NOTE_LIMIT_REACHED` |
| `DELETE /admin/orders/:id/notes/:noteId` | write | none | `OrderDetail` | 404 `NOTE_NOT_FOUND`, 403 |
| `PATCH /admin/orders/:id/address` | write | 5 address fields | `OrderDetail` | 404, 409 `INVALID_STATE`, 422 |
| `GET /admin/audit-logs` | superOnly | `userId, action, entity, entityId, from, to, page, pageSize` | list + `meta` | 422 |
| `GET /admin/shipping?q=` and `/export/fulfillment.csv?q=` | read | `q` | filtered across all pages | 422 |
| `GET /admin/export/overview.csv`, `/export/shirt-sizes.csv` | read | `eventId`, `status` | CSV with BOM | 422 |

## 5. Live verification (done once by the convergence fixer, iteration 1)

Run against a THROWAWAY standalone `mongod` (7.x binary is installed locally; start it with a temp `--dbpath` on a free port, no `--replSet`) and a built API on a free port such as 4010 with a temp `UPLOAD_DIR`; seed with `npm run seed` using throwaway credentials from env. Driver: a temp node script outside both repos. Assert HTTP status AND `body.statusCode` / `body.success` / error `code`. Cover every acceptance item below that needs a database; delete the script, db dir and uploads afterwards, and never print secrets.

## 6. Acceptance checklist (maps to design 1.6, amended)

1. Hard delete with zero orders: 200, event + races + `UPLOAD_DIR/events/<id>` gone, audit `event.delete`.
2. Any order (any status) -> 409 `EVENT_HAS_ORDERS`, nothing changed (the `archived` flag untouched); reserved quota without order -> 409 `EVENT_QUOTA_RESERVED`.
3. Archive hides from `GET /public/events`, `/public/events/:slug`, `/public/event-images/:id`, and the default admin list; `?archived=true` lists it; restore brings it back; both idempotent; admin thumbnails of archived events still load.
4. Reviewer / viewer get 403 on delete / archive / restore.
5. `PATCH /users/:id` email: lowercased, 409 `EMAIL_TAKEN`, unknown key still 422; 5a self deactivate / self role change -> 409 `CANNOT_MODIFY_SELF`.
6. `DELETE /users/:id`: self / active / history -> 409 with the codes; deactivated and unreferenced -> 200 and gone from `GET /users`.
7. `POST /users` sets `mustChangePassword: true`; `POST /auth/change-password` clears it; `GET /auth/me` returns it.
8. Notes: create 201 (viewer 403, 0 or 1001 chars 422, 101st -> 422 `NOTE_LIMIT_REACHED`); delete: super any, reviewer own only (403), unknown 404 `NOTE_NOT_FOUND`.
9. Address: ok for shipping orders in pending / slip_uploaded / rejected / paid without tracking; 409 `INVALID_STATE` for pickup, cancelled / expired, or with tracking; invalid postal / province -> 422 `fields`; audit has before and after.
10. `GET /orders/:id` has the four new keys and all old keys unchanged; list items unchanged (no `notes`).
11. Timeline ascending, complete, no duplicates, `paid` detail from the approved payment, `address_updated.detail` null.
12. `GET /audit-logs` super_admin only, paginated, newest first, each filter narrows.
13. `PUT` null: `registrationEnds` removed, `category` / `theme` become defaults (keys always present in every response), race `start` removed; omitted keys keep values; null `name` / `slug` / `date` / `venue` / `status` -> 422.
14. `GET /shipping?q=` filters across pages (name "สมชาย ใจดี", BIB, order no, phone, tracking), total in `meta` reflects it, non-paid never appear, CSV honors `q`, UI resets to page 1.
15. `GET /export/overview.csv` and `/export/shirt-sizes.csv`: BOM, same rows the browser produced; dashboard values unchanged; `client-csv.ts` deleted.
16. Admin: none of the old "cannot clear / cannot edit email / in this page" texts remain; every new button calls the API; destructive actions confirm; dialogs keyboard accessible.
17. API `npm run typecheck`, `npm test`, `npm run build`; admin `npm run typecheck`, `npm run build` pass; `git status` in `c:/Project/run-event-platform` shows no change; no commits made.
