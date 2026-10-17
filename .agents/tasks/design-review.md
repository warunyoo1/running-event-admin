# Design review: admin-api-integration-design.md (round 3)

Verdict: CHANGES_REQUESTED (3 MEDIUM, 0 HIGH, 4 NIT)

I read the design against `running-event-api/src` (routes, validators, services, middlewares, `config/env.ts`, `constants.ts`, `utils/csv.ts`), `running-event-admin/package.json`, `next.config.ts`, the installed Next 16.4.1 `proxy.md` docs, and the current admin source tree.

## Findings

1. MEDIUM. Section 5 step 3, the pre-flight can contact the deployed host.
   - The check sends `GET :3100/api/v1/health` while the local API is stopped and treats a 200 as "misconfigured". In exactly that failure case the request goes to `http://14.207.142.107:4000`. Your requirement (g) says the verification never touches the deployed host.
   - The check is also unnecessary. `next.config.ts` reads only `process.env.API_PROXY_TARGET`, and a process env var wins over `.env.local`, so the target can be asserted without any network call.
   - Fix: replace steps 3.1 to 3.3 with a zero-contact guard.
     - In the same PowerShell command, before starting Next: `$t='http://localhost:4010'; if ($t -match '14\.207\.142\.107' -or $env:API_PROXY_TARGET -ne $t) { throw 'bad proxy target' }`, then `$env:API_PROXY_TARGET=$t; npx next dev -p 3100`.
     - After `next build`, grep `.next/routes-manifest.json` for the rewrite destination and require `http://localhost:4010/api/:path*`, with no `14.207.142.107` anywhere under `.next`.
     - Start the local API first and only then send any request through `:3100`.
     - Keep the rule that no script contains the deployed IP.

2. MEDIUM. Section 1.4 says `PUT /events/:id` is a "full replacement". That is wrong, and the payload serialization rules are missing.
   - `event.service.update` runs `EventModel.updateOne({_id}, {$set: eventFields(body)})`. Omitted optional fields are not cleared. Race `start` is also set from an optional value.
   - The validators reject empty strings for the typed optionals: `registrationEnds: ""` fails the YYYY-MM-DD check, `category: ""` and `theme: ""` fail the enum, and `start: ""` fails `TIME_HHMM`. Only plain-string fields (subtitle, description, province, organizer, refundPolicy) accept `""`.
   - As written, the edit form will either 422 on untouched empty selects or be unable to clear a field. A coder would have to guess.
   - Fix: add this rule to 1.4 and to the "events" endpoint module.
     - Build the body with a `toEventBody(form)` helper.
     - Omit `registrationEnds`, `category`, `theme` and race `start` when empty.
     - Send plain-string optionals as trimmed strings, with `""` meaning clear.
     - State that the API cannot clear `registrationEnds`, `category`, `theme` or race `start` once set. Disable clearing in the UI, or list it under Gaps.
     - Replace "full replacement body" with "all required fields every time; omitted optionals keep their stored value".
     - Add a verification case: update an event, omit `registrationEnds`, and confirm the value persists.

3. MEDIUM. Section 4 open-redirect guard is insufficient.
   - The rule is "starts with a single `/` (not `//`, no scheme)". `/\evil.com` passes it, but WHATWG URL parsing treats `\` as `/`, so it resolves to `//evil.com`. `router.replace` then does a hard navigation to an external origin.
   - Fix: specify `safeNext(next)`.
     - Return `/` unless `next` starts with `/`, does not start with `//`, and contains no `\`.
     - Also require `new URL(next, location.origin).origin === location.origin`.
     - Also reject `/login` itself to avoid a loop.
     - Add a unit-style check for `//evil.test`, `/\evil.test`, `https://evil.test` and `/orders?x=1`.

4. NIT. The design says "Next 16.4.1 (locked)", but `package.json` has `"next": "^16.0.0"`. 16.4.1 is what is installed. Say "installed 16.4.1; `proxy.ts` exists since 16.0", or pin the version.

5. NIT. Section 1.3 documents dashboard `participants` as if it counted participants. The service computes `sum(race.reserved)`, which is seats held by quota-holding orders. Label the UI "ที่นั่งที่จอง", or document the meaning.

6. NIT. Section 1.7 does not say how clearing a BIB maps to the API. Specify: an empty input sends `bibNo: null`, and `""` is never sent because `min(1)` returns 422.

