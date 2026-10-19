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

## Docker และ CI/CD (deploy เหมือน running-event-api)

`next.config.ts` ใช้ `output: "standalone"`; `Dockerfile` เป็น multi-stage (deps, build, runner) รันเป็น user `node` ที่ port 3000 และมี HEALTHCHECK ที่ `/login` (ไม่เรียก API)

### `API_PROXY_TARGET` เป็น build arg
`rewrites()` ถูกประเมินตอน `next build` และค่าถูกฝังใน `.next/routes-manifest.json` ดังนั้น image ต้องได้ค่านี้ตอน build (`--build-arg API_PROXY_TARGET=...`) แก้ env ตอนรัน container ไม่มีผล ถ้าจะเปลี่ยน URL ของ API ต้อง build image ใหม่ ถ้าไม่ส่ง build arg การ build จะหยุดพร้อมข้อความ error

### รันบนเครื่องด้วย Docker Compose
```bash
API_PROXY_TARGET=http://host.docker.internal:4000 docker compose up -d --build
```
- ค่าเริ่มต้นของ build arg คือ `http://host.docker.internal:4000` (API ที่รันบนเครื่อง host)
- bind ที่ `127.0.0.1:3000` เท่านั้น (เปลี่ยนด้วย `ADMIN_HOST_PORT`)

### CI/CD
workflow: `.github/workflows/ci-cd.yml` (โครงเดียวกับ API)
- pull request เข้า `main`: `typecheck` และ `build`
- push เข้า `main`: ตรวจเหมือนกัน แล้ว build/push `ghcr.io/warunyoo1/running-event-admin` (tag `latest` และ commit SHA) ด้วย `GITHUB_TOKEN` จากนั้น SSH เข้า server เพื่อ `pull admin`, `up -d`, รอ healthcheck และ `docker image prune -f`

GitHub ที่ต้องตั้ง (Settings > Secrets and variables > Actions) ใช้ชื่อเดียวกับ API:

| ชื่อ | ประเภท | จำเป็น |
|---|---|---|
| `API_PROXY_TARGET` | variable | ใช่ (production: `https://api.walkruntogive2027.com` ไม่มี `/` ท้าย) |
| `SSH_HOST`, `SSH_USER`, `SSH_KEY` | secret | ใช่ |
| `SSH_PORT` | secret | ไม่ (ค่าเริ่มต้น 22) |
| `SSH_KNOWN_HOSTS` | secret | แนะนำ |
| `DEPLOY_PATH` | variable หรือ secret | ไม่ (ค่าเริ่มต้น `/var/www/projects/running-event-admin`) |

### Deploy ครั้งแรกบน server
```bash
sudo mkdir -p /var/www/projects/running-event-admin
sudo chown <deploy-user>: /var/www/projects/running-event-admin
# คัดลอก docker-compose.prod.yml ไปไว้ที่โฟลเดอร์นี้ (workflow ไม่ได้ส่งไฟล์ให้)
cd /var/www/projects/running-event-admin
docker compose -f docker-compose.prod.yml pull admin
docker compose -f docker-compose.prod.yml up -d
curl -I http://127.0.0.1:3000/login     # ต้องได้ 200
```
server ต้อง login GHCR ไว้แล้วเหมือนฝั่ง API (หรือตั้ง package เป็น public) ไม่ต้องมี `.env` เพราะไม่มี secret ตอนรัน

### nginx (DirectAdmin, nginx_apache)
ทำแบบเดียวกับ API: สร้างไฟล์ server block แล้ว include จาก `/etc/nginx/nginx-includes.conf` (เปลี่ยนโดเมนให้ตรงของจริง)

