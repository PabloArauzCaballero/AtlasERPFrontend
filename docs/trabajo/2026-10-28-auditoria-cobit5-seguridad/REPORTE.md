> **AVANCE: 8 / 8 — 100,0 %.** (microtareas del PLAN.md; el peldaño de evidencia es TESTED, no VERIFIED: ver «No cubierto»).

- Fecha: 2026-10-28 · Plan: [PLAN.md](./PLAN.md) · Rama: `claude/gallant-thompson-wp8f28` · Repo: AtlasERPFrontend
- Peldaño de evidencia alcanzado: **TESTED** para `/almacen/subida` (prueba que falló antes del cambio y pasa después) y **RUNS** para el cambio de dependencias (`yarn audit` sin vulnerabilidades altas/críticas, `type-check`, `test`, `test:auth`, `lint` y `build` con código de salida 0). No se llegó a VERIFIED: no se ejercitó el servidor real contra un almacén real.
- **Aclaración de marco:** COBIT 5 es un marco de gobierno y gestión de TI. Este reporte entrega el mapeo hallazgo→proceso y evidencia técnica; no es una certificación ni una evaluación de capacidad de procesos.

## Hallazgos

| ID | Sev. | Dónde | CWE / OWASP | COBIT 5 | Estado |
|---|---|---|---|---|---|
| ERP-S01 | Crítica (según el aviso del proveedor; alcance real no demostrado) | `package.json` / `yarn.lock:2839` — `next` 15.5.24 | CWE-94, CWE-400 · OWASP A06:2021 (componentes vulnerables) | BAI03.05, BAI06.01, APO12.02, DSS05.01 | **CORREGIDO** (`next` 15.5.28) |
| ERP-S02 | Alta (sólo build) / Media | `yarn.lock:3488` `source-map-js` 1.2.1; `yarn.lock:3109` `postcss-selector-parser` 6.1.4 | CWE-400, CWE-407 · A06:2021 | BAI03.05, APO12.02 | **CORREGIDO** (`resolutions`) |
| ERP-S03 | Media | `app/almacen/subida/route.ts` (antes de la reserva, lectura completa del cuerpo en `leerConTope`) | CWE-770 · OWASP API4:2023 / A04:2021 | DSS05.02, APO13.01, BAI03.05 | **CORREGIDO** (presupuesto global de bytes en vuelo) |
| ERP-S04 | Alta (operativa) | `.gitleaksignore:12-13` — dos huellas de commits (`2a1b53c…`, `7ee4cad…`) con contraseñas de cuentas de prueba reales en `e2e/*-real*` del historial; repositorio declarado público | CWE-798 · A07:2021 / A02:2021 | DSS05.04, DSS05.03, APO13.03 | **NO CORREGIDO**: **ROTAR** (valores no reproducidos aquí). Reescribir el historial es destructivo y no neutraliza la fuga |
| ERP-S05 | Baja | `app/version/route.ts` expone commit y fecha de build sin sesión | CWE-200 · A05:2021 | DSS05.02, MEA01.03 | **NO CORREGIDO**: es deliberado (lo lee el smoke de despliegue); decisión de negocio |
| ERP-S06 | Info | `Dockerfile:41` (`COPY . .`) + `.dockerignore:20`: `.env.local` viaja al contexto de build y a la capa `builder` (no a la imagen final) | CWE-538 · A05:2021 | DSS05.04, APO13.01 | **NO CORREGIDO**: sólo hay riesgo si alguien pone un secreto en `.env.local`; hoy sólo declara `NEXT_PUBLIC_*` |

### Sobre ERP-S01 (alcance real)

El repo no usa `next/image` ni Server Actions (`grep "use server"` sin resultados; los `<img>` son blobs locales). Eso reduce, pero no elimina, la exposición: `/_next/image` existe por defecto en el modo `standalone`. Se corrigió por versión y no se afirma explotabilidad.

### Focos revisados sin hallazgo (falsos positivos descartados, con ruta)

