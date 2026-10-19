# syntax=docker/dockerfile:1

# ---- deps: ติดตั้ง dependencies ทั้งหมดจาก lockfile ----
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- build: next build (output: standalone) ----
FROM node:22-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# URL ของ API ที่ /api/* จะถูก rewrite ไป ค่านี้ถูกฝังลง .next/routes-manifest.json ตอน build
# (ไม่ได้อ่านตอน runtime) ถ้าจะเปลี่ยนต้อง build image ใหม่
ARG API_PROXY_TARGET
RUN test -n "$API_PROXY_TARGET" || { echo "ERROR: ต้องส่ง --build-arg API_PROXY_TARGET=<API URL> (เช่น https://api.walkruntogive2027.com)" >&2; exit 1; }
ENV API_PROXY_TARGET=$API_PROXY_TARGET
COPY --from=deps /app/node_modules ./node_modules
# .dockerignore ตัด node_modules, .next, .env*, docs ฯลฯ ออกแล้ว
COPY . .
# repo ยังไม่มีโฟลเดอร์ public: สร้างว่างไว้ให้ขั้น runner copy ได้เสมอ
RUN mkdir -p public
RUN npm run build

# ---- runner: standalone server เท่านั้น, non-root ----
FROM node:22-alpine AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 3000
# ตรวจหน้า /login (ไม่เรียก API)
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/login >/dev/null || exit 1
CMD ["node", "server.js"]
