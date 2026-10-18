# Admin full integration: final review (iteration 3)

The change wires the admin to real endpoints for events (null clears, archive, restore, hard delete), users (deactivate, safe delete, temp password, email edit, nudge), audit log, order notes, timeline and address edit, shipping search, and server-built CSVs. The earlier MEDIUM (stray empty file under run-event-platform) is fixed: the nested repo status is clean.

Watch for: FEAT-001 API work sits in commit e24b1e0 although the plan said no commits (confirmed); shipping search needs MongoDB 5.0+ (confirmed, documented as O2); admin UI was never run in a browser (confirmed by verification.md).

**Verdict**: APPROVED

## High-level view

Event defaults: `category`/`theme` come from shared constants in `event.view.ts` and the model, a view test exists, nulls `$set` defaults, `registrationEnds`/`start` are unset. Archive/restore/delete are `superOnly`, audited, transaction-free; delete pre-checks orders, archives, re-checks, and undoes the flag on refusal.

Users and orders: self guard, last-super_admin guard, `EMAIL_TAKEN`, `canHardDelete` precedence including OrderNote history, and own-note deletion enforced in the service. Timeline `paid.detail` uses the approved Payment, `address_updated.detail` is null, addresses stay in the audit meta.

Shipping search is one always-on aggregation with `eventId` cast to ObjectId and the base filter inside the `$lookup`. Overview and shirt CSVs reuse the unchanged dashboard service.

## Rule checks (verified by reading code)

- Additive contract: `golden-views.json` and `golden.test.ts` untouched; `toAdminOrderDetailView` output without extras is unchanged; `npm test` 18 files / 195 tests green; typecheck green in both repos.
- No transactions: no `startSession`/`withTransaction` in the changes.
- `dashboard.service.ts`, `dashboard.view.ts` have no diff.
- Role gating: archive/restore/delete event, delete user, audit-logs are `superOnly`; notes, address are `write`; new CSVs `read`.
- `audit()` is called by archive/restore/delete event, user delete/update, note add/delete, address update, tracking.
- Admin: no `any`, no leftover forbidden texts or `clientCsv`, `client-csv.ts` deleted, no package changes, `MUST_CHANGE_PASSWORD_SHOWN_KEY` constant used in try/catch, EMAIL_TAKEN goes through `formMessage` in a `role="alert"` paragraph, audit page gated by `isSuper`, nav uses `superOnly`. run-event-platform is clean.

<details>
<summary>Issues (4)</summary>

1. **Commit despite no-commit plan** (NIT, confirmed) — e24b1e0 holds FEAT-001 API items; tell the user or leave as is.
2. **Soft note cap** (NIT, confirmed) — count then create is not atomic; accepted.
3. **UI not run in a browser** (NIT, confirmed) — do a manual smoke pass.
4. **MongoDB 5.0+** (NIT, confirmed) — shipping `$lookup` form needs 5.0; verify production version.

</details>
