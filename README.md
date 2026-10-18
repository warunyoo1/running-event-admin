# Running Event Admin

Next.js admin (installed Next 16.4.1; `proxy.ts` exists since 16.0), React 19, TypeScript strict, plain `fetch`. It talks to the Express/Mongo API in `running-event-api`. More background: `docs/SYSTEM.md`.

## Run against the API

1. Copy `.env.example` to `.env.local` (gitignored, never commit it; do not paste secret values into docs or chat).
2. Set `API_PROXY_TARGET` to the API base URL, with no trailing path (for example `http://localhost:4000`). If unset it falls back to `http://localhost:4000`.
3. `npm install`, then `npm run dev` (or `npm run build` and `npm run start`).

The browser only calls same-origin `/api/v1/admin/...`. `next.config.ts` rewrites `/api/:path*` to `${API_PROXY_TARGET}/api/:path*`, so the auth cookie (`rr_admin_token`, httpOnly, SameSite=Lax) works over plain HTTP. The rewrite is evaluated when Next starts or builds. After changing `API_PROXY_TARGET`, restart `next dev` or rebuild.

Checks: `npm run typecheck` and `npm run build`. There is no lint script and no test framework.

## API server settings

Set these in the API's `.env` (names from `running-event-api/src/config/env.ts`):

| Variable | What to set |
|---|---|
| `CORS_ORIGINS` | Exact browser origin of this admin (scheme, host, port, no trailing slash), for example `http://localhost:3000`. Comma separated for more. It is used for CORS and for the Origin check on POST/PUT/PATCH. Missing it gives 403 on every write, login included. |
| `COOKIE_SECURE` | `false` while the admin is served over plain HTTP. In production the default is `true`, and browsers drop Secure cookies on HTTP, so login looks fine and `/auth/me` then returns 401. Set it back to `true` behind HTTPS. |
| `TRUST_PROXY` | Default `0`. The Next server reaches the API, so every request arrives from the Next server's IP. The login limiter (`LOGIN_RATE_MAX`, default 10 failed attempts per window, keyed on `ip|email`) then locks an email for everyone after 10 failures. Use `TRUST_PROXY=1` only if the API port is firewalled to the Next host. Raise `LOGIN_RATE_MAX` if the lockout hurts. |
| `LOGIN_RATE_MAX` | Failed login attempts allowed per window. |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | At least one super admin must exist. Run the API seed (`npm run seed` in `running-event-api`, or `node dist/seed/seed.js` in the container). Password needs 10+ characters. |

The API port must be reachable from the machine running Next (the rewrite runs server side). Browsers do not need direct access to it.

HTTP warning: with plain HTTP, credentials travel in clear text between Next and the API, and between the browser and Next if the admin is also on HTTP. Use HTTPS for both before production.

## Roles

`super_admin`, `reviewer`, `viewer`. The UI hides actions as a convenience; the API is the authority.

- `viewer`: read and export only.
- `reviewer`: also cancel, approve, reject, tracking, BIB and collected updates.
- `super_admin`: also create/edit events, manage event images and manage users.

## Event images

The events dialog ("ตั้งค่างานวิ่ง") has a "รูปภาพ" section. An event can hold up to 30 images; each has a kind (cover, poster, gallery, route map, shirt, medal, sponsor, other), an optional alt text and a sort order.

- Permissions: only `super_admin` sees the picker and the kind/alt/reorder/delete controls (`isSuper`). Other roles see the thumbnails read-only.
- Upload: keyboard-operable drop zone with multi-file picker. The kind and alt chosen above it apply to the files picked in that batch. Files are sent one per request (`POST /events/:id/images`, `FormData`; `client.ts` leaves `Content-Type` to the browser) so each file reports its own result; progress is "n of N" in a live region.
- Pre-check mirrors the API limits (JPG/PNG/WEBP, 5 MB per file, 10 per batch, 30 per event; `src/lib/constants.ts`, keep in sync with the API `config/constants.ts`). The API still decides by magic bytes.
- Errors map from `ApiError` to Thai text (`imageErrorMessage` in `features/admin/event-images.tsx`): 413 too large, 415 type, 422 `TOO_MANY_FILES` / `IMAGE_LIMIT_REACHED`, 403, 404, 409 (list reloads), 429.
- Thumbnails are plain `<img>` with fixed `width`/`height` and CSS `aspect-ratio`. They load from the same-origin `previewUrl` (`/api/v1/admin/events/:id/images/:imageId/file`) through the `/api` rewrite, so the auth cookie is sent and images of draft events can be previewed. The public `url` (`/api/v1/public/event-images/:id`) is what the public site uses and only works for non-draft events.
- After creating an event the dialog stays open on the new event so images can be added right away.
- Delete asks for an inline confirmation. Reorder uses up/down buttons and calls `PUT /events/:id/images/order`.

## Layout

```
src/proxy.ts                  optimistic guard: no rr_admin_token cookie -> /login?next=...
src/app/(admin)/*/page.tsx    client pages (dashboard, events, orders, slips, participants, shipping, reports, users)
src/app/login/page.tsx        server page, renders components/login-form.tsx
src/components/               shell, shared UI, data states, login and change-password
src/features/admin/           providers (auth, scope, toast), use-async, permissions, format, client-csv, order-detail, event-images
src/lib/constants.ts          API_BASE, cookie name, page size, export limit, labels
src/lib/safe-next.ts          open-redirect-safe `next` handling
src/lib/api/                  types, errors, query, client, endpoints/*
```

Authoritative session check is `AuthProvider` (`GET /auth/me`). A 401 redirects to `/login` once; other errors show a retry state and never redirect.

## Add an endpoint or page

1. Add request/response types to `src/lib/api/types.ts`.
2. Add a function in `src/lib/api/endpoints/<resource>.ts` using `get`, `getPage`, `mutate` or `downloadCsv`. New resource modules are re-exported as `<name>Api` in `src/lib/api/index.ts`. Pages never build URLs.
3. In the page, load with `useAsync((signal) => api.fn(...), deps)`, render `LoadingState`, `ErrorState` and an empty state from `components/data-states.tsx`, and gate writes with `canWrite(user.role)` or `isSuper`.
4. Map `ApiError` with `fieldErrorsFor` and `formMessage`. Disable submit buttons while pending.
5. Add a nav entry in `components/admin-shell.tsx` if it is a new route.

## Gaps

UI with no API endpoint (kept, not invented):
- Overview CSV and shirt-size CSV are generated in the browser from loaded data.
- Shipping search only filters the loaded page.
- Event delete/archive, user delete/invite, user email edit.
- Order notes/timeline, address editing, audit log view.
- Event `registrationEnds`, `category`, `theme` and race `start` cannot be cleared once set. `PUT /events/:id` sets only the provided fields, so omitting them keeps the old value.

API endpoints with no admin UI:
- All `/public/*` routes (public site), `/health`, and `GET /events/:id` (list data is enough).
