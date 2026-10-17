# Implementation Plan: wire admin to the real API

Repo: `c:\Project\running-event-admin` (current branch, NO worktree, NO commits, no `git add`). API repo `c:\Project\running-event-api` is read-only unless a gap forces a change (none planned).
Source of truth: `.agents/tasks/admin-api-integration-design.md` plus the binding amendments (A1-A7) below, which override it.
Commands: `npm run typecheck`, `npm run build` (no lint script; do not add one). No new dependencies, no test framework.
Installed Next 16.4.1 (package.json has ^16.0.0); `proxy.ts` exists since 16.0. Read `node_modules/next/dist/docs/01-app/**/proxy.md` before writing `src/proxy.ts`.

## Binding amendments (fold-in map)
- A1 Zero-contact verification (Step 14). Never contact `http://14.207.142.107:4000`. No file/script may contain that IP except the existing `.env.example` `API_PROXY_TARGET` value.
- A2 `toEventBody(form)` (Step 8): PUT is `$set` of provided fields, not full replace. Omit `registrationEnds`, `category`, `theme`, race `start` when empty; plain strings (subtitle, description, province, organizer, refundPolicy) sent trimmed, `''` clears; required fields always. UI disables clearing of the four typed optionals once set (and README/Gaps lists it). Verification case in Step 14.
- A3 `safeNext(next)` (Step 2/3): return `/` unless starts with `/`, not `//`, no `\`, `new URL(next, location.origin).origin === location.origin`, and not `/login` (pathname). Inline-assertion check for `//evil.test`, `/\evil.test`, `https://evil.test`, `/orders?x=1`.
- A4 Docs wording: "installed Next 16.4.1; proxy.ts exists since 16.0".
- A5 Dashboard `participants` = sum(race.reserved); UI label "ที่นั่งที่จอง".
- A6 BIB clear sends `bibNo: null`, never `''`.
- A7 Verification includes login with `Origin: http://localhost:3100` -> 200 (local API `CORS_ORIGINS` includes it) and `Origin: http://evil.test` -> 403.

## Target layout
```
src/proxy.ts
src/lib/api/{types.ts,errors.ts,client.ts,query.ts,index.ts}
src/lib/api/endpoints/{auth,events,orders,slips,participants,shipping,reports,users,dashboard,exports}.ts
src/lib/constants.ts            # API_BASE, COOKIE_NAME, SELECTED_EVENT_KEY, PAGE_SIZE, EXPORT_LIMIT, SHIRT_SIZES, labels
src/lib/safe-next.ts
src/features/admin/{auth-provider.tsx,scope-provider.tsx,toast-provider.tsx,use-async.ts,permissions.ts,format.ts(statusLabels/roleLabels/money/date/number)}
src/features/admin/order-detail.tsx   # rewritten on API types
src/components/login-form.tsx, change-password-modal.tsx
```
Delete when unused: `src/lib/api.ts`, `src/features/admin/demo-store.tsx`, demo seed + `exportCsv` + demo types in `data.ts` (keep or rename presentation helpers), demo copy (`demo-card`, `demo-pill`, "พื้นที่สาธิต", footer "ยังไม่เชื่อมต่อ API", help-modal demo text, `/login` "Frontend Preview"), now-unused CSS only if clearly dead.

## Steps

- [ ] 1. API client core. Create `src/lib/constants.ts`, `src/lib/api/types.ts` (Role, OrderStatus, EventStatus incl. `upcoming`, Delivery, PageMeta, Paginated<T>, User, AdminEvent, Race, AdminOrderRow, OrderDetail, Payment, AdminParticipant, SlipRow, ShippingRow, DashboardData, ReportSummary, ShirtSizes, request body types), `errors.ts` (`ApiError(status, code, message, fields)`, `fieldErrorsFor`, `formMessage`), `query.ts` (drops undefined/''/null), `client.ts` (`request`, `get`, `getPage`, `send`, `downloadCsv(path, query, fallbackName)` via shared error core, `setUnauthorizedHandler`, once-only 401 flag resetting on login, exclude `/auth/login`, no redirect on 403/5xx, fetch failure -> `ApiError(0,'NETWORK_ERROR',...)`, non-JSON error -> `HTTP_<status>`, `credentials:'same-origin'`, FormData untouched). No `any`. Then `endpoints/*.ts` exactly per design section 1 (events: `toEventBody` lives in `endpoints/events.ts` or `features/admin/event-form.ts`; participants `bibNo: string|null`). Verify: `npm run typecheck`.

