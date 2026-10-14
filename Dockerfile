# ---- build: SPA estática con Vite ----
FROM node:22.22-alpine AS builder

RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY index.html tsconfig.json vite.config.ts ./
COPY src ./src
COPY public ./public
# Typecheck + tests + build: un deploy con cálculos rotos no llega a producción.
RUN pnpm typecheck && pnpm test && pnpm build

# ---- runtime: nginx sirviendo archivos estáticos ----
FROM nginx:1.30.5-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1