| Foco | Veredicto | Evidencia |
|---|---|---|
| Token de sesión en almacenamiento accesible por script | Descartado: el bearer vive en una variable de módulo; el token heredado de `localStorage` se destruye sin usarlo. En `localStorage` sólo queda el tipo de sesión (`internal`/`merchant`), que elige a qué endpoint de refresh se llama y no concede privilegios | `lib/apiClient.ts:148-195`, `e2e/auth-session.spec.ts` |
| `middleware.ts`: matcher / bypass por variable o cabecera | Sin bypass: el middleware sólo emite la CSP con nonce. La autorización la decide la API; `RequireAuth` es comodidad de navegación (ocultar no es seguridad). El matcher excluye `/api` (el proxy a la API) y `_next/*`, lo cual es correcto para CSP | `middleware.ts`, `components/layout/RequireAuth.tsx` |
| XSS | Un único `dangerouslySetInnerHTML` (SVG del QR sin interpolar contenido); sin `href` con datos de API hacia esquemas arbitrarios; los enlaces externos llevan `rel="noopener noreferrer"` | `components/atlas/QrCanvas.tsx:52`, `AddressMapField.tsx:104-108` |
| Open redirect | Descartado: `?next=` pasa por `rutaInternaSegura` (19 pruebas) | `lib/rutaInterna.ts`, `tests/unit/ruta-interna.test.ts` |
| CSP y cabeceras | CSP con nonce + `strict-dynamic`, `object-src 'none'`, `frame-ancestors 'none'`, XFO, nosniff, HSTS, Referrer-Policy, Permissions-Policy; `unsafe-eval` sólo en desarrollo | `middleware.ts`, `next.config.ts`, `tests/unit/security-headers.test.ts` |
| CSRF | Sin cookie de sesión en peticiones al API (bearer por cabecera); el refresh va por cookie `httpOnly` que emite el backend | `lib/apiClient.ts` |
| Rewrites / SSRF | El destino del rewrite es fijo (`ERP_API_ORIGIN`, build-time); `/almacen/subida` valida lista exacta, firma, sin redirecciones | `next.config.ts`, `app/almacen/subida/route.ts` |
| `NEXT_PUBLIC_*` con secretos | Sólo URL de API, prefijo, tamaño de página y URL del motor | `.env.example`, `Dockerfile.dev:68-73` |
| Dockerfile como root | Descartado: la imagen final corre como `nextjs` (uid 1001) | `Dockerfile:74`, `Dockerfile.dev:102` |
| Mock-server en producción | No existe mock-server en este repo; los simulados son E2E de Playwright | `e2e/*.simulada.spec.ts` |
| PII en logs/URLs/analytics | Un solo `console.warn` con el objeto de error; la búsqueda global y el correo del login viajan por `sessionStorage` efímero, no por la URL | `components/screens/MerchantSupportScreen.tsx:89`, `lib/traspasoEfimero.ts` |
| Workflows | Acciones fijadas por SHA, `permissions` declarado, secretos sólo en `env:` | `.github/workflows/*.yml` |

## Completado

| ID | Qué se logró | Comando | Resultado |
|---|---|---|---|
| H1.S1.M1 | `next` fijado en 15.5.28 | `grep -nA1 '^next@' yarn.lock` | `next@15.5.28` (versión 15.5.28) |
| H1.S1.M2 | `resolutions` para `source-map-js` (^1.2.2) y `postcss-selector-parser` (^6.1.5) | `yarn audit --groups dependencies` | PASS: `{"info":0,"low":0,"moderate":0,"high":0,"critical":0}` — [antes](evidencia/yarn-audit-antes.txt) / [después](evidencia/yarn-audit-despues.txt) |
| H1.S1.M3 | Gates tras el cambio de dependencias | `yarn type-check`; `yarn test`; `yarn test:auth`; `yarn build` | PASS: exit 0; 372/372 pruebas; 9/9 de auth — [typecheck](evidencia/gate-typecheck.txt), [test](evidencia/gate-test.txt), [auth](evidencia/gate-test-auth.txt), [build](evidencia/gate-build.txt) |
| H2.S1.M1 | Prueba que demuestra el hueco | `yarn vitest run tests/unit/almacen-subida-route.test.ts` (sin el cambio) | FAIL esperado: `expected null to be 503` — [evidencia](evidencia/subida-prueba-ROJA-antes-del-fix.txt) |
| H2.S1.M2 | Reserva de bytes en vuelo con liberación en `finally` | mismo comando (con el cambio) | PASS: 14/14 — [evidencia](evidencia/subida-prueba-VERDE-tras-el-fix.txt) |
| H3.S1.M1 | Veredicto por foco | lectura de código citada arriba | PASS (revisión estática, ver «No cubierto») |
| H4.S1.M1 | Lint del repo | `yarn lint` | PASS: exit 0 — [evidencia](evidencia/gate-lint.txt) |
| H4.S1.M2 | Reporte y commit con sólo los archivos de este trabajo | `git log -1 --stat` | ver el commit que contiene este archivo |

