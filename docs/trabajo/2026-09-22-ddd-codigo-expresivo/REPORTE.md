# Reporte — Auditoría DDD: Acciones de la cola de onboarding

- Fecha: 2026-09-22 · Plan: [PLAN.md](./PLAN.md) · Rama: dev
- Estado H2: **HECHO** · Avance: 3 HECHO.

## Completado en H1

| ID | Qué se logró | Comando | Resultado |
|---|---|---|---|
| H1.S1.M1 | Entrada `app/operaciones/crm/onboarding/page.tsx` y propietario `services/b2bService.ts` localizados | inspección de rutas y símbolos | rutas presentes |
| H1.S1.M2 | Referencia del flujo | `npm run type-check` | TypeScript sale con código 0; no se ejecutó test de interacción |

## Ejecución H2

La acción existente espera confirmación del ERP antes de recargar el resumen; se intentó la prueba de rechazo y refresco en navegador.

**Evidencia:** `npm run test:e2e -- e2e/onboarding-cola.evidencia.spec.ts --project=chromium`: 3 pruebas omitidas; `npm run type-check` y `npm run lint`: 0. El backend local en `127.0.0.1:3017` respondió 401 a la lectura de la cola sin token.

## Límites y resultado del gate

La suite E2E original requiere backend ERP local con `AUTH_DISABLED_FOR_LOCAL_TESTING=true` y `PW_ONBOARDING_EVIDENCIA=1`; el proceso existente exigía autenticación y esa corrida no aportó evidencia del rechazo ni del refresco. No se alteró la UX ni se reinició un servidor compartido.

### Revisión estática liviana del 2026-09-23

En `app/operaciones/crm/onboarding/page.tsx`, la acción «Activar comercio» espera `activateOnboarding` antes de llamar a `summary.reload()`. En `components/screens/CrudDirectory.tsx`, `runExtra` cierra la confirmación, muestra éxito y recarga el listado solo cuando `action.run` resuelve; si rechaza, conserva la confirmación y muestra el mensaje en `InlineNotice`. Esto respalda el orden de las operaciones en el código, pero no comprueba la respuesta 409 ni el estado visible en navegador. No se iniciaron servicios ni se ejecutó Playwright por la restricción de recursos de la máquina.

### Cierre dirigido del 2026-09-23

Se añadió `e2e/onboarding-activacion.simulada.spec.ts` con dos recorridos de navegador independientes: un 409 conserva el caso y la confirmación, muestra el error y no recarga la cola; una activación confirmada recarga la cola y deja el caso en «Activados». Playwright Chromium con un trabajador y prioridad baja: **2/2**. ESLint del archivo y `npm run type-check`: salida 0. El frontend se ejecutó en un worktree aislado y el servidor se cerró al terminar.

En el backend, `activateOnboardingCase` lanza `ConflictException` antes de escribir si el caso ya está cerrado, falta aprobación, hay checklist pendiente o falta contrato vigente. Su suite dirigida `b2b-onboarding.service.spec.ts` pasó **22/22**. Esta combinación comprueba la reacción de la pantalla ante 409 y la compuerta del servicio; el navegador utilizó respuestas simuladas, por lo que no sustituye una integración HTTP contra el backend real. No se modificó código de producto porque la prueba confirmó el comportamiento esperado.

## Decisión

Se conserva el contrato observado y se evita introducir reglas de negocio sin respaldo. Los cambios de producto y las pruebas de esta pasada se describen arriba; las limitaciones pendientes permanecen explícitas.

## Reanudación del 2026-09-23

Se comprobaron con `curl` los servicios locales: ni la API ERP en `127.0.0.1:3017` ni el portal en `127.0.0.1:3010` aceptaban conexiones. No se inició el stack tras el reinicio del equipo, para mantener baja la carga de la máquina.

La lectura de `page.tsx` muestra que la acción `activar` espera la respuesta de `b2bService.activateOnboarding` antes de llamar a `summary.reload()`. En `CrudDirectory.tsx`, un rechazo de la acción entra en `catch`, muestra el error y no llama a `resource.reload()`; tras éxito sí recarga la tabla. Esa lectura por sí sola no sustituía la prueba de interacción. La prueba de navegador añadida en el cierre dirigido anterior cubre ahora ambos desenlaces; permanece explícito su límite de API simulada.

Se ejecutó únicamente la prueba de dominio del backend ERP (`npm test -- --runTestsByPath src/modules/b2b-sales-crm/domain/onboarding-lifecycle.spec.ts`): **11/11** y salida 0. Esa prueba confirma la regla de checklist del backend, pero no cubre la interacción pendiente del frontend. Tras ejecutarla, la carga del equipo subió por procesos de CoreSimulator y `mediaanalysisd`; no se lanzaron más pruebas.
