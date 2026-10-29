> **AVANCE: 4 / 5 — 80,0 %.**

- Fecha: 2026-10-29 · Plan: [PLAN.md](./PLAN.md) · Rama: `claude/compassionate-franklin-p7u3rw`
- Peldaño de evidencia alcanzado: `TESTED` (el botón no se observó en navegador tras el cambio).

## Completado
| ID | Qué se logró | Comando | Resultado |
|---|---|---|---|
| H1.S1.M1 | BUG-4: `payloadDefinitions` incluye el campo `city` de los `countryCity` (sin duplicar); `formDataToPayload` lo devuelve | `yarn test` (form-payload-ciudad, 4 pruebas) | PASS · 42 archivos / 383 pruebas |
| H2.S1.M1 | OBS-12: con el expediente en `under_review`/`approved` no se ofrece «Enviar a revisión»; se explica el motivo (`aviso-expediente-enviado`) | `yarn test` (expediente-enviado, 9 pruebas) + `yarn type-check` exit 0 + `yarn lint` exit 0 | PASS |
| H3.S1.M1 | OBS-11: `PinControl` mide `calc(6ch+3em+3rem)`; el sexto dígito cabe | medición en Chromium con el mismo CSS (`pin-measure.cjs`, scratchpad) | antes: client 142 / scroll 173 (recortado) · después: client 178 / scroll 178 (cabe) |
| H3.S1.M2 | OBS-11: prueba que fija el ancho y el recorte a 6 dígitos | `yarn vitest run` | PASS · 43 archivos / 385 pruebas |

## A medias
### H1.S1.M2 — «Crear empresa» en navegador
- Qué anda: la regla pura devuelve `city`; type-check y lint en verde.
- Qué no anda: no se observó el `POST` real con `city` ni la ciudad persistida.
- Qué falta exactamente: levantar el ERP FE con el cambio, repetir «Crear empresa» y capturar red y BD.
- Dónde quedó: rama indicada, compila.

## Pendiente
| ID | Estado | Qué lo destraba |
|---|---|---|
| — | ninguno | — |

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