## A medias

Ninguna.

## Pendiente

| ID | Estado | Qué lo destraba |
|---|---|---|
| ERP-S04 rotación | TODO (humano) | Rotar las contraseñas de las dos cuentas de prueba (el valor figura enmascarado: **ROTAR**). Pablo, según la nota del `.gitleaksignore` |
| ERP-S05 | DESCARTADO por ahora | Decisión del dueño del despliegue sobre si `/version` exige sesión |

## Evidencia

```text
$ yarn audit --groups dependencies   (antes)   -> RESUMEN {"info":0,"low":0,"moderate":4,"high":3,"critical":1}
$ yarn audit --groups dependencies   (después) -> RESUMEN {"info":0,"low":0,"moderate":0,"high":0,"critical":0}
$ yarn vitest run tests/unit/almacen-subida-route.test.ts (antes)   -> 1 failed | 13 passed
$ yarn vitest run tests/unit/almacen-subida-route.test.ts (después) -> 14 passed (14)
$ yarn test -> Test Files 40 passed (40) · Tests 372 passed (372)
$ yarn test:auth -> pass 9 · fail 0
$ yarn type-check / yarn lint / yarn build -> exit 0
```

Archivos en `evidencia/`: `yarn-audit-antes.txt`, `yarn-audit-despues.txt`, `subida-prueba-ROJA-antes-del-fix.txt`, `subida-prueba-VERDE-tras-el-fix.txt`, `gate-typecheck.txt`, `gate-test.txt`, `gate-test-auth.txt`, `gate-lint.txt`, `gate-build.txt`.

## No cubierto

- No se levantó el servidor ni se hizo una subida real a un MinIO: la prueba de `/almacen/subida` usa un `fetch` simulado (etiquetado así). El presupuesto de 100 MiB es un supuesto sobre un contenedor de 512 MiB; no se midió memoria real.
- No se probó E2E (Playwright) ni verificación visual: el cambio no toca interfaz y no hay capturas.
- Los flags de la cookie de refresh (HttpOnly/Secure/SameSite), la validación de autorización en el backend, la confianza en cabeceras de identidad reenviadas por el rewrite y CORS son del backend, fuera de este repo.
- `yarn audit` cubre `dependencies`; no se auditaron `devDependencies` (Playwright, vitest, eslint) ni el contenido de la imagen base.
- No se ejecutó el escaneo de secretos (gitleaks no está instalado en este entorno); ERP-S04 sale de la documentación del propio `.gitleaksignore`.
- No se ejercitó el reintento del cliente ante el 503 nuevo contra el navegador; se apoya en que `lib/reintentos.ts` trata 503 sin JSON como pasarela (`DE_PASARELA`).

## Desvíos del plan

Ninguno.

## Riesgos residuales y deuda

- ERP-S04: mientras no se roten las credenciales, siguen válidas para quien clone el historial público.
- Subida masiva coordinada: el presupuesto acota la memoria, pero un atacante puede ocupar la reserva con peticiones lentas que declaren 50 MiB y no envíen cuerpo (el cliente legítimo recibiría 503 con reintentos). Una mitigación completa (límite por IP / sesión) corresponde a la capa de proxy.
- `/_next/image` sigue presente aunque el repo no use `next/image`; `images: { unoptimized: true }` reduciría la superficie y queda como recomendación (no se aplicó para mantener el cambio mínimo).

## Decisiones y ambigüedades

1. Subir `next` a 15.5.28 se trató como actualización de una dependencia existente, no como «dependencia nueva». Confirmar con el responsable del repo.
2. Se fijó el presupuesto en 100 MiB declarados (pico estimado ~200 MiB por el doble buffer). Confirmar con operaciones junto al límite real del contenedor.
3. La rama no se empujó (`git push` prohibido).
