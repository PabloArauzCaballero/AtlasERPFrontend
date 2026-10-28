# Plan — ERP: portal de comercio que se usa con el pulgar

- Fecha: 2026-10-28 · Repos afectados: AtlasERPFrontend (rama `claude/great-shannon-fm2l7p`) · Predecesor: `AtlasAdminPortal/docs/trabajo/2026-10-28-rediseno-mobile/PLAN.md` (H1; el patrón de barra inferior sale de allí)
- Resultado observable: un comercio que abre el portal desde un teléfono (375 px) llega a sus cuatro destinos (Gestión POS, Cartera y facturación, Mi empresa, Soporte) con una barra inferior, y ningún botón flotante tapa el texto de la pantalla.
- Kill-test: abrir `/portal-comercio/gestion-pos` a 375 px con el estado vacío y ver el botón «Soporte y tutoriales» pintado encima del texto del vacío.

## Alcance

- IN: `MerchantPortalShell` (barra inferior móvil, retirada del botón flotante de soporte en `<lg`, posición del asistente, relleno inferior), objetivos táctiles de la cabecera del portal y de la consola.
- OUT: la consola interna `/operaciones` (ver decisión), backend, contratos, permisos, rutas, el sistema de colores, service worker, commit de otros repos.
- Decisión registrada: **la consola interna NO recibe barra inferior.** A 375 px su cabecera ya cabe (menú, marca, buscar, «+», avatar) y es una consola de gestión profunda para personal; no hay un motivo medido. Se corrigen solo sus objetivos táctiles.
- Ambigüedades registradas:
  - El menú del comercio se achicó a propósito (de 12 a 5 entradas, ver `navigation.ts`); la barra inferior reutiliza esas mismas 4 pantallas y no añade ninguna. A confirmar con producto que «Mi empresa» y «Soporte» deben ser pestañas y no solo el avatar y un botón flotante.
  - Se conserva la hamburguesa y el cajón del portal porque ahí vive la identificación de quien opera («Acceso delegado (staff)»): `MerchantPortalShell.tsx` explica que debe quedar clara en pantalla. A confirmar.

## Línea base medida (375×812; sesión y listas SIMULADAS, no es el backend real)

Evidencia: `evidencia/base/`.

| # | Hallazgo | Motivo legítimo para cambiarlo |
| - | -------- | ------------------------------ |
| 1 | El botón flotante «Soporte y tutoriales» se pinta sobre el texto del estado vacío («No hay nad…», «Cuando un cliente escanee…») | Tapa contenido; `pb-36` (9 rem) de relleno no basta cuando hay dos botones apilados |
| 2 | Los 2 destinos del portal están tras la hamburguesa; «Mi empresa» tras el avatar y «Soporte» en un flotante | Alcance del pulgar; son 4 destinos que caben en una barra |
| 3 | Las pestañas de la pantalla se cortan («Comprobantes por ve…») sin pista de desplazamiento | Contenido inalcanzable sin saber que se desliza |
| 4 | Avatar del portal 44×40; avatar de la consola 36×36; enlace «ATLAS ERP» 84×24 | Por debajo de 44 px en puntero grueso |

## H2 — Portal de comercio móvil

**CA:** Dado un comercio en un teléfono de 375 px, cuando abre cualquier pantalla del portal, entonces ve una barra inferior con sus cuatro destinos y el activo marcado, ningún botón flotante tapa texto, y en escritorio el portal queda igual.
**DoD:** `npm run check` (type-check, lint, tests de auth y unitarios, build) con exit 0 · capturas a 375/768/1280 revisadas · consola sin errores nuevos.
**Estado:** A MEDIAS (S1 hecha y verificada contra backend simulado; S2 solo con las pestañas)

### H2.S1 — Barra inferior y botones flotantes

**CA:** Dado `<lg`, entonces la barra lleva Gestión POS, Cartera, Mi empresa y Soporte; «Soporte y tutoriales» flotante desaparece (la barra lo reemplaza) y el asistente sube sobre la barra.
**DoD:** test unitario de la barra; capturas a 375 px.
**Estado:** HECHO

| ID       | Microtarea                                                                                      | CA (binario)                                              | DoD (comando de verificación)                       | Estado |
| -------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------- | ------ |
| H2.S1.M1 | `MerchantBottomNav` con las 4 pantallas ya existentes y activo con `aria-current`               | No añade rutas; Cartera activa también en `/facturacion`  | `vitest merchant-bottom-nav` → 8 tests                | HECHO  |
| H2.S1.M2 | Montarla en `MerchantPortalShell` solo `<lg`; ocultar el flotante de soporte `<lg`; subir el asistente; relleno de `main` | «Soporte y tutoriales» ya no tapa texto; el asistente sigue flotando (inherente a un FAB) y el relleno final evita que tape la última fila | captura 375 px (`despues/m375_portal-gestion-pos.png`) | HECHO  |
| H2.S1.M3 | Objetivos táctiles de 44 px: avatar del portal, avatar y marca de la consola                    | `under44` vacío en la cabecera a 375 px                   | `under44: []` en el portal; avatar de la consola: área efectiva 44 px (ver `salidas.txt`) | HECHO  |

### H2.S2 — Pestañas y tablas del portal

**CA:** Dado una pantalla con pestañas más anchas que el teléfono, entonces se ve que hay más a la derecha y la pestaña elegida se centra.
**DoD:** `vitest tabbed-panels-rail`; captura a 375 px.
**Estado:** A MEDIAS

| ID       | Microtarea                                                                                  | CA (binario)                                       | DoD (comando de verificación)                                | Estado |
| -------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------ | ------ |
| H2.S2.M1 | `TabbedPanels`: difuminado del borde con pestañas ocultas y centrado de la elegida (17 usos) | «Comprobantes por ver…» se desvanece, no se corta  | `vitest tabbed-panels-rail` → 6 tests; captura               | HECHO  |
| H2.S2.M2 | Tablas del portal en móvil (cartera, facturación) con datos                                  | Medir una con datos y decidir                      | —                                                            | TODO   |
| H2.S2.M3 | Formularios del portal (Mi empresa) en móvil                                                 | Medir y decidir                                    | —                                                            | TODO   |

## H3 — AtlasDashboardsFrontend · H4 — AtlasDecisionEngineFrontend

Cada uno abre su propio `PLAN.md` en su repo, con línea base medida, antes de escribir código allí.
**Estado:** TODO

## Riesgos y bloqueos previstos

| Riesgo | Impacto | Mitigación |
| ------ | ------- | ---------- |
| Sin backend real | Las capturas prueban layout, no comportamiento | Etiquetar como backend simulado; peldaño máximo `VERIFIED_FUNCTIONAL_ONLY` |
| El tutorial apunta al flotante de soporte | Un recorrido resaltaría un elemento oculto | `data-tutorial-id="portal-soporte"` solo existe en el flotante; no hay pasos que lo referencien (grep) |
| `jsdom`/Node del entorno | `yarn install` falla por engines | `--ignore-engines` solo en este entorno |
