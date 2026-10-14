# Plan — DDD y código expresivo: Acciones de la cola de onboarding

- Fecha: 2026-09-22 · Repo: AtlasERPFrontend (frontend web) · Predecesor: ninguno en esta pasada
- Resultado observable de esta pasada: flujo, regla, evidencia y próxima comprobación definidos sin modificar producto.
- Kill-test: si no se puede seguir `app/operaciones/crm/onboarding/page.tsx` → `services/b2bService.ts`, el diagnóstico no está completo.

## Alcance

- IN: `app/operaciones/crm/onboarding/page.tsx`, `services/b2bService.ts`, contrato y prueba de referencia del flujo.
- OUT: migraciones, cambios de API, UX o reglas no confirmadas; resto del repo.
- Ambigüedad registrada: No duplicar la compuerta KYB del backend en la página.

## H1 — Diagnóstico y referencia

**CA:** Dado el flujo existente, cuando se inspeccionan entrada, decisión y resultado, entonces la regla tiene un propietario y una prueba de referencia identificables.
**DoD:** inspección de los archivos citados y `npm run type-check` con el resultado literal del reporte.
**Estado:** HECHO

### H1.S1 — Rastrear y probar

**CA:** Dado el checkout actual, cuando se sigue el flujo, entonces se distingue regla de coordinación. **DoD:** rutas y símbolos reales registrados abajo. **Estado:** HECHO

| ID | Microtarea | CA (binario) | DoD (comando de verificación) | Estado |
|---|---|---|---|---|
| H1.S1.M1 | Localizar entrada y propietario | Ambas rutas existen y se identificó la regla | `test -f 'app/operaciones/crm/onboarding/page.tsx' && test -f 'services/b2bService.ts'` → salida 0 | HECHO |
| H1.S1.M2 | Fijar referencia | El chequeo dirigido termina con salida 0 | `npm run type-check` → TypeScript sale con código 0; no se ejecutó test de interacción | HECHO |

**Regla observada:** La activación se solicita al ERP; el cliente debe mostrar el resultado confirmado.

## H2 — Próxima capacidad acotada

**CA:** Dado el contrato confirmado, cuando se ejerce la condición límite del flujo, entonces el resultado visible o persistido coincide con la regla y un rechazo no produce efecto parcial.
**DoD:** prueba de comportamiento dirigida, verificación de contrato y recorrido real si se modifica código; reporte con salida literal.
**Estado:** HECHO

### H2.S1 — Confirmar semántica antes de refactorizar

**CA:** La condición límite tiene resultado esperado documentado. **DoD:** prueba dirigida y revisión del contrato vigente. **Estado:** HECHO

| ID | Microtarea | CA (binario) | DoD (comando de verificación) | Estado |
|---|---|---|---|---|
| H2.S1.M1 | Probar la acción activar con rechazo 409 y actualización de la cola tras éxito; extraer estado de la petición solo si la prueba evidencia mezcla con estado remoto. | Hay un caso verificable y no cambia reglas hipotéticas | `npx playwright test e2e/onboarding-activacion.simulada.spec.ts --project=chromium --workers=1` → 2/2; contrato del backend revisado y suite dirigida 22/22 | HECHO |

## Riesgos y bloqueos previstos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| No duplicar la compuerta KYB del backend en la página. | Resultado o contrato falso | Confirmar con código, contrato y prueba antes de editar producto |

## Decisión de diseño

El propietario observado es `services/b2bService.ts`. No se introduce una capa DDD nueva por nombre. Una refactorización futura necesitará mostrar una llamada más clara y la misma semántica en la entrada real, con prueba roja antes de cambiar implementación. Si la comprobación H2 demuestra que el diseño actual ya protege la regla, se registra como DESCARTADO el cambio de código.
