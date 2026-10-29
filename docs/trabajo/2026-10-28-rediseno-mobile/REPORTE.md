> **AVANCE: 4 / 6 microtareas definidas de H2 (portal de comercio, ERP) — 66,7 %. H3 (Dashboards) y H4 (DecisionEngine) no están descompuestas ni empezadas: el rediseño completo NO está terminado.**

- Fecha: 2026-10-28 · Plan: [PLAN.md](./PLAN.md) · Rama: `claude/great-shannon-fm2l7p` (AtlasERPFrontend)
- Peldaño de evidencia alcanzado: `TESTED` (type-check, lint, auth, 384 unitarias y `build` con exit 0). El aspecto se vio en capturas **contra un backend simulado**; el comportamiento con el backend real y en dispositivos reales no se ejercitó, así que no se declara `VERIFIED`.

## Completado

| ID       | Qué se logró                                                                                           | Comando de verificación                         | Resultado                                         |
| -------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------- | ------------------------------------------------- |
| H2.S1.M1 | `MerchantBottomNav` con POS, Cartera, Mi empresa y Soporte (las 4 pantallas que ya existían)           | `vitest tests/unit/merchant-bottom-nav.test.tsx` | PASS · 8 tests                                    |
| H2.S1.M2 | Barra montada solo `<lg`; «Soporte y tutoriales» flotante solo en `lg+`; asistente sobre la barra      | captura 375 px                                  | PASS · `evidencia/despues/m375_portal-gestion-pos.png` |
| H2.S1.M3 | Marca «ATLAS ERP» y avatar del portal a 44 px; avatar de la consola con área efectiva 44 px            | métrica `under44` + `elementFromPoint`          | PASS · `evidencia/salidas.txt`                    |
| H2.S2.M1 | `TabbedPanels`: difuminado del borde con pestañas ocultas y centrado de la elegida (17 pantallas)      | `vitest tests/unit/tabbed-panels-rail.test.tsx` | PASS · 6 tests · captura                          |

Gates del repo: `npx tsc --noEmit` OK · `npm run lint` OK (`--max-warnings=0`) · `npm run test:auth` OK · `npx vitest run` → `Test Files 42 passed · Tests 384 passed` · `npm run build` exit 0 (salidas en `evidencia/salidas.txt`).

## A medias

Ninguna.

## Pendiente

| ID       | Estado | Qué lo destraba                                                                                |
| -------- | ------ | ---------------------------------------------------------------------------------------------- |
| H2.S2.M2 | TODO   | Medir una tabla del portal (cartera/facturación) con datos y decidir                           |
| H2.S2.M3 | TODO   | Medir el formulario de «Mi empresa» a 375 px                                                   |
| H3       | TODO   | Abrir `PLAN.md` en AtlasDashboardsFrontend con línea base                                      |
| H4       | TODO   | Abrir `PLAN.md` en AtlasDecisionEngineFrontend con línea base                                  |

## Evidencia

- `evidencia/base/` (antes) y `evidencia/despues/` (después): 375, 768 y 1280 px.
- `evidencia/salidas.txt`: comandos y salidas literales (recortadas).
- Datos de las capturas **sintéticos y declarados** (`Comercio Sintético SRL`, `@example.test`).

## No cubierto

- **Backend real**: nunca se ejercitó; sesión de comercio e interna simuladas con rutas de Playwright. El portal salió con su aviso «Tu comercio todavía no tiene expediente» porque las listas simuladas están vacías: es un estado real de la pantalla, no un defecto.
- **Dispositivos reales** (iOS Safari, Android): solo emulación de Chromium. `env(safe-area-inset-bottom)` y `mask-image` en el carril de pestañas no se vieron en Safari.
- **Pantallas con datos**: ninguna tabla ni formulario del portal se midió con filas; solo estados vacíos.
- **Cartera, facturación, Mi empresa, Soporte**: solo se capturó Cartera (vacía) y Gestión POS. Las otras no se fotografiaron.
- **E2E de Playwright** (`e2e/`): no se ejecutaron (requieren backend y credenciales).
- **Tutoriales guiados** (`TutorialOverlay`): no se ejecutó ningún recorrido en móvil. Se comprobó por búsqueda que ningún paso referencia `portal-soporte`, pero un recorrido que apunte a `portal-nav` (menú lateral) en `<lg` ya apuntaba a un elemento oculto antes de este cambio.
- **Consola interna** `/operaciones`: solo se midió la cabecera; sus pantallas no se rediseñaron (decisión en el plan).

## Desvíos del plan

- Se añadió H2.S2.M1 (pista de desplazamiento en pestañas) al medir; está en el plan.
- El criterio de H2.S1.M2 se **corrigió** durante la verificación: decía «ningún texto tapado» y la captura muestra que el botón del asistente sigue flotando sobre el borde del texto. Lo que queda resuelto es el botón de soporte.

## Riesgos residuales

- En `lg+` el botón flotante «Soporte y tutoriales» **sigue pisando texto** (la captura a 1280 px lo muestra sobre el recuadro azul «Por qué no puede editar nada»). Es anterior a este cambio y no se tocó; hay que decidir si ese botón debería irse también del escritorio (el lateral ya tiene un lugar posible).
- Los enlaces «Abrir →» de la consola (44×16 px) no llegan ni a 24 px de alto: inline en tarjetas, anteriores, sin tocar.
- `TabbedPanels` centra la pestaña elegida moviendo `scrollLeft` en cada cambio de pestaña, también en escritorio donde no hay desplazamiento; en ese caso es un no-op, pero no se midió con las 17 pantallas.
- El jsdom no aplica CSS: la apariencia del difuminado y de la barra se vio solo en capturas.
- ERP no tiene `jest-dom` en Vitest; las pruebas nuevas usan DOM plano. Si se añade `jest-dom` más adelante convendría unificar el estilo.

## Decisiones y ambigüedades

- La consola interna NO recibe barra inferior: a 375 px su cabecera ya cabe y es una consola de gestión para personal. A confirmar con producto.
- Se conserva la hamburguesa y el cajón del portal del comercio porque ahí se identifica a quien opera («Acceso delegado (staff)»), algo que `MerchantPortalShell.tsx` pide dejar claro en pantalla. A confirmar.
- Las etiquetas de la barra se acortan («POS», «Cartera») para que quepan cuatro en 375 px; «Mi empresa» y «Soporte» conservan su nombre. A confirmar con quien mantiene los textos del portal.
- Entorno: `yarn install` necesitó `--ignore-engines`; no se tocó `package.json`.
