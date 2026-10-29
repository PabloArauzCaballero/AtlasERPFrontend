> **AVANCE: 11 / 11 — 100,0 %.**

- Fecha: 2026-10-29 · Plan: [PLAN.md](./PLAN.md) · Rama: `claude/compassionate-franklin-p7u3rw`
- Peldaño de evidencia alcanzado: `TESTED` (el botón no se observó en navegador tras el cambio).

## Completado

| ID       | Qué se logró                                                                                                                                                        | Comando                                                                                     | Resultado                                                                                                                                                                 |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H1.S1.M1 | BUG-4: `payloadDefinitions` incluye el campo `city` de los `countryCity` (sin duplicar); `formDataToPayload` lo devuelve                                            | `yarn test` (form-payload-ciudad, 4 pruebas)                                                | PASS · 42 archivos / 383 pruebas                                                                                                                                          |
| H2.S1.M1 | OBS-12: con el expediente en `under_review`/`approved` no se ofrece «Enviar a revisión»; se explica el motivo (`aviso-expediente-enviado`)                          | `yarn test` (expediente-enviado, 9 pruebas) + `yarn type-check` exit 0 + `yarn lint` exit 0 | PASS                                                                                                                                                                      |
| H3.S1.M1 | OBS-11: `PinControl` mide `calc(6ch+3em+3rem)`; el sexto dígito cabe                                                                                                | medición en Chromium con el mismo CSS (`pin-measure.cjs`, scratchpad)                       | antes: client 142 / scroll 173 (recortado) · después: client 178 / scroll 178 (cabe)                                                                                      |
| H3.S1.M2 | OBS-11: prueba que fija el ancho y el recorte a 6 dígitos                                                                                                           | `yarn vitest run`                                                                           | PASS · 43 archivos / 385 pruebas                                                                                                                                          |
| H3.S1.M1 | BUG-10 (hallado en la pasada H4): «Generar contrato desde propuesta» ofrecía borradores bajo «Propuesta aceptada»; `loadAcceptedProposals` sólo deja las `ACCEPTED` | `yarn vitest run tests/unit/propuestas-aceptadas.test.ts`                                   | PASS (2) · type-check exit 0 · lint OK                                                                                                                                    |
| H3.S1.M2 | BUG-10 en el navegador                                                                                                                                              | script `h4-erp-contrato.cjs`                                                                | antes: 4 propuestas (3 borradores) · después: sólo `PROP-2026-000001 — Tienda Sintética 984830`                                                                           |
| H1.S1.M2 | BUG-4 repetido en el navegador («Crear cuenta»/empresa con ciudad «La Paz», pasada H4)                                                                              | script `f7-cuenta.cjs` (scratchpad)                                                         | el `POST /api/v1/b2b/accounts` lleva `"city":"La Paz"`; BD `atlas_sales.b2b_accounts.city = 'La Paz'` para las dos cuentas creadas (`Tienda Sintética 302683` y `302684`) |
| H4.S1.M1 | OBS-27: las banderas de la cuenta GL tienen etiqueta y ayuda en español (`lib/banderasCuentaGl.ts`) y las secciones del alta ya no están en inglés | `yarn vitest run tests/unit/banderas-cuenta-gl.test.ts` | PASS (2) · type-check exit 0 · lint (incluye `check-ayuda`) OK |
| H5.S1.M1 | OBS-28 (ERP): «Marcar aceptada» sólo se habilita en propuestas enviadas | `yarn vitest run tests/unit/propuesta-aceptable.test.ts` | PASS (2) · suite completa 46 archivos / 391 pruebas |
| H6.S1.M1 | OBS-5: `bootstrapSession` no pide refresh si el navegador no tiene marca de sesión | `yarn test:auth` | PASS (11, 2 nuevas) · suite vitest 46 archivos / 391 pruebas · type-check y lint sin salida de error |
| H6.S1.M2 | OBS-5 en Chromium: `/login` sin sesión no hace `auth/refresh` ni devuelve 401 | script Playwright `obs5.cjs` | PASS: `{"refresh":[],"bad":[]}` (consola y red sin errores). No cubierto: recarga con sesión viva (la cubre `test:auth`, no el navegador) |

Nota de proceso: el commit de BUG-10 reformateó por error `services/optionLoaders.ts` y `app/operaciones/crm/contratos/page.tsx` con Prettier (este repo no lo usa); se rehicieron con ediciones mínimas y el diff quedó acotado.

## A medias

ninguna

## Pendiente

| ID  | Estado  | Qué lo destraba |
| --- | ------- | --------------- |
| —   | ninguno | —               |

## Evidencia

```text
(OBS-11) calc(9ch + 2.25rem) -> client 142 / scroll 173 CLIPPED ; calc(6ch + 3em + 3rem) -> 178 / 178 fits
yarn type-check -> exit 0 · yarn lint -> exit 0 · yarn test -> 42 files / 383 tests passed
```

## No cubierto

- Prueba visual de `PartnerDossierScreen` (3 viewports, ambos temas) y del formulario con ciudad: sin ejecutar.

## Desvíos del plan

Ninguno.

## Riesgos residuales

- El backend ya rechaza el envío en esos estados (422); el cambio solo evita ofrecer una acción inválida.

## Decisiones y ambigüedades

- Ninguna.