- [ ] 2. Auth, guard, providers, shell. Add `src/lib/safe-next.ts` (A3), `src/proxy.ts` (`export function proxy`, matcher excluding `login`, `api`, `_next/static`, `_next/image`, `favicon.ico`, dotted files; no `rr_admin_token` cookie -> redirect `/login?next=<pathname+search>`; never redirect away from `/login`), `auth-provider.tsx` (GET /auth/me on mount, loading skeleton, 401 -> `router.replace('/login?next=...')` once, other errors -> full-page error with "ลองใหม่"; `logout()`; registers unauthorized handler), `scope-provider.tsx` (events pages of 100 until totalPages; selected id in localStorage key only; reset to `all` if missing), `toast-provider.tsx` (move toast markup from demo-store, `notify`), `use-async.ts` (AbortController, `{data,error,loading,reload}`), `permissions.ts` (`canWrite` super_admin|reviewer, `isSuper`). Rewrite `src/app/layout.tsx` (drop DemoProvider, add ToastProvider), `src/app/(admin)/layout.tsx` (AuthProvider > ScopeProvider > AdminShell), `src/app/login/page.tsx` (server page keeps metadata; `LoginForm` client in `<Suspense fallback={null}>`, uses `useSearchParams`, field errors, 429/401 form-level message, `safeNext`, resets 401 flag after success). `admin-shell.tsx`: real user name/role, logout button (POST /auth/logout then `/login`), change-password modal (`/auth/change-password`, 422 `currentPassword`/`newPassword` field errors, 204), hide `/users` nav for non-super, slip badge from `GET /dashboard?eventId` `pendingReview`, remove demo card/pill/footer text/help text. Verify: `npm run typecheck`; inline `safeNext` assertion script (node via `npx tsx` is NOT available: use a throwaway `node --experimental-strip-types` script or a temp .mjs copy; delete after).

- [ ] 3. Data pages, part A (read + simple actions), each with loading/error/empty states, server pagination (`PAGE_SIZE`), debounced `q`, scope `eventId`, mutation buttons disabled while pending and hidden for `viewer`:
  - `(admin)/page.tsx` dashboard: `/dashboard`; label "ที่นั่งที่จอง" (A5); overview CSV = client-side `clientCsv` from loaded data (D3).
  - `orders/page.tsx` + `features/admin/order-detail.tsx`: `/orders` filters (status, q, from, to) + pagination, detail `/orders/:id`, cancel with reason, display `orderNo`, CSV via `downloadCsv('/export/orders.csv')`.
  - `slips/page.tsx`: `/slips` tab waiting|history, `<img src="/api/v1/admin/payments/{paymentId}/slip">` with `onError` placeholder "ไม่พบไฟล์สลิป", approve with required `transactionRef` input (3..64, `[A-Za-z0-9\-_/.]`), reject with reason, update from returned detail.
  - `participants/page.tsx`: `/participants` filters q/race/status, inline BIB edit (empty -> `null`, A6; 409 `DUPLICATE_BIB`/`INVALID_STATE` messages), CSV `participants.csv`. Replace "only paid" with status select.
  - `shipping/page.tsx`: `/shipping?method`, provider+number tracking inputs (both required), collected toggle via PATCH participant, page-local search labeled, CSV `fulfillment.csv` honoring tab.
  - `reports/page.tsx`: `/reports/summary`, `/reports/shirt-sizes` with status select, all 7 sizes from `SHIRT_SIZES`, empty default date range, report CSV = `orders.csv` same filters, shirt-size CSV client-side. Warn toast when CSV rows >= `EXPORT_LIMIT`.
  Verify: `npm run typecheck && npm run build`.

- [ ] 4. Data pages, part B (super_admin): `events/page.tsx` and `users/page.tsx`.
  - Events: list `/events` (q, status incl. `upcoming`, pagination), create/edit form with added fields (subtitle, description, province, category, theme 6 values, registrationEnds, organizer, refundPolicy, race `start`), race ids from API (remove `crypto.randomUUID`), send existing race `id` on update, `toEventBody` (A2), disable clearing registrationEnds/category/theme/start once set, map `fields` (`races.0.quota`) to inputs, surface `SLUG_TAKEN`/`EVENT_HAS_ORDERS`, refresh scope events after save, hide create/edit for non-super.
  - Users: `ForbiddenState` for non-super; list `/users`, create (password field, 10..200), edit (email read-only, role, active, optional new password), 409 `EMAIL_TAKEN`/`LAST_SUPER_ADMIN`; remove "ไม่มีการส่งคำเชิญจริง".
  Verify: `npm run typecheck && npm run build`.