```nginx
# /etc/nginx/admin-walkruntogive2027.conf   <-- ปรับโดเมนและ IP ให้ตรงกับของจริง
server {
    listen <server-ip>:80;
    server_name admin.walkruntogive2027.com;

    location /.well-known/acme-challenge/ {
        root /var/www/letsencrypt;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

# เพิ่มบล็อกนี้หลังออกใบรับรองด้วย certbot (webroot /var/www/letsencrypt) สำเร็จแล้ว
server {
    listen <server-ip>:443 ssl;
    http2 on;
    server_name admin.walkruntogive2027.com;

    ssl_certificate     /etc/letsencrypt/live/admin.walkruntogive2027.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/admin.walkruntogive2027.com/privkey.pem;

    location / {
        client_max_body_size 8m;   # อัปโหลดรูปงานวิ่งผ่าน /api (ให้ตรงกับฝั่ง API)
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        # ไม่ต้องใช้ websocket upgrade header สำหรับแอปนี้
    }
}
```
ขั้นตอน: ใส่เฉพาะบล็อก HTTP ก่อน, `echo 'include /etc/nginx/admin-walkruntogive2027.conf;' >> /etc/nginx/nginx-includes.conf`, `nginx -t && systemctl reload nginx`, ออกใบรับรองด้วย certbot แบบ webroot, แล้วจึงเพิ่มบล็อก HTTPS และเปลี่ยน `location /` ของ HTTP เป็น redirect

### ค่าที่ต้องตั้งฝั่ง API
- `CORS_ORIGINS` ต้องมี origin ของ admin ตรงตัว เช่น `https://admin.walkruntogive2027.com` (ไม่มี `/` ท้าย)
- `COOKIE_SECURE=true` เมื่อใช้ HTTPS
- `TRUST_PROXY=1`
- `API_PROXY_TARGET` (build arg) ต้องเป็น URL สาธารณะของ API: `https://api.walkruntogive2027.com`

cookie `rr_admin_token` เป็น httpOnly, SameSite=Lax และใช้ได้เพราะเบราว์เซอร์คุยกับ origin ของ admin เท่านั้น (เรียก `/api` แบบ same-origin แล้ว Next rewrite ไปที่ API)

## Roles

`super_admin`, `reviewer`, `viewer`. The UI hides actions as a convenience; the API is the authority.

- `viewer`: read and export only.
- `reviewer`: also cancel, approve, reject, tracking, address edit, internal notes (delete only their own), BIB and collected updates.
- `super_admin`: also create/edit/archive/delete events, manage event images, manage users and read the audit log.

## Event images

Event cards (and the dashboard's upcoming list) show a real image via `EventCover`: the first `cover` by sort order, else the first `poster`, else the first image of any kind, else the theme artwork. It uses `previewUrl` (works for drafts), falls back to the artwork if the file fails to load, and shows an "รูป N" badge when the event has more than one image. "ดูรูปภาพ" on each card opens a read-only panel (all roles) grouped by kind, with a keyboard-friendly lightbox.

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
src/app/(admin)/*/page.tsx    client pages (dashboard, events, orders, slips, participants, shipping, reports, users, audit-logs)
src/app/login/page.tsx        server page, renders components/login-form.tsx
src/components/               shell, shared UI, data states, login and change-password
src/features/admin/           providers (auth, scope, toast), use-async, permissions, format, order-detail (+ notes, timeline, address form), event-images
src/lib/constants.ts          API_BASE, cookie name, page size, export limit, labels
src/lib/password.ts           temporary password generator (crypto.getRandomValues)
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

## Backed by the API
Everything in the UI calls a real endpoint. Nothing is generated in the browser any more:
- Overview and shirt-size CSV: `GET /export/overview.csv`, `GET /export/shirt-sizes.csv` (`client-csv.ts` is gone).
- Shipping search: `GET /shipping?q=` searches every page (participant name, BIB, order no, contact name/phone, tracking no) and the fulfillment CSV honors it. Needs MongoDB 5.0+ on the API side.
- Events: archive, restore and permanent delete (super_admin), clearing `registrationEnds`, `category`, `theme` and race `start`.
- Users: invite with a generated temporary password, email edit, deactivate/activate, permanent delete, last login, forced password-change nudge.
- Orders: internal notes, timeline, address editing, reviewer name.
- Audit log page (super_admin): `GET /audit-logs`.
Remaining limits (on purpose):
- The dashboard is unchanged: after an event is archived its races still appear in the dashboard and overview CSV, and its orders are still counted.
- The race filter on the participants page is built from the active events in the scope list, so races of archived events cannot be picked there (their participants still show when no race is chosen).
- Category and theme cannot be "unset": clearing them stores the API defaults (`road`, `orange`).
- The API sends no invitation email. Share the temporary password with the user yourself.
API endpoints with no admin UI:
- All `/public/*` routes (public site), `/health`, and `GET /events/:id` (list data is enough).