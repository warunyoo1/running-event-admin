# Admin ↔ API integration: design + inventory

Branch: current (`main`), no worktree, no commits. Stack (locked): Next 16.4.1 (App Router), React 19, TypeScript strict, plain `fetch`. No new runtime dependencies. Browser calls same-origin `/api/v1/admin/...`; `next.config.ts` rewrite `/api/:path*` → `${API_PROXY_TARGET}/api/:path*` stays as is (SameSite=Lax cookie works over HTTP). All shapes below were derived from `running-event-api/src` (validators, services, models).

## 0. API facts that drive the design

- Base path `/api/v1/admin`. Success = `{ data }` or `{ data, meta }`; list `meta = { page, pageSize, total, totalPages }`. `204` for logout / change-password. CSV endpoints return `text/csv` (BOM, attachment).
- Error = `{ error: { code, message, fields? } }`; `fields` is `Record<string,string>` with dotted paths (`races.0.quota`). Status: 401 `UNAUTHORIZED` / `INVALID_CREDENTIALS`, 403 `FORBIDDEN`, 404 `*_NOT_FOUND`, 409 conflict codes, 422 `VALIDATION_ERROR`, 429 `RATE_LIMITED` (`{error:{code:"RATE_LIMITED",message}}`; login limiter keys on `ip|email`, counts failed attempts only; shown as a form-level message, never mapped to a field), 5xx `INTERNAL_ERROR`.
- Auth = httpOnly cookie `rr_admin_token` (SameSite=Lax, path `/`, JWT HS256, `JWT_EXPIRES_IN` default 8h). The JS never sees the token. User is reloaded from DB on every request (deactivation/role change is immediate).
- CSRF: mutating requests with an `Origin` header must be in `CORS_ORIGINS` (else 403 `FORBIDDEN`). Through the Next rewrite the browser's Origin (the admin's own origin) is forwarded, so the admin origin MUST be in `CORS_ORIGINS`.
- Roles: `super_admin | reviewer | viewer`. read (GET) = all; write (orders cancel/approve/reject/tracking, participants PATCH) = super_admin, reviewer; super-only = events POST/PUT, users *.
- IDs are Mongo ObjectId strings in `id` (never `_id`). Dates: ISO strings; event `date`/`registrationEnds` are `YYYY-MM-DD`.
- Order state machine: pending→{slip_uploaded,cancelled,expired}; slip_uploaded→{paid,rejected,cancelled}; rejected→{slip_uploaded,cancelled}; paid/cancelled/expired terminal. Cancel allowed from pending/slip_uploaded/rejected. Approve/reject only from `slip_uploaded` (else 409 `INVALID_STATE`). Tracking only if `delivery==="shipping"` AND `status==="paid"`. BIB only settable when order `paid`.

## 1. Per-page inventory

Shared types (put in `src/lib/api/types.ts`): `Role`, `OrderStatus = pending|slip_uploaded|paid|rejected|expired|cancelled`, `EventStatus = draft|open|closed|upcoming`, `Delivery = pickup|shipping`, `Paginated<T> = { data: T[]; meta: PageMeta }`.

### 1.1 Auth: `/login`, route guard, shell
| UI | Endpoint | Request | Response |
|---|---|---|---|
| Login form | `POST /auth/login` | `{ email: string(email, ≤200, lowercased), password: string(1..200) }` | `{data: User}`, sets cookie. 401 `INVALID_CREDENTIALS`; 422 field errors `email`/`password`; 429 rate limit (`LOGIN_RATE_MAX`) |
| Session guard / current user in shell | `GET /auth/me` | – | `{data: User}`; 401 → login |
| Logout (shell button) | `POST /auth/logout` | – | 204, cookie cleared |
| Change password (no UI today; see gaps) | `POST /auth/change-password` | `{ currentPassword, newPassword(10..200) }` | 204; 422 `currentPassword`/`newPassword` |

`User = { id, name, email, role: Role, active: boolean, lastLoginAt?: string, createdAt, updatedAt }` (passwordHash hidden).
Role gating in UI (convenience only, API is the authority): hide `/users` and event create/edit for non-super; hide approve/reject/cancel/tracking/BIB/collected actions for `viewer`.

