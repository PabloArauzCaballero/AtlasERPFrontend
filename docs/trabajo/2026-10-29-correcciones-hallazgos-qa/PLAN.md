# Plan — Correcciones de los hallazgos del QA transversal (AtlasERPFrontend)

- Fecha: 2026-10-29 · Repos afectados: AtlasERPFrontend · Predecesor: `AtlasDocumentationHub/10-testing/qa-flujo-completo-2026-10-28` (BUG-4, OBS-12)
- Resultado observable: (1) «Crear empresa» envía la ciudad elegida en «País y ciudad»; (2) el portal del comercio no ofrece «Enviar a revisión» con el expediente ya enviado o aprobado.
- Kill-test: (1) `POST /b2b/accounts` desde la pantalla no lleva `city` (reproducido: payload con `countryCode` y `address`, sin `city`); (2) con el expediente `approved`, el botón sigue visible y el servidor responde 422.

## Alcance

- IN: `lib/formPayload.ts` (definiciones de payload de los campos `countryCity`), `components/screens/PartnerDossierScreen.tsx` (botón de envío) + pruebas vitest.
- OUT: backend (el DTO ya acepta `city`), el resto de hallazgos de otros repos.
- Ambigüedades: ninguna.

## H1 — BUG-4: la ciudad elegida no viajaba

**CA:** Dado el formulario «Crear empresa», cuando se elige una ciudad en «País y ciudad» y se guarda, entonces el payload incluye `city` con esa ciudad.
**DoD:** `yarn vitest run` verde (prueba nueva) · `yarn type-check` · `yarn lint` · repetición en el navegador contra el stack local.
**Estado:** HECHO

### H1.S1 — Declarar el control de ciudad como parte del payload

| ID       | Microtarea                                                                                                     | CA (binario)                                        | DoD                                                      | Estado |
| -------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | -------------------------------------------------------- | ------ |
| H1.S1.M1 | `payloadDefinitions` añade `{name: cityFieldName, optional: true}` por cada campo `countryCity` (sin duplicar) | `formDataToPayload` devuelve `city`                 | `yarn vitest run tests/unit/form-payload-ciudad.test.ts` | HECHO  |
| H1.S1.M2 | Repetir «Crear empresa» en el navegador                                                                        | el `POST` lleva `city` y la cuenta guarda la ciudad | captura de red / BD                                      | HECHO  |

## H2 — OBS-12: «Enviar a revisión» con el expediente ya enviado o aprobado

**CA:** Dado un expediente en `under_review` o `approved`, cuando el comercio abre «Mi empresa», entonces no ve el botón de envío y sí un texto que explica el estado.
**DoD:** `yarn vitest run` verde · `yarn type-check` · `yarn lint`.
**Estado:** HECHO

| ID       | Microtarea                                                                         | CA (binario)                              | DoD                                         | Estado |
| -------- | ---------------------------------------------------------------------------------- | ----------------------------------------- | ------------------------------------------- | ------ |
| H2.S1.M1 | Ocultar el botón y mostrar el motivo cuando el estado es `under_review`/`approved` | sin `btn-enviar-revision` en esos estados | prueba de la regla pura + `yarn type-check` | HECHO  |

## Riesgos y bloqueos previstos

| Riesgo                                                    | Impacto                                                      | Mitigación                                       |
| --------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------ |
| Otros formularios con `cityFieldName` ahora envían `city` | Bajo: el backend ignora o acepta campos opcionales de su DTO | el campo es opcional y sólo viaja si tiene valor |

## H3 — OBS-11: el campo del código de 6 dígitos no recorta el sexto

**CA:** Dado el campo «Código del correo» con 6 dígitos, cuando se escribe el código completo, entonces los 6 caben dentro de la caja.
**DoD:** medición en Chromium (`scrollWidth <= clientWidth`) + `yarn vitest run tests/unit/pin-control.test.tsx` + type-check/lint.
**Estado:** HECHO

| ID       | Microtarea                                 | CA (binario)                | DoD                                               | Estado |
| -------- | ------------------------------------------ | --------------------------- | ------------------------------------------------- | ------ |
| H3.S1.M1 | Ancho `calc(6ch+3em+3rem)` en `PinControl` | scroll ≤ client en Chromium | script de medición (salida en REPORTE)            | HECHO  |
| H3.S1.M2 | Prueba que fija la clase de ancho          | falla con `9ch`             | `yarn vitest run tests/unit/pin-control.test.tsx` | HECHO  |

## H3 — BUG-10: «Propuesta aceptada» ofrece también borradores

**CA:** Dado el formulario «Generar contrato desde propuesta», cuando se abre el selector de propuestas, entonces sólo aparecen las ACEPTADAS.
**DoD:** `yarn vitest run tests/unit/propuestas-aceptadas.test.ts` + type-check + lint + clic real.
**Estado:** HECHO

| ID       | Microtarea                                                                   | CA (binario)                      | DoD                                                       | Estado |
| -------- | ---------------------------------------------------------------------------- | --------------------------------- | --------------------------------------------------------- | ------ |
| H3.S1.M1 | `loadAcceptedProposals` (sólo `ACCEPTED`) y su uso en la página de contratos | un `DRAFT` y un `SENT` no salen   | `yarn vitest run tests/unit/propuestas-aceptadas.test.ts` | HECHO  |
| H3.S1.M2 | Clic real                                                                    | el selector lista sólo `ACCEPTED` | script `h4-erp-contrato.cjs`                              | HECHO  |

## H4 — OBS-27: el formulario de cuentas GL tiene etiquetas en inglés
**CA:** Dado el alta de una cuenta GL (diálogo y página), cuando se abre, entonces las banderas y la sección están en español con su ayuda («Cuenta de control», «Exige centro de costo»…).
**DoD:** `yarn vitest run tests/unit/banderas-cuenta-gl.test.ts` + type-check + lint (incluye `check-ayuda`).
**Estado:** HECHO

| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H4.S1.M1 | `lib/banderasCuentaGl.ts` con etiqueta y ayuda por bandera y su uso en las dos pantallas; títulos de sección en español | ninguna etiqueta coincide con el nombre camelCase | prueba + `yarn lint` | HECHO |

## H5 — OBS-28 (ERP): «Marcar aceptada» aparece en borradores
**CA:** Dada la lista de propuestas, cuando una propuesta no está enviada, entonces «Marcar aceptada» no se puede pulsar (el servidor sólo acepta las enviadas).
**DoD:** `yarn vitest run tests/unit/propuesta-aceptable.test.ts` + type-check + lint.
**Estado:** HECHO

| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H5.S1.M1 | `puedeAceptarse(estado)` (sólo `SENT`) y `enabled` en la acción | un DRAFT no la habilita | prueba + lint | HECHO |

## H6 — OBS-5: visitar /login sin sesión dispara `POST auth/refresh` → 401
**CA:** Dado un navegador sin sesión previa, cuando se abre /login, entonces no se hace ninguna petición de refresh; con una sesión previa (marca `atlas_session_kind`), el arranque sigue renovándola con la cookie.
**DoD:** `yarn test:auth` (2 pruebas nuevas) + type-check + lint + red de /login en Chromium sin 401.
**Estado:** HECHO

| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H6.S1.M1 | `bootstrapSession` no renueva si no hay marca de sesión | 0 llamadas a refresh sin marca | `yarn test:auth` | HECHO |
| H6.S1.M2 | Red de /login en Chromium sin 401 | 0 respuestas 401 | script Playwright | HECHO |
