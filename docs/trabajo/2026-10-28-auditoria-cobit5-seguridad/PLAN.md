# Plan — Auditoría de seguridad con mapeo COBIT 5 (AtlasERPFrontend)

- Fecha: 2026-10-28 · Repo: AtlasERPFrontend (Next.js 15, ERP) · Rama: `claude/gallant-thompson-wp8f28` · Predecesor: auditorías ERP-02/ERP-03 (citadas en el código)
- Resultado observable: cada hallazgo REAL tiene archivo:línea, severidad, CWE/OWASP, proceso COBIT 5 y estado; los confirmados y corregibles con cambio mínimo quedan corregidos con una prueba que los demuestra.
- Kill-test: si `yarn audit` sigue listando `next` con una severidad crítica/alta, o `/almacen/subida` acepta un volumen de bytes sin tope global, el trabajo NO está hecho.
- Aclaración de marco: COBIT 5 es un marco de gobierno y gestión de TI. Este trabajo entrega un mapeo hallazgo→proceso y evidencia técnica; NO es una certificación ni una evaluación de capacidad de procesos.

## Alcance

- IN: `middleware.ts`, `next.config.ts`, `app/**` (incluidas rutas), `lib/apiClient.ts`, `lib/almacen.ts`, almacenamiento de sesión, redirecciones, `dangerouslySetInnerHTML`, `Dockerfile*`, `docker-compose*.yml`, `.env.example`, `.github/workflows`, E2E (credenciales), dependencias (`yarn audit`), `package.json`/`yarn.lock` sólo para subir versiones YA existentes.
- OUT: otros repos (backend, motor, otros frontends); cookies del refresh (las emite el backend, sólo se inspecciona el cliente); refactors y reformateos no solicitados; capturas visuales (no hay cambio visual).
- Ambigüedades registradas:
  1. ¿Subir `next` de 15.5.24 a 15.5.28 cuenta como «dependencia nueva»? Supuesto: NO (misma dependencia, parche del mismo minor, sin paquetes añadidos). A confirmar con el responsable del repo.
  2. Presupuesto de bytes en vuelo de `/almacen/subida` (100 MiB): supuesto razonable para un contenedor con límite de 512 MiB; a confirmar con operaciones.

## Hallazgos de descubrimiento (hechos con ruta)

| ID | Hecho | Ruta |
|---|---|---|
| D1 | `next` 15.5.24 en `yarn.lock`; `yarn audit` lo marca crítico/alto/moderado (RCE por optimizador de imágenes con SVG, DoS en Server Actions, envenenamiento de caché) | `package.json`, `yarn.lock:2839` |
| D2 | `source-map-js` 1.2.1 y `postcss-selector-parser` 6.1.4 vulnerables (sólo build) | `yarn.lock:3488`, `yarn.lock:3109` |
| D3 | `/almacen/subida` no exige sesión; lee hasta 50 MiB en memoria por petición y los duplica al concatenar; el contenedor tiene 512 MiB | `app/almacen/subida/route.ts`, `docker-compose.coolify.yml` |
| D4 | El bearer vive sólo en memoria; `localStorage` guarda únicamente el tipo de sesión | `lib/apiClient.ts:148-195` |
| D5 | `?next=` se valida con `rutaInternaSegura` | `lib/rutaInterna.ts` |
| D6 | Único `dangerouslySetInnerHTML` es el SVG de `qrSvg`, sin interpolar contenido | `components/atlas/QrCanvas.tsx:52` |
| D7 | CSP con nonce + `strict-dynamic` en `middleware.ts`; cabeceras estáticas en `next.config.ts` | `middleware.ts`, `next.config.ts` |
| D8 | Imagen final corre como `nextjs` (no root) | `Dockerfile:68`, `Dockerfile.dev:102` |
| D9 | Las credenciales de E2E reales salen de `process.env`; las de los simulados son fixtures | `e2e/*real*.spec.ts` |

## H1 — Dependencias sin vulnerabilidades altas/críticas

**CA:** Dado el lockfile actual, cuando se corre `yarn audit --groups dependencies`, entonces no queda ninguna vulnerabilidad `high` ni `critical`.
**DoD:** salida literal de `yarn audit` antes/después en `evidencia/`; `yarn type-check`, `yarn test`, `yarn build` con código de salida 0.
**Estado:** HECHO

| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H1.S1.M1 | Fijar `next` en 15.5.28 y actualizar `yarn.lock` | `grep '"next"' package.json` muestra 15.5.28 y el lockfile resuelve 15.5.28 | `yarn install --frozen-lockfile` sale 0 | HECHO |
| H1.S1.M2 | Añadir `resolutions` para `source-map-js` y `postcss-selector-parser` (mismo patrón que las existentes) | el lockfile resuelve ≥1.2.2 y ≥6.1.5 | `yarn audit --groups dependencies` sin high/critical | HECHO |
| H1.S1.M3 | Gates tras el cambio | tsc, vitest y build terminan en 0 | `yarn type-check && yarn test && yarn build` | HECHO |

## H2 — `/almacen/subida` no puede agotar la memoria del contenedor sin sesión

**CA:** Dado el endpoint sin sesión, cuando llegan peticiones cuya suma de `content-length` declarados supera el presupuesto en vuelo, entonces las que no caben reciben 503 en texto plano con `Retry-After` (el cliente ya lo reintenta), la memoria reservada se libera siempre al terminar, y una petición sola de hasta 50 MiB sigue pasando.
**DoD:** prueba nueva en `tests/unit/almacen-subida-route.test.ts` que falla sin el cambio y pasa con él; las pruebas previas del archivo siguen en verde sin modificarlas.
**Estado:** HECHO

| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H2.S1.M1 | Prueba que demuestra el hueco (rojo antes del fix) | 3 subidas simultáneas de 40 MiB declarados: hoy las 3 se aceptan | `yarn vitest run tests/unit/almacen-subida-route.test.ts` → FAIL en la prueba nueva | HECHO |
| H2.S1.M2 | Reserva de bytes en vuelo con liberación en `finally` | la prueba nueva pasa; las existentes siguen verdes | mismo comando → PASS | HECHO |

## H3 — Revisión de los focos sin hallazgo (sólo evidencia)

**CA:** Cada foco del encargo tiene veredicto: confirmado, descartado como falso positivo, o BLOCKED, con la ruta que lo respalda.
**DoD:** tabla en `REPORTE.md` y salidas en `evidencia/`.
**Estado:** HECHO

| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H3.S1.M1 | Sesión/almacenamiento, open redirect, XSS, CSP/cabeceras, rewrites, NEXT_PUBLIC, Docker, workflows, E2E | cada foco con veredicto | `grep`/lectura citada en el reporte | HECHO |

## H4 — Cierre

| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H4.S1.M1 | Lint del repo | `yarn lint` sale 0 | salida literal en `evidencia/` | HECHO |
| H4.S1.M2 | Escribir `REPORTE.md` y commit con sólo mis archivos | reporte con avance en la primera línea; `git status` limpio de lo mío | `git log -1 --stat` | HECHO |

## Riesgos y bloqueos previstos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| El bump de `next` cambia comportamiento de build | build rojo | correr `yarn build` y la suite completa antes de cerrar; si falla, `BLOQUEADO` con el error literal |
| `yarn audit` depende de red | sin datos de dependencias | ya respondió en el descubrimiento; si no, `BLOCKED` |
| Reservar por `content-length` declarado | un cliente declara de más y ocupa presupuesto | la reserva se libera siempre en `finally` y la petición no puede leer más de lo declarado (ya existe) |