### 1.2 Event scope selector (shell, `eventId`)
`GET /events?page=1&pageSize=100` (Zod max pageSize=100) to fill the selector; selection kept in React context (+ `localStorage` only for the selected id, not data). Pass `eventId` to every scoped query below. If >100 events exists, page through (loop until `totalPages`). If the stored id is not in the loaded list (archived / DB reset), reset the selection to "all" and remove the key.

### 1.3 `/` Dashboard
`GET /dashboard?eventId=<oid?>` → `{ orders: Record<OrderStatus,number>, totalOrders, pendingReview, paidRevenue, participants, races: [{raceId,eventId,eventName,name,price,quota,reserved,remaining}] }`. Nav badge for slips = `pendingReview`. "Export overview CSV" button has no matching endpoint → see gaps (generate client-side from dashboard data, same as today's `exportCsv`, or drop; decision D3).

### 1.4 `/events` (super_admin write)
- List: `GET /events?page&pageSize(≤100)&q=<name substring>&status=draft|open|closed|upcoming` → `Paginated<AdminEvent>`.
- `AdminEvent = { id, name, slug, subtitle, description, date, venue, province, category: road|trail|fun, theme: orange|green|blue|pink|navy|sand, status, registrationEnds?, organizer, refundPolicy?, archived, createdAt, updatedAt, orderCount, races: Race[] }`, `Race = { id, name, price, quota, start: string|null, remaining }`.
- Detail: `GET /events/:id` (same shape). Create: `POST /events` (201 `{data: AdminEvent}`). Update: `PUT /events/:id` (full replacement body, same schema). No delete/archive endpoint.
- Body (`eventBody`): `name 1..200`, `slug` `/^[a-z0-9]+(-[a-z0-9]+)*$/` ≤120 (lowercased), `subtitle? ≤300`, `description? ≤5000`, `date YYYY-MM-DD (valid calendar date)`, `venue 1..300`, `province? ≤100`, `category?`, `theme?`, `status` (required), `registrationEnds? YYYY-MM-DD`, `organizer? ≤200`, `refundPolicy? ≤2000`, `races[1..10]` of `{ id?, name 1..50, price int ≥0, quota int ≥1, start? HH:mm }`; duplicate race names → `races.<i>.name`.
- Rules the API enforces (surface `fields`/message, do NOT re-implement as authority): slug unique → 409 `SLUG_TAKEN`; once quota-holding orders exist (pending/slip_uploaded/paid/rejected), changing price/quota/name or removing a race → 409 `EVENT_HAS_ORDERS`; quota below reserved → 422 `races.<i>.quota`. On update, send each existing race's `id` so it is matched (else matched by name). Removed races are deactivated, not deleted.
- UI changes: add `upcoming` to status select; add optional fields (subtitle, description, province, category, theme (6 values), registrationEnds, organizer, refundPolicy, race `start`). Client-generated `crypto.randomUUID()` ids are removed; id comes from the API. Existing client-side checks stay only as UX hints.

### 1.5 `/orders` + order detail modal
- List: `GET /orders?page&pageSize(≤100)&eventId&status&q&from&to` (`q` substring on orderNo/contactName/contactPhone; `from`/`to` `YYYY-MM-DD`, Bangkok day range; empty strings ignored). Sorted createdAt desc. Server pagination replaces client filtering; debounce `q`.
- `AdminOrderRow = { id, orderNo, eventId, eventName, eventSlug, participantCount, contactName, contactPhone, contactEmail?, delivery, address?: {street,subdistrict,district,province,postalCode}, subtotal, shippingFee, amount, status, expiresAt?, trackingProvider?, trackingNo?, cancelReason?, rejectionReason?, reviewedAt?, reviewedBy?, transactionRef?, paidAt?, slipUploadedAt?, createdAt, updatedAt }`.
- Detail: `GET /orders/:id` → `AdminOrderRow & { participants: AdminParticipant[]; payments: Payment[] }`. `Payment = { id, orderId, slipMime, amount, status: submitted|approved|rejected|superseded, transactionRef?, rejectReason?, reviewedBy?, reviewedAt?, createdAt, updatedAt }` (slipPath hidden).
- Cancel: `POST /orders/:id/cancel` body `{ reason?: string ≤500 }` → `{data: detail}`; 409 `INVALID_STATE`. Releases quota exactly once.
- Export: see 1.9.
- Display `orderNo` (not `id`) as the human order number.

### 1.6 `/slips` + review modal
- List: `GET /slips?page&pageSize&eventId&tab=waiting|history` → `{data: SlipRow[], meta}`; `SlipRow = { orderId, orderNo, eventName, contactName, amount, status, slipUploadedAt?, reviewedAt?, rejectionReason?, transactionRef?, paymentId: string|null }`. waiting = `slip_uploaded` oldest first; history = paid/rejected newest first.
- Slip image: `GET /payments/:paymentId/slip` (image/jpeg|png|webp, `Cache-Control: no-store`, cookie-authenticated). Render with `<img src="/api/v1/admin/payments/{paymentId}/slip">` (same-origin cookie is sent automatically; no fetch/blob needed). Error → 404 `SLIP_NOT_FOUND` → show "ไม่พบไฟล์สลิป" placeholder via `onError`. `paymentId` comes from `SlipRow.paymentId` returned by `GET /slips`; only when the modal is opened from the orders page, fall back to `payments[0]` of order detail (sorted `createdAt` desc).
- Approve: `POST /orders/:id/approve` body `{ transactionRef: string 3..64, /^[A-Za-z0-9\-_/.]+$/ }` (API upper-cases it) → `{data: detail}`; 409 `INVALID_STATE`, 409 `DUPLICATE_TRANSACTION_REF`; 422 `transactionRef`. The review modal needs a new input for the bank reference (the demo used a static `reference`).
- Reject: `POST /orders/:id/reject` body `{ reason: string 1..500 }`; 422 `reason`; 409 `INVALID_STATE`.

### 1.7 `/participants`
- List: `GET /participants?page&pageSize&eventId&q&race&status` (`q` matches first/last name, bibNo, orderNo; `race` = exact race name; `status` = order status). Server pagination.
- `AdminParticipant = { id, orderId, eventId, raceId, raceName, price, firstName, lastName, gender, birthDate, nationality, declineIdentity, idNumber (masked, "" if declined), email?, phone, medical?, blood?, emergencyName?, emergencyRelation?, emergencyPhone?, province, team?, applicantType, size, bibNo?, collected, collectedAt?, createdAt, updatedAt }` plus list-only `orderNo`, `orderStatus`.
- Update: `PATCH /participants/:id` body strict `{ collected?: boolean, bibNo?: string(1..20)|null }` (unknown keys → 422) → `AdminParticipant+orderNo+orderStatus`; 409 `DUPLICATE_BIB` (per event), 409 `INVALID_STATE` (BIB only on paid order), 404 `PARTICIPANT_NOT_FOUND`. The UI today shows BIB read-only; adding inline BIB edit + collected toggle is in scope only on the shipping page (collected) and participants page (BIB), because the API supports it (decision D4).
- "Only paid" checkbox → `status=paid`. The demo hid expired/cancelled; the API has no "exclude" filter, so default filter = none; offer a status select instead.

### 1.8 `/shipping` (pickup + shipping tabs)
- List: `GET /shipping?page&pageSize&eventId&method=pickup|shipping` → paid orders only, oldest paid first: `{ orderId, orderNo, eventId, contactName, contactPhone, delivery, address: Address|null, trackingProvider: string|null, trackingNo: string|null, participants: [{id,name,race,size,bibNo,collected}], allCollected }`. Tabs map to `method`. Search box: API has no `q` on this endpoint → client-side filter of the current page only, or hide it (decision D5; default: client-side on loaded page, labeled).
- Tracking: `PATCH /orders/:id/tracking` body `{ trackingProvider: string 1..100, trackingNo: string 1..100 }` (both required; the UI currently only has one field → add provider input). 409 `INVALID_STATE` if not shipping/paid.
- Mark collected: `PATCH /participants/:id` `{ collected: boolean }` (see 1.7).

### 1.9 CSV exports (all pages' "ส่งออก" buttons)
- `GET /export/orders.csv?eventId&status&q&from&to` (no paging)
- `GET /export/participants.csv?eventId&q&race&status`
- `GET /export/fulfillment.csv?eventId&method`
- Max 50,000 rows (`EXPORT_LIMIT`, silent truncation: toast a warning when the CSV has ≥50,000 data rows). Implement as `downloadCsv(path, query, fallbackName)` in the client sharing the `request` core: on `!res.ok` the JSON error body is parsed into `ApiError` (incl. the 401 → `onUnauthorized` path) and thrown, surfaced by toast; only a 2xx response becomes a blob → anchor download (filename from `Content-Disposition`, fallback given). Error JSON is never saved as a file. The old client `exportCsv` and its `-demo.csv` names are removed. Orders page → orders.csv; participants page → participants.csv; shipping page → fulfillment.csv (honors current tab via `method`).

### 1.10 `/reports`
- `GET /reports/summary?eventId&from&to` → `{ totals: {orders, paidOrders, paidRevenue}, rows: [{eventId,eventName,race,participants,paidParticipants,revenue}] }` (totals/rows count quota-holding statuses incl. rejected; revenue from paid).
- `GET /reports/shirt-sizes?eventId&status=<OrderStatus default paid>` → `{ status, sizes: [{size,count}] (XS,S,M,L,XL,2XL,3XL), total, byRace: [{race, sizes: Record<size,number>}] }`. UI must show all 7 sizes (demo showed 4).
- Report CSV button: no dedicated endpoint; use `orders.csv` with same `eventId/from/to` for the "report" export, and a client-generated CSV for shirt sizes (D3).
- Default date range: empty (no hard-coded 2026-10 range).

### 1.11 `/users` (super_admin only)
- List: `GET /users` → `{data: User[]}` (no pagination, no query).
- Create: `POST /users` `{ name 1..100, email, password 10..200, role }` → 201 `User`; 409 `EMAIL_TAKEN`; 422 fields. UI needs a password field on create.
- Update: `PATCH /users/:id` strict `{ name?, role?, active?, password?(10..200) }` → `User`; 409 `LAST_SUPER_ADMIN`; 404 `USER_NOT_FOUND`. Email is NOT editable (not in schema): make email read-only when editing. Optional "reset password" field maps to `password`.
- Delete: none (deactivate via `active:false`).
- Remove the demo toast "ไม่มีการส่งคำเชิญจริง"; there is no invitation flow.

## 2. Gaps

UI with NO API endpoint (keep UI, report; do not invent endpoints):
- Overview "export CSV" (dashboard) → no endpoint; client-side CSV from dashboard data or remove (D3).
- Shirt-size / report CSV exports → no dedicated endpoint (reports use `orders.csv`; shirt sizes client-side).
- Shipping search (name/BIB/order/tracking) → no `q` on `/shipping`; page-local filter.
- Event "delete/archive", user "delete", user "invite", edit user email → not supported.
- Order notes/timeline, shipping address editing, audit-log viewing → not in API (audit is write-only server side).
- Participants "exclude expired/cancelled by default" → emulate with status filter.

API endpoints with NO admin UI (candidates; only 3 are cheap):
- `POST /auth/change-password` → add small "เปลี่ยนรหัสผ่าน" modal in the shell user menu (recommended, in scope).
- `GET /events/:id` → optionally used to open `/events?event=<id>` deep link (otherwise list data suffices).
- `GET /reports/shirt-sizes` `status` param → expose as a select on the reports page (cheap).
- All `/public/*` routes (event listing, create order, order lookup, slip upload) → belong to the public site, intentionally not in admin.
- `GET /health`, `/api/v1/health` → not UI; used by the verification script.

## 3. API client layer (`src/lib/api/`)

Existing `src/lib/api.ts` (untracked, partial) is replaced by this folder; delete it after migrating imports.

Files:
- `types.ts`: all response/request types above, exported; no `any`, unknown JSON narrowed through typed parsers (`isApiErrorBody`).
- `client.ts`:
  - `request<T>(method, path, { query?, body?, signal? })`: URL = `/api/v1/admin${path}` (a `/api/v1/public` base is not needed); `credentials: "same-origin"`; JSON body with `Content-Type: application/json`; query builder drops `undefined`/`""`/`null`. Multipart is NOT needed in admin (slip upload is public-only); `request` leaves `FormData` bodies untouched without setting `Content-Type`, so it stays future-proof.
  - Success: `204` → `undefined`; else parse JSON, return `{ data, meta? }` via two helpers `get<T>()` (data) and `getPage<T>()` (data+meta).
  - `downloadCsv(path, query, fallbackName)` as in 1.9.
  - Network failure (fetch throws, not Abort) → `ApiError(0, "NETWORK_ERROR", "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้")`. Non-JSON error body → `ApiError(status, "HTTP_<status>", statusText)`.
  - 401 handling: on any response 401 except from `/auth/login`, call a registered `onUnauthorized` handler (module-level, set by the auth provider) that clears the user and `router.replace("/login?next=<path>")`; still throws the `ApiError`. It fires at most once until the next successful login (module flag reset by `AuthProvider` after login) so parallel 401s cause a single redirect. 403 and all other statuses are NOT redirects (show message).
- `errors.ts`: `class ApiError extends Error { status: number; code: string; fields: Record<string,string> }`; `fieldErrorsFor(err, map?)` returns a `Record<formField, message>` with dotted API paths kept as-is (`races.0.quota`) so forms look up `errors["races.0.quota"]`; `formMessage(err)` returns a top-level message when there are no mapped fields (409/403/404/5xx). Thai messages come from the API; client-only fallbacks are Thai.
- `endpoints/` one module per resource, each function typed: `auth.ts`, `events.ts`, `orders.ts`, `slips.ts`, `participants.ts`, `shipping.ts`, `reports.ts`, `users.ts`, `dashboard.ts`, `exports.ts`. Pages never build URLs.
- `src/features/admin/` replaces `demo-store.tsx`/`data.ts`: `auth-provider.tsx` (current user, `refresh`, `logout`), `scope-provider.tsx` (events list for selector, selected `eventId`), `use-async.ts` (small `useAsync(fn, deps)` hook returning `{data,error,loading,reload}` with AbortController; no SWR/React Query dependency), `toast` stays (notify) as a separate tiny provider. `data.ts` keeps only presentation helpers (`statusLabels`, `roleLabels`, `money`, `date`, `number`) and drops demo seed data and `exportCsv`.
- Mutations: after success, update local state from the returned object (orders/participants/events return the fresh record) or `reload()`; disable the submit button while pending; show `ApiError` message in the existing form `error` slot and map `fields` to inputs with `aria-invalid` + message.
- Logging: no console logging of request bodies (passwords); errors are surfaced in UI only.

## 4. Auth guard (Next 16.4.1)

Per `node_modules/next/dist/docs` (`proxy.md`, `authentication.md`): `middleware` is deprecated and renamed to `proxy.ts`; docs recommend proxy only for optimistic checks and verifying close to data. Decision: two layers.
1. `src/proxy.ts` (optimistic, cookie presence only): `export function proxy(request: NextRequest)` and `export const config = { matcher: ['/((?!login$|login/|api|_next/static|_next/image|favicon.ico|.*\\..*).*)'] }`; if cookie `rr_admin_token` is absent → redirect to `/login?next=<pathname + search>` (URL-encoded); if present and path is `/login` → leave (do not redirect, the cookie may be expired; avoids a loop). It cannot validate the JWT (secret is server-side API only) and must not.
2. Authoritative guard in `src/app/(admin)/layout.tsx` → `AuthProvider` (client) calls `GET /auth/me` on mount; shows a loading skeleton, renders children when ok; 401 → `router.replace('/login?next=...')`. Any other error (network `status 0`, 5xx, 429) → full-page error state with the `ApiError` message and a "ลองใหม่" button calling `refresh()`; NEVER redirect on non-401 (an API outage must not look like a logout). Role-gated pages (`/users`) additionally check `user.role` and render a "ไม่มีสิทธิ์" empty state (API still returns 403).
Rationale: the cookie is set by a different backend (not readable for verification in Next), so a server component `me` check would need forwarding cookies to the API from Next's server; the client check through the same-origin rewrite is simpler and exactly what the browser sends. Login page: on success `router.replace(next ?? "/")` where `next` must start with a single `/` (not `//`, no scheme; open-redirect guard, checked in the login handler only). The login page stays a server page (keeps `metadata`) rendering a client `LoginForm` that uses `useSearchParams()` wrapped in `<Suspense fallback={null}>` (required for `next build`). Remove "Frontend Preview" copy and `DemoProvider` from root layout.

## 5. Runtime verification plan (never touch http://14.207.142.107:4000)

Docker 26.1.4 is available and the daemon answers.
1. Throwaway Mongo replica set: `docker run -d --name rr-verify-mongo -p 27019:27017 mongo:7 --replSet rs0 --bind_ip_all`, then `docker exec rr-verify-mongo mongosh --eval "rs.initiate({_id:'rs0',members:[{_id:0,host:'localhost:27017'}]})"` (host `localhost:27017` inside the container; works from the host through the published port with `directConnection=true`). Then wait for PRIMARY before seeding (transactions need it): `docker exec rr-verify-mongo mongosh --quiet --eval "while(!rs.status().members||rs.status().members[0].state!==1){sleep(500)}"`.
2. Env passed on the command line only (no `.env` written in the API repo; `running-event-api/.env` does not exist): `NODE_ENV=development PORT=4010 UPLOAD_DIR=<os temp>/rr-verify-uploads MONGODB_URI="mongodb://localhost:27019/rr_verify?directConnection=true" JWT_SECRET=<random 48 chars generated at run> ID_ENCRYPTION_KEY=<random base64 32 bytes> COOKIE_SECURE=false CORS_ORIGINS=http://localhost:3100 BCRYPT_COST=4 SEED_ADMIN_EMAIL=verify-admin@example.test SEED_ADMIN_PASSWORD=<random generated at run> SEED_MOCK_USERS=true SEED_MOCK_USER_PASSWORD=<random>`; run `npm run seed` then `npm run dev` in `running-event-api` (install deps there only if `node_modules` is missing; this is a tool-only action, no package.json change). Throwaway credentials only, discarded after.
3. Admin: `.env.local` already exists and likely points at the deployed host; it is NOT edited. Start Next with the override in the SAME command every time (also on restarts and `next build && next start`): PowerShell `$env:API_PROXY_TARGET='http://localhost:4010'; npx next dev -p 3100`. Rewrites are baked at build time, so rebuild with the variable set too.
   **Mandatory non-mutating pre-flight (ordering matters, no POST until it passes):**
   1. Start Next with `API_PROXY_TARGET=http://localhost:4010` while the local API is still STOPPED.
   2. `GET http://localhost:3100/api/v1/health` MUST fail (proxy error / 500 / 502 / connection refused). A 200 means the rewrite points at the deployed host (health returns only `{data:{status:"ok"}}` on both, so it cannot be compared): STOP, make no further calls, fix the env, restart Next.
   3. Only then start the local API, confirm `GET :3100/api/v1/health` is 200, and only after that run the login POST with the throwaway admin.
   Every POST/PUT/PATCH goes only to `localhost:3100` or `localhost:4010`; no script contains `14.207.142.107`.
4. Checks (curl through `http://localhost:3100/api/v1/...` for the cookie/rewrite path, then browser-level smoke if a headless tool exists; otherwise scripted fetch with cookie jar):
   - login ok / wrong password 401 `INVALID_CREDENTIALS`; `me` with and without cookie; logout clears; POST with `Origin: http://evil.test` → 403.
   - events create/update (422 fields, `SLUG_TAKEN`, `EVENT_HAS_ORDERS` after seed orders), orders list filters+pagination+`q`, detail, cancel, approve (valid + duplicate ref), reject, slip image 200 `image/*`, tracking (paid shipping order; 409 otherwise), participants patch (collected, BIB, `DUPLICATE_BIB`), shipping tabs, dashboard, reports, 3 CSV downloads (BOM + header row), users create/update/last-super-admin 409, role checks: seed (`SEED_MOCK_USERS=true`, `seed-data.ts`) creates `admin@example.com` (super_admin), `reviewer@example.com`, `viewer@example.com`, all with `SEED_MOCK_USER_PASSWORD`. Reviewer and viewer must get 403 on `/users` and events POST; viewer also 403 on order writes (cancel/approve/reject/tracking) and participants PATCH.
   - `npm run typecheck` and `npm run build` in admin (no lint script exists; do not add one). Check `grep` for leftover `useDemo|demo-store|localStorage` data usage.
5. Cleanup: `docker rm -f rr-verify-mongo`; stop dev servers; delete `<os temp>/rr-verify-uploads` (seed writes placeholder slip PNGs there; the slip-image 200 check depends on them); no files left in repos besides intended changes.
Fallback order if docker fails mid-run: `mongodb-memory-server` with `MongoMemoryReplSet` installed in a temp dir outside both repos (not in any package.json); else report live e2e impossible and list the unverified items.

## 6. Server `.env` lines the user must set

Admin host (`running-event-admin/.env.local`, gitignored; restart/rebuild Next after changing, rewrites are evaluated at build/start):
```
API_PROXY_TARGET=http://14.207.142.107:4000
```
API server (`running-event-api/.env`). Name sources: `CORS_ORIGINS`, `COOKIE_SECURE`, `TRUST_PROXY`, `LOGIN_RATE_MAX` in `src/config/env.ts`; `API_HOST_PORT` in `docker-compose.yml`; `SEED_*` in `src/seed/seed.ts`/`.env.example`:
```
CORS_ORIGINS=http://<admin-host>:<admin-port>[,other origins]
COOKIE_SECURE=false
```
- `CORS_ORIGINS` must include the exact browser origin of the admin app (scheme+host+port, no trailing slash), e.g. `http://localhost:3000` for local dev or `http://<admin-server-ip>:3000` once deployed; it is used for both CORS and the Origin check on POST/PUT/PATCH (missing it → 403 "origin ไม่ได้รับอนุญาต" on every write; login included).
- `COOKIE_SECURE=false` is required: `docker-compose.yml` runs the API with `NODE_ENV=production`, which defaults `cookieSecure` to true, and browsers drop Secure cookies on plain HTTP so login would appear to succeed then `me` would 401. Switch back to `true` once the admin is served via HTTPS.
- `TRUST_PROXY=0` (default; decision). The API is reachable directly on :4000, so trusting `X-Forwarded-For` would let anyone bypass the limiter by spoofing it. Whether Next's rewrite forwards `X-Forwarded-For` was not verified. Consequence: every request reaches the API from the Next server's IP, so the login limiter (`ip|email`, failed attempts only, `LOGIN_RATE_MAX` default 10 per 15 min) effectively locks an admin email for all users after 10 failures. Set `TRUST_PROXY=1` only if :4000 is firewalled to the Next host (D6).
- A super admin must exist: `docker compose run --rm api node dist/seed/seed.js` with `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` (≥10 chars) set in the API `.env`.
- Network: port 4000 must be reachable from the machine running Next (server-side rewrite), not necessarily from browsers; `docker-compose.yml` binds `127.0.0.1:4000` only, so if Next runs on a different host than the API, the published port must be opened (`API_HOST_PORT` / port mapping), The user states `14.207.142.107:4000` is reachable, which implies a deployment different from this compose file; external reachability is NOT verified here.

## 7. Open decisions (defaults chosen; override if wrong)

- D1: no new dependencies (own `useAsync`, native fetch). Default: yes.
- D2: auth guard = `proxy.ts` cookie-presence check + client `me` guard. Default: as §4.
- D3: CSVs without API (overview, shirt sizes) are generated client-side from loaded data (keeps the existing safe `exportCsv` logic, renamed `clientCsv`, dropping `-demo` in names) rather than removed.
- D4 (final): BIB edit, collected toggle and the change-password modal are in scope (user asked for complete integration).
- D5: shipping search is page-local.
- D6: `TRUST_PROXY=0`; login lockout is per email across all users (see §6); raise `LOGIN_RATE_MAX` if it hurts; `TRUST_PROXY=1` only when :4000 is firewalled to the Next host.
- D7: HTTP (non-TLS) deployment exposes admin credentials in clear text between Next server and API (and browser↔Next if the admin is also plain HTTP); recommend HTTPS for both before production use. Flagged, not changed.
- D8: order number shown is `orderNo`; mongo `id` only used in URLs/keys.

## 8. Responses to design review (design-review.md)

Round 2 (4 findings, all addressed): 1 (MEDIUM) §5 step 3 now a non-mutating pre-flight: Next started against stopped local API, `GET /health` must fail, then start API, then login POST. 2 §5 step 1 PRIMARY wait loop. 3 §5 step 4 mock user logins and expected 403s. 4 §4 matcher `login$|login/`.

Round 1:

All 11 findings addressed in place; none backlogged or ignored.
- 1 (MEDIUM) fixed: §0 429 `RATE_LIMITED` + limiter semantics; §6 `TRUST_PROXY=0` decision with spoofing reasoning; D6 reworded.
- 2 (MEDIUM) fixed: §4 non-401 `/auth/me` error page with retry, no redirect; §3 `onUnauthorized` once-per-login flag.
- 3 (MEDIUM) fixed: §1.9 `downloadCsv` shares the `request` error core; 50,000-row warning.
- 4 (MEDIUM) fixed: §5 step 3 mandatory pre-flight (login with throwaway admin must be 200, else stop); no script contains the deployed IP.
- 5 fixed: `UPLOAD_DIR` in env list and cleanup. 6 fixed: Suspense/server page for login. 7 fixed: `proxy` export + matcher + `next` = pathname+search. 8 fixed: `SlipRow.paymentId` primary. 9 fixed: stale event id reset. 10 fixed: per-name sources, reachability marked unverified. 11 fixed: D4 final.