7. NIT. Section 5 step 4 only has the negative CSRF check (`Origin: http://evil.test` returns 403). Add the positive one, `Origin: http://localhost:3100` on login returns 200 through the rewrite. This is what backs the section 6 instruction that the admin origin must be in `CORS_ORIGINS`.

## Verified assumptions

- (a) Every endpoint in the inventory exists in `admin.routes.ts` with the stated role gating. The guard variables are `read`, `write` and `superOnly`. There are no invented endpoints.
- (b) Zod shapes match the validators:
  - Event body, race body, ymd and HH:mm rules.
  - Cancel, tracking, approve (3..64, regex, upper-cased in `review.service`) and reject bodies.
  - Participant PATCH (`.strict()`, `bibNo` nullable) and user create/update (`.strict()`, no email).
  - Login, change-password and `pageQuery` (max 100).
- (b) Response shapes match the services:
  - Dashboard, shipping rows, reports summary and shirt-sizes.
  - Slips (`paymentId`; waiting sorts `slipUploadedAt` asc, history sorts `reviewedAt` desc).
  - Slip image headers (`Cache-Control: private, no-store`, inline).
- (b) The CSV BOM is real (`CSV_BOM` in `utils/csv.ts`). `Content-Disposition` is set. `EXPORT_LIMIT` is 50,000.
- (b) Wrong current password on change-password returns 422 `currentPassword`, not 401, so the 401-to-login handler does not misfire. Login failure is 401 `INVALID_CREDENTIALS` and is correctly excluded from the redirect.
- (c) The gaps list is consistent with the routes. The public routes are intentionally excluded.
- (d) The client design covers same-origin credentials, `ApiError(status, code, fields)`, dotted field paths and 401 to login (once-only, excluding `/auth/login`, no redirect on 403 or 5xx).
- (e) Next 16.4.1 is installed. `node_modules/next/dist/docs/.../proxy.md` documents `export function proxy(request: NextRequest)` and a `matcher` config. `middleware` is deprecated in favour of `proxy`. The two-layer approach (optimistic `proxy.ts` plus a client `/auth/me` guard) is consistent with those docs.
- (f) The rewrite `/api/:path*` is unchanged. `next.config.ts` reads `API_PROXY_TARGET` and defaults to `http://localhost:4000`.
- (h) The env names exist in `src/config/env.ts`: `CORS_ORIGINS`, `COOKIE_SECURE`, `TRUST_PROXY`, `LOGIN_RATE_MAX`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `ID_ENCRYPTION_KEY`, `UPLOAD_DIR`, `BCRYPT_COST`, `MONGODB_URI`, `PORT`, `NODE_ENV`.
  - `SEED_*` names are in `seed.ts` and `.env.example`.
  - `API_HOST_PORT` is in `docker-compose.yml`, which binds `127.0.0.1` and sets `NODE_ENV=production`.
  - `cookieSecure` defaults to true in production, so `COOKIE_SECURE=false` is correct for plain HTTP.
- The origin check only applies to requests that carry an `Origin` header. Non-browser clients pass.
- The seed mock users `admin@example.com`, `reviewer@example.com` and `viewer@example.com` exist and need `SEED_MOCK_USER_PASSWORD` of at least 10 characters.
- `/health` and `/api/v1/health` return `{data:{status}}`, and 503 when Mongo is down.
- `rr_admin_token` is the cookie name (`COOKIE_NAME`).

## Unverified or wrong assumptions

- Wrong: `PUT /events/:id` is a "full replacement" (finding 2).
- Wrong: the open-redirect guard is sufficient (finding 3).
- Wrong in effect: the pre-flight is non-contacting for the deployed host (finding 1).
- Unverified: Next's rewrite forwards `Origin` unchanged. The negative CSRF test would prove it, and finding 7 adds the positive test.
- Unverified: whether Next adds `X-Forwarded-For` while `TRUST_PROXY=0`. The design already flags this as unverified. express-rate-limit may log a warning but does not fail.
- Unverified: the Mongo single-node replica set procedure and Docker behaviour. This is plausible but only runtime shows it.
- Not read (to avoid echoing values): the content of the admin `.env.local`. Only the key `API_PROXY_TARGET` is present.
