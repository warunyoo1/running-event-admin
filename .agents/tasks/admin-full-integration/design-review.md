# Design review: admin full integration

Verdict: CHANGES_REQUESTED (2 HIGH, 3 MEDIUM, 4 NIT)

Reviewed against the original request (event delete/archive, user deactivate/invite/email, order notes/timeline/address, audit endpoint, null-clears, shipping server search, CSV), the additive-contract rule, NO transactions, role gating and self/last-super_admin guards, and layering.

## Findings

1. HIGH. Clearing `category`/`theme` removes keys from existing JSON, which breaks the additive-contract rule (3.1, D6, D18).
   I checked `models/event.model.ts`: `category` defaults to `"road"` and `theme` to `"orange"`, so every event JSON carries both keys today. The design `$unset`s them. Views use `.lean()` (no defaults), so the keys vanish from `GET /public/events*` and admin responses. The design itself says the platform reads them unguarded. "Documenting" this (D18) does not satisfy "new keys only".
   Fix: keep `$unset` in the DB if desired, but make `event.view.ts` emit the same keys always: `category: e.category ?? "road"`, `theme: e.theme ?? "orange"` (reuse the defaults from constants, not literals). Add a view test that a lean event without these fields still outputs both keys. Drop the "key removed" wording from D6/D18 and the "ไม่ระบุ" fallback. Alternative: on `null`, `$set` the default value instead of `$unset`.

2. HIGH. Dashboard change D3/3.1 alters existing response values (3.1 `dashboard.service.ts`, D3, gap 9).
   `toDashboardView` computes `participants` as `sum(races.reserved)` over the same `races` list that the design now filters. Excluding races of archived events changes the existing `participants` value and `races` array while `orders`/`totalOrders` still include those events. That is inconsistent, is not a requested behavior, and bends the "contract unchanged" rule. It also flows into overview.csv ("ที่นั่งที่จอง").
   Fix: remove gap 9/D3 and the archived exclusion (simplest). If kept, compute `participants` from the unfiltered race list and filter only the `races` rows, and state that `races` may now omit archived events as an explicit decision.

3. MEDIUM. Shipping search fallback is unspecified (3.7).
   The above-5000 path is written as `Participant.aggregate([{ $match }, { $lookup: orders, pipeline matching baseFilter }, ...])`. The `...` and the `$lookup` shape are undefined, so two coders would build different things and the path is untestable.
   Fix: give the exact pipeline, e.g.
   `[{ $match: { $or: [nameExpr, { bibNo: re }] } }, { $lookup: { from: "orders", localField: "orderId", foreignField: "_id", pipeline: [{ $match: baseFilter }, { $project: { _id: 1 } }], as: "o" } }, { $match: { "o.0": { $exists: true } } }, { $group: { _id: "$orderId" } }]`
   and say whether it is used only above the limit or always (always is simpler and removes the `distinct("_id")` plus branch). Also state the minimum MongoDB version needed for `$regexMatch` (4.2+).

4. MEDIUM. Timeline `paid` entry sources are wrong/unspecified (3.5).
   Rule says `paid` at `order.paidAt`, `detail = transactionRef`. I checked `models/order.model.ts`: there is no `transactionRef` on Order; it lives on Payment (`status` in submitted/approved/rejected/superseded). The view input has `payments`, but the rule does not say which one.
   Fix: "detail = `transactionRef` of the payment with `status === 'approved'` (latest by `reviewedAt`), else null". Add a test for an order with a superseded plus an approved payment.

5. MEDIUM. Address edit timeline/audit PII exposure is undefined (3.5, 3.6).
   `address_updated` entries appear in the order detail for viewers, but `detail` for that kind is not specified, and the audit `meta` holds before/after addresses.
   Fix: set `detail: null` for `address_updated` (or the fixed Thai text) and state that before/after stays only in `GET /audit-logs`.

6. NIT. Section 11 contains corrupted text ("aceCreateFields", stray backslashes before "regex"/"fallback"), and D18/D19 appear before D17. Fix the typos and order.

7. NIT. Admin file paths omit `src/` (for example `app/(admin)/...`, `features/admin/...`, `lib/...` are really under `src/`). State the root once.

8. NIT. The `mustChangePassword` nudge says "once per session" without a storage mechanism. Specify `sessionStorage` key or React state in `AdminShell`.

9. NIT. 3.2 mixes two instructions for the 409 `EMAIL_TAKEN` display ("add to field mapping ... or show formMessage"). Pick the form-level alert.

## Verified Assumptions

- `AuditLog` has `userId`, `action`, `entity`, `entityId` (string), `meta`, `createdAt` and only the `{entity, entityId, createdAt}` index; `audit()` never throws.
- Existing audit entities are `User`, `Event`, `Order`, `Participant`, so the enum filter is complete; `order.tracking` currently records only `provider` (design change valid).
- `runUndo` exists and never throws; `user.service.update` already has the `LAST_SUPER_ADMIN` check and `before` snapshot (design extends it correctly); `activeSupers` ignores inactive users.
- `updateUserBody` is `.strict()`; `createUserBody` email already trims/lowercases.
- `Order.reviewedBy`, `Payment.reviewedBy/reviewedAt/rejectReason/transactionRef`, `Order.expiresAt/paidAt/trackingNo/cancelReason/address`, `Participant.firstName/lastName/bibNo` all exist.
- `event-read.getAdmin` has `archived: false` and is only used by the admin controller and write service; `event-image.service` filters `archived: false` on the lines the design lists.
- Event update soft-deactivates races, so hard delete's `deleteMany({ reserved: 0 })` after the reserved check covers all races.
- Admin helpers exist: `useDebounced`, `useScope().reloadEvents`, orders page reads `?order=`, `client-csv.ts` is used by the overview and reports pages.
- No transactions are used anywhere in the design; archive-then-delete with conditional updates fits standalone Mongo.
- Role gating (`read`/`write`/`superOnly`), self-modify/self-delete/last-super guards and layering (pure views, services hold rules, models hold Lean types) are consistent across the sections.

## Unverified / Wrong Assumptions

- Wrong: "event JSON keys survive a clear" (finding 1).
- Wrong: dashboard order counts are the only thing unaffected by archived filtering (finding 2); `participants` changes.
- Wrong: Order has `transactionRef` (finding 4).
- Unverified: `$regexMatch` availability on the deployed MongoDB version (finding 3).
- Unverified: the platform tolerance of missing `category`/`theme` (moot once finding 1 is fixed).
