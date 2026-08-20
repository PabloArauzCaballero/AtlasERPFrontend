# syntax=docker/dockerfile:1.7
# Imagen del front del ERP. Sigue el mismo patrón que la del front del motor de
# decisiones: construir con todo, servir con lo mínimo.
FROM node:22-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable

FROM base AS dependencies
COPY package.json yarn.lock ./
RUN --mount=type=cache,target=/usr/local/share/.cache/yarn \
  yarn install --frozen-lockfile

FROM base AS builder
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
# Las `NEXT_PUBLIC_*` se incrustan en el paquete del navegador AL CONSTRUIR, no al arrancar: cambiar
# una después no tiene ningún efecto. Por eso el desplegador copia el `.env.local` de la máquina
# dentro del contexto de construcción — sin él, el portal se construiría contra los valores por
# defecto y el tester llamaría a un origen que no es el suyo.
RUN yarn build
# Este front no tiene `public/`. La copia de más abajo es incondicional —Docker no sabe copiar «si
# existe»— así que se garantiza el directorio aquí; si algún día se añaden recursos estáticos, la
# imagen ya los sirve sin tocar nada.
RUN mkdir -p public

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
  NEXT_TELEMETRY_DISABLED=1 \
  HOSTNAME=0.0.0.0 \
  PORT=3010

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# `public/` no viaja dentro de `standalone`: Next lo deja fuera y su documentación pide copiarlo
# aparte, igual que `.next/static`. Sin esta línea la imagen no serviría ningún recurso estático.
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3010
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -q -O /dev/null "http://127.0.0.1:${PORT}/" || exit 1
CMD ["node", "server.js"]
