# Rediseño de Cuotea en el ERP y el portal del comercio (2026-11-10)

Ejecuta `PLAN-02-erp.md` (carpeta `_plan-rediseno-visual-cuotea-2026-11-10`), seis fases, un PR por fase contra `dev`.

| Fase | PR | Qué entregó |
|---|---|---|
| 1 | #81 | Tokens en variables CSS (claro y oscuro), Tailwind remapeado, script de tema con nonce, prueba de contraste, acento escrito a mano a tokens |
| 1b | #83 | Fuentes con `next/font/local` (plan B): la descarga de Google fallaba de forma intermitente en CI |
| 2 | #82 | Primitivas: botón de marca, campos, píldoras, paneles, diálogos |
| 3 | #84 | Armazón plano, login con panel amarillo, logo e iconos, conmutador de tema; se retira el fondo ambiental |
| 4 | #85 | Valores sueltos a tokens, cartel del QR, un amarillo por vista, guardián `check-colores` en `yarn lint` |
| 5 | #87 | «Cuotea» en todo lo visible |
| 6 | este PR | Barrido final, tema por defecto «sistema», evidencia |

## Cifras del barrido

`scripts/barrido-visual.mjs`: 64 páginas × 2 temas × 3 anchos = 384 capturas, 0 hallazgos (sin errores de página, sin desbordes horizontales, tema aplicado, ningún texto de menos de 12 px). En la línea de partida (solo claro) había 381 hallazgos.
Para que `/portal-comercio/facturacion` cargara en el barrido hubo que ampliar el doble de la API (`/portal/scope` y `/partner-onboarding/mine` tienen otra forma que `{ items, total }`); no cambió ninguna pantalla.

## Excepciones del guardián de colores

- `app/tema.css`: es la capa de tema.
- `lib/coloresImpresos.ts`: un lienzo que se imprime no lee variables CSS y el papel no tiene tema oscuro.
- `lib/qr.ts`: un QR es negro sobre blanco en cualquier tema.
- `colores-ok` por línea (5): dos `themeColor` de `app/layout.tsx` (una etiqueta `<meta>` no lee variables) y tres máscaras de recorte del carril en `app/globals.css` (no pintan color).

## Desvíos respecto del plan

- Fuentes: `next/font/local` en lugar de `next/font/google` (ver #83). Sólo el subconjunto latino de Outfit (400-600, variable) y de JetBrains Mono.
- Fase 4: en `LiveDirectoryScreen`, `CrudDirectory`, `CampaignWizard` y `CampaignDetailModal` los dos botones primarios son alternativas excluyentes; se dejan primarios.
- Fase 5: `tests/unit/guia-pdf.test.ts` ahora afirma el prefijo `Cuotea-Guia-` del nombre de descarga (el `href` sigue apuntando a `ATLAS-Guia-…pdf`).
- Fase 6: el conmutador de tema del portal del comercio muestra sólo iconos (con nombre accesible) porque la columna lateral de 220 px recortaba «Sistema».

## Dudas abiertas (de Pablo)

D1 botón secundario (se creó `strong` para el de tinta) · D2 velo de las capas flotantes (tinta al 45 % y 70 %) · D3 iconos Material Symbols aún de Google Fonts · D4 asunto del correo «ATLAS — Tu cuenta fue creada» (lo emite AtlasBackend) · D5 razón social del emisor de la factura · D6 voz de tú en el portal del comercio · D7 guías en PDF (`_herramientas/manuales-pdf`) · D8 radio de tarjeta de marca · D9 `AtlasAssist` huérfano.

## Evidencia

`evidencia/*.jpg`: antes (claro) · después (claro) · después (oscuro), a 1280 px, de seis pantallas. `evidencia/cartel-qr.png`: el cartel del QR con la marca. Las capturas de `docs/visual-evidence/` se regeneraron con las baterías de navegador ya con la marca nueva.
