> **AVANCE: 2 / 2 microtareas definidas de H1 (ERP, portal de comercio) — 100 %. Dashboards y DecisionEngine tienen su franja de textos pendiente en esta sesión.**

- Fecha: 2026-10-29 · Plan: [PLAN.md](./PLAN.md) · Rama: `claude/great-shannon-fm2l7p` (AtlasERPFrontend)
- Peldaño de evidencia alcanzado: `TESTED` (tipos, lint, auth, 385 unitarias y build en exit 0). Una captura a 375 px contra backend simulado. No se declara `VERIFIED`.

## Completado

| ID    | Qué se logró                                                                                          | Comando de verificación                | Resultado                                  |
| ----- | ----------------------------------------------------------------------------------------------------- | -------------------------------------- | ------------------------------------------ |
| H1.M1 | Vacíos del historial del POS (con/sin filtros), de la cartera (3) y del filtro de cuotas: dicen qué es y la salida que corresponde | captura 375 px + DOM + `build`         | PASS · `evidencia/textos.md`, `m375_vacio-cartera.png` |
| H1.M2 | Ayuda del código de acceso que no llega                                                               | `vitest login-pin-copy`                | PASS · 1 test                              |

Gates: `npx tsc --noEmit` OK · `npm run lint` OK (`--max-warnings=0`) · `npm run test:auth` OK · `npx vitest run` → `Test Files 43 passed · Tests 385 passed` · `npm run build` exit 0.

## A medias

Ninguna.

## Pendiente

| ID  | Estado | Qué lo destraba |
| --- | ------ | --------------- |
| —   | —      | Ninguno en este repo |

## Evidencia

- `evidencia/textos.md` (antes → después, lo no cambiado y la corrección hecha al verificar), `evidencia/m375_vacio-cartera.png`, `evidencia/salidas.txt`.

## No cubierto

- **Backend real**: la cartera vacía se vio con listas simuladas.
- **Solo se vio 1 vacío en navegador** (cartera · próximos cobros); el del historial del POS, el de créditos, el de calendario y el de cuotas se verificaron por tipos y por lectura del código, no en pantalla.
- **Los otros 20 bloques ad hoc** `py-8/py-10 text-center` del ERP no se revisaron.
- **La consola interna** (`/operaciones`) y `recuperar-acceso` no se revisaron.
- **Dispositivos reales**; **E2E de Playwright**.

## Desvíos del plan

- Las tres frases de la cartera se reescribieron tras ver la captura: la primera versión repetía el subtítulo del panel (ver `evidencia/textos.md`).
- La prueba del PIN falló la primera vez por mi doble (usé `kind: 'pin_challenge'` y el desafío real es `pinChallengeRequired: true`); error de la prueba, corregido.

## Riesgos residuales

- **Dos voces en una misma pantalla**: el aviso rojo «Tu comercio todavía no tiene expediente… Ábrelo tú mismo» usa «tú» y el resto de «Mi cartera» («Lo que le deben», «Su cartera dice…») usa «usted». No se unificó: es una decisión de marca.
- **Dos afirmaciones que no pude comprobar**: ese mismo aviso dice «son siete campos y tarda un minuto». Si el formulario cambia, la frase se queda falsa sin que nada avise. Convendría quitar «y tarda un minuto» o medirlo.
- «pulsa “Usar otra cuenta” para volver a empezar» supone que volver al formulario permite pedir otro código; no se comprobó contra el backend real.

## Decisiones y ambigüedades

- No se creó un componente de estado vacío: hay 23 bloques ad hoc y migrarlos es un refactor no pedido. Si se quiere unificar, es una tarea aparte.
- No se unificó la persona gramatical (usted/tú): decisión de marca, a confirmar.
- Se aplicaron solo las reglas transferibles de marketingskills (ver el plan de AdminPortal, `2026-10-29-textos-acceso-y-vacios`).