- [ ] 5. Remove mock layer. Delete `src/lib/api.ts`, `demo-store.tsx`; strip `data.ts` to presentation helpers (rename file `format.ts` if clean); remove all `useDemo` imports. Verify: `npm run typecheck && npm run build`; `Select-String -Path src -Pattern 'useDemo|demo-store|runops-demo|initialState'` (supplementary only) returns nothing; only allowed `localStorage` use is the selected-event id.

- [ ] 6. Docs. `docs/` and a new `README.md` (none exists): run against API (`.env.local` from `.env.example`, `API_PROXY_TARGET`, gitignored/untracked, restart/rebuild after change; never print secret values), module layout, how to add an endpoint/page, roles, gaps list in both directions (design section 2 + A2 inability to clear typed optionals), server env exactly per `running-event-api/src/config/env.ts` (`CORS_ORIGINS` incl. admin origin, `COOKIE_SECURE=false` on plain HTTP, `TRUST_PROXY` default 0 and consequence, `LOGIN_RATE_MAX`, seed super admin), HTTP/HTTPS warning (D7), A4 wording. Update `docs/SYSTEM.md` if it describes demo data. Verify: no committed file contains `14.207.142.107` except `.env.example` (`Select-String -Path . -Pattern '14\.207\.142\.107' -Recurse` excluding node_modules, .next, .env.local, `.agents`).

- [ ] 7. Runtime verification (A1, A7), PowerShell, in this order:
  1. Docker Mongo: `docker run -d --name rr-verify-mongo -p 27019:27017 mongo:7 --replSet rs0 --bind_ip_all`; `rs.initiate`; wait PRIMARY (design section 5.1). Fallback `mongodb-memory-server` replset in an OS temp dir outside both repos; else report live E2E impossible.
  2. Local API env via process env only (random throwaway secrets, `PORT=4010`, `COOKIE_SECURE=false`, `CORS_ORIGINS=http://localhost:3100`, `TRUST_PROXY` unset, `UPLOAD_DIR` temp, `SEED_*`, `SEED_MOCK_USERS=true`); `npm run seed` then `npm run dev` in `running-event-api` (run `npm ci` only if node_modules missing). Start API FIRST, wait for `GET http://localhost:4010/api/v1/health` 200.
  3. Admin build guard (same command): `$t='http://localhost:4010'; $env:API_PROXY_TARGET=$t; if ($t -match '14\.207\.142\.107' -or $env:API_PROXY_TARGET -ne $t) { throw 'bad proxy target' }; npm run build`. Then `Select-String .next\routes-manifest.json -Pattern 'http://localhost:4010/api/:path\*'` must match, and `Get-ChildItem .next -Recurse -File | Select-String '14\.207\.142\.107'` must be empty.
  4. Admin dev, same guard in the same command, `npx next dev -p 3100` (background). Only after the API is up, send requests through `:3100` (curl.exe with cookie jar).
  5. Checks: login 200 with `Origin: http://localhost:3100` (A7); `Origin: http://evil.test` -> 403; wrong password 401 `INVALID_CREDENTIALS`; `/auth/me` with/without cookie (401 handling once); logout; list endpoints (dashboard, events, orders filters/pagination/q, slips both tabs, slip image 200 `image/*`, participants, shipping both methods, reports); event create + PUT omitting `registrationEnds` -> value persists (A2); 422 fields; `SLUG_TAKEN`; approve valid, duplicate ref 409, reject; participant BIB set, `bibNo:null` clears (A6), `DUPLICATE_BIB`; tracking on paid shipping order; three CSV downloads (BOM + header); users create/update/`LAST_SUPER_ADMIN`; reviewer/viewer 403s; page HTML fetched via :3100 for `/login` (200) and `/orders` without cookie (307 to `/login?next=%2Forders`). Browser/screenshot tooling if available, else HTTP only; state which.
  6. `npm run typecheck`, `npm run build` (admin, guard set). API repo untouched -> no API build needed (run `npm run typecheck` there if touched).
  7. Cleanup in `finally`: stop dev servers (by recorded PID), `docker rm -f rr-verify-mongo`, delete temp uploads dir and temp scripts/cookie jars, restore nothing in repos; `git status --short` shows only intended admin changes; `.env.local` unchanged and untracked.

## Gaps (report in docs and final summary)
UI without endpoint: overview CSV and shirt-size CSV (client-generated), shipping search (page-local), event delete/archive, user delete/invite/email edit, order notes/timeline, address editing, audit-log view, clearing registrationEnds/category/theme/race start once set.
Endpoints without UI: all `/public/*`, `/health`, `GET /events/:id` (list data suffices).
API repo changes: none planned.
