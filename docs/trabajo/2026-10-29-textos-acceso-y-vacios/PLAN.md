# Plan — ERP: textos de acceso y estados vacíos del portal de comercio

- Fecha: 2026-10-29 · Repos afectados: AtlasERPFrontend (rama `claude/great-shannon-fm2l7p`) · Predecesor: `docs/trabajo/2026-10-28-rediseno-mobile/` y el plan equivalente de AtlasAdminPortal (`2026-10-29-textos-acceso-y-vacios`), donde están los criterios de marketingskills aplicados y cuáles no.
- Resultado observable: un comercio que abre una lista vacía lee qué muestra esa lista y, si filtró, cómo ver más; quien no recibe el código de acceso sabe qué hacer.
- Kill-test: abrir «Historial de la caja» con un filtro sin resultados y leer «No hay nada con estos filtros.» sin decir cómo seguir.

## Diagnóstico (modo B/C de `copy-editing`: la voz del portal es del autor)

- El acceso ya está bien: el cliente de API convierte los fallos de red en «No hay conexión con el sistema. Revise su internet e inténtelo otra vez.», así que los textos de reserva del login casi no se alcanzan. **No se tocan.**
- Los cuatro estados «esperando» (solicitudes, comprobantes, pagos iniciales, QR) ya dicen qué es y cuándo aparecerá algo. **No se tocan.**
- Sí hay deuda en frases sueltas sin explicación ni salida y en el código que no llega.

## Alcance

- IN: ayuda del código de acceso que no llega (`app/login/page.tsx`); vacíos de `MerchantPosHistoryScreen` (con y sin filtros), `MerchantPortfolioScreen` (3) y el filtro de cuotas de `MerchantBillingScreen`.
- OUT: la consola interna `/operaciones`, reescribir el acceso, unificar la voz (el portal mezcla «usted» y «tú»: decisión de marca, no mía), crear un componente de estado vacío (hay 23 bloques ad hoc; migrarlos sería un refactor no pedido), backend, añadir «reenviar código».
- Ambigüedades registradas: ver las del plan de AdminPortal sobre el código que no llega («pulsa Usar otra cuenta para volver a empezar» supone que permite pedir otro). A confirmar.

## H1 — Textos del portal de comercio

**CA:** Dado un comercio con una lista vacía, cuando la abre, entonces ve qué muestra y, con filtros, cómo ver más; dado el código de acceso que no llega, ve qué hacer.
**DoD:** `npm run check` (type-check, lint, auth, unitarias, build) exit 0 · captura 375 px de un vacío con y sin filtros · `evidencia/textos.md`.
**Estado:** HECHO

| ID    | Microtarea                                                         | CA (binario)                                         | DoD (comando de verificación)           | Estado |
| ----- | ------------------------------------------------------------------ | ---------------------------------------------------- | --------------------------------------- | ------ |
| H1.M1 | Vacíos de historial del POS (con/sin filtros), cartera (3) y cuotas | Cada uno dice qué muestra y la salida que corresponde | captura + `grep` de los textos          | HECHO |
| H1.M2 | Ayuda del código de acceso que no llega                            | Aparece en el paso del código                        | `vitest` de la frase                    | HECHO |

## Riesgos y bloqueos previstos

| Riesgo | Impacto | Mitigación |
| ------ | ------- | ---------- |
| Un texto afirma algo que el sistema no hace | Pérdida de confianza | Cada texto reutiliza lo que dice el título o la descripción de su propio panel |
| Mezcla de «usted» y «tú» | Voz inconsistente | Cada pantalla conserva la persona gramatical que ya usa |
