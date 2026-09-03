# syntax=docker/dockerfile:1.7
# Imagen del front del ERP. Sigue el mismo patrón que la del front del motor de
# decisiones: construir con todo, servir con lo mínimo.
FROM node:22-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable

FROM base AS dependencies
# `NODE_ENV` se FIJA aquí, y no es defensa teórica: Coolify declara un `ARG NODE_ENV` en TODAS las
# etapas y le pasa el valor de Environment Variables, y un ARG llega a los `RUN` como variable de
# entorno. Si alguien pone `production` en el panel, `yarn install` se salta las devDependencies
# —typescript, eslint, los tipos— y el build muere despues, en otra etapa, sin nombrar la causa.
# Instalar SIEMPRE con `development`: esta etapa existe para tener el arbol completo.
ENV NODE_ENV=development
COPY package.json yarn.lock ./
RUN --mount=type=cache,target=/usr/local/share/.cache/yarn \
  yarn install --frozen-lockfile

FROM base AS builder
# La otra mitad de lo mismo, y esta es la que rompia el despliegue.
#
# Con `NODE_ENV=development` puesto por el ARG de Coolify, `next build` compila bien pero MUERE
# prerenderizando las paginas de error:
#
#   Error: <Html> should not be imported outside of pages/_document.
#   Export encountered an error on /_error: /404, exiting the build.
#   ⨯ Next.js build worker exited with code: 1
#
# El panel de Coolify solo publica `did not complete successfully: exit code: 1`, asi que el fallo
# se lee como falta de memoria o como un problema de red. No lo es. Este `ENV` gana sobre el ARG
# —un ENV explicito tiene prioridad sobre el valor de un build-arg del mismo nombre— y deja el
# build inmune a lo que haya en el panel.
ENV NODE_ENV=production
# `next.config.ts` hornea `ERP_API_ORIGIN` en el rewrite AL CONSTRUIR. Dentro del contenedor,
# `127.0.0.1:3007` (el default del `.env.local`) es el propio contenedor, no el host; por eso el
# origen del proxy se inyecta como build-arg y una variable de entorno real gana sobre el `.env.local`.
ARG ERP_API_ORIGIN=http://host.docker.internal:3007
ENV ERP_API_ORIGIN=$ERP_API_ORIGIN
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
