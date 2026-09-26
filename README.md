# ATLAS ERP Web

Frontend Next.js 15 reconstruido a partir de las vistas originales de Stitch Phase 1. La interfaz conserva la jerarquía visual, densidad operativa y flujos especializados del diseño ATLAS; la integración con el backend vive debajo de la UI y no reemplaza las pantallas por tablas o editores JSON genéricos.

## Stack

- Next.js 15 App Router.
- React 19.
- TypeScript estricto.
- Tailwind CSS.
- Componentes pequeños y especializados.
- API centralizada exclusivamente en `lib/apiClient.ts`.

## Capas

```txt
app/          Rutas, layouts y composición.
components/   Sistema visual, shells y pantallas especializadas.
hooks/        Estado asíncrono, debounce y mutaciones.
services/     Contratos de API por dominio.
lib/          Cliente HTTP, rutas, formatos y utilidades puras.
docs/         Auditoría contra las vistas originales.
```

## Áreas separadas

- `/operaciones`: CRM B2B, contabilidad, publicidad, auditoría y administración.
- `/portal-comercio`: operaciones propias del comercio.

Cada área usa su propio shell de navegación. No se mezclan permisos ni navegación operativa con la del comercio.

## Dos poblaciones, dos sesiones

`/login` ofrece dos accesos porque detrás hay dos identidades distintas, no dos estilos de la misma:

| Población        | Endpoint                | Identidad                                        |
| ---------------- | ----------------------- | ------------------------------------------------ |
| Personal Atlas   | `auth/login`            | Usuarios internos de AtlasBackend, con RBAC      |
| Comercio afiliado| `auth/merchant/login`   | `iam.merchant_users` de AtlasBackend, sin RBAC   |

Un comercio **no tiene permisos**: lo que puede tocar lo decide el backend contra sus membresías
(`atlas_sales.merchant_users`), no una lista de permisos en el token. Por eso `hasPermission()`
devuelve siempre `false` para él y las pantallas del portal no deciden nada con eso.

`RequireAuth` recibe la población esperada (`audience`) y devuelve a cada quien a su sección: un
comercio autenticado no navega `/operaciones`, donde sólo encontraría una consola que falla
endpoint por endpoint.

`useMerchantScope()` resuelve sobre qué comercio trabaja cada pantalla del portal: el staff interno
elige (y queda auditado como acceso delegado), el comercio no elige nada —su alcance lo deriva el
backend— y por eso no ve el selector. Antes todas las pantallas asumían siempre lo primero, con un
selector alimentado por `b2b/accounts`, un endpoint interno que un comercio ni siquiera puede
llamar: el portal sólo era usable por personal de Atlas.

## Ayuda en pantalla

Cada vista lleva junto a su título un botón **«¿Qué es esto?»** que explica qué
es esa pantalla, qué se hace en ella y qué mirar cuando algo falla; las que tienen
recorrido guiado llevan además **«Recorrido»**, que señala los elementos reales
paso a paso. El catálogo completo está en `/operaciones/tutoriales`.

Los dos botones se resuelven por la RUTA desde `WorkspaceHeader`, así que ninguna
pantalla tiene que declararlos y no hay forma de olvidarse de uno. Cómo añadir
contenido: `docs/tutoriales.md`.

### Ningún campo sin «qué poner»; ninguna opción sin «qué significa»

- Todo campo lleva `tooltip`: una frase que dice qué poner y por qué importa, con
  ejemplo si el formato no es obvio. Se abre al pasar por el ⓘ de la etiqueta y al
  enfocar el control con el teclado (`components/atlas/FieldTooltip.tsx`). El `hint`
  sigue siendo el texto corto siempre visible bajo el control.
- Toda opción de un select lleva `description`: qué significa y cuándo elegirla. Se ve
  en la fila de la lista desplegada y la elegida la repite bajo el campo. Los dominios
  del backend la traen como `help` de `GET /catalog/domains`; las listas de
  `lib/catalogs.ts` la llevan escrita; las opciones que son filas (cuentas, socios) la
  generan por plantilla en `services/optionLoaders.ts`.
- No hay `<select>` nativo: un `<option>` no admite tooltip propio (Safari y el móvil no
  pintan `title=`, y el lector no lo lee). Se usa `OptionSelect` (o `FormField
  kind="select"`), un combobox ARIA con teclado completo y buscador a partir de ocho
  opciones. En los E2E: `getByTestId('select-<name>')` y `getByRole('option')`.
- Prohibido repetir la etiqueta. `scripts/check-ayuda.mjs` (en `yarn lint`) falla si
  falta un `tooltip`, una `description`, si el texto repite la etiqueta o tiene menos de
  cuatro palabras, o si aparece un `<select>` nativo. Excepción: `// sin-ayuda: <motivo>`.

## Diseño aplicado

Se aplicó `atlas_erp/DESIGN.md` de las vistas originales:

- Navy institucional y superficies slate.
- Inter para UI y monoespaciada para identificadores.
- Bordes sutiles y poca sombra.
- Tablas densas, formularios en grid y estados semánticos.
- Énfasis en trazabilidad, revisión y auditoría.

## Configuración

```bash
cp .env.example .env.local
```

```env
NEXT_PUBLIC_ATLAS_API_BASE_URL=
NEXT_PUBLIC_ATLAS_DEFAULT_PAGE_SIZE=25
```

## Instalación y validación

```bash
corepack yarn@1.22.22 install --frozen-lockfile
corepack yarn@1.22.22 type-check
corepack yarn@1.22.22 lint
corepack yarn@1.22.22 test:auth
corepack yarn@1.22.22 test:unit
NEXT_TELEMETRY_DISABLED=1 CI=1 corepack yarn@1.22.22 build
```

Validación integral:

```bash
NEXT_TELEMETRY_DISABLED=1 CI=1 corepack yarn@1.22.22 check
```

## Ejecución

```bash
npm run dev
```

Rutas principales:

```txt
http://localhost:3000/operaciones
http://localhost:3000/portal-comercio/compras-bnpl
```

## Estados de interfaz

- Skeletons durante navegación y primera carga.
- Indicador de actualización sin desmontar datos previos.
- Botones bloqueados y con spinner durante mutaciones.
- Estados vacíos, de error y de éxito explícitos.
- Formularios con validación local antes de enviar.
- Tablas con paginación server-side.

## Hidratación

El render inicial evita valores no determinísticos. UUIDs nuevos se generan únicamente después de interacciones del cliente. No se ocultan advertencias con `suppressHydrationWarning` global.

## Verificación posterior al despliegue

El workflow de `dev` espera a que Coolify termine y consulta el dominio publicado: portada,
login, JS/CSS, proxy `/api/v1/health` y `/version`. Este último expone el SHA servido, inyectado
desde `SOURCE_COMMIT`, y debe ser exactamente el que pasó CI. Después Chromium abre el login
y falla si la página lanza un error JavaScript. Si Coolify no informa el dominio, se configura
`DEV_SMOKE_BASE_URL` en GitHub Variables. El dominio público de este portal puede usar `:3010`;
el smoke conserva ese puerto.

## Autenticación local

El cliente conserva el access token solo en memoria y envía:

```http
Authorization: Bearer <token>
```

Al recargar, renueva la sesión mediante la cookie de refresh `HttpOnly` del gateway; cualquier
`atlas_access_token` antiguo en `localStorage` se elimina sin reutilizarlo.

El bypass del backend solo debe usarse en desarrollo:

```env
AUTH_DISABLED_FOR_LOCAL_TESTING=true
```

## Cabeceras de seguridad

`middleware.ts` emite una CSP con nonce distinto por petición. El layout raíz usa render dinámico
para que Next coloque ese nonce en los scripts de cada respuesta; esto desactiva la generación
estática de las páginas y aumenta el trabajo del servidor por request. `next.config.ts` contiene
las demás cabeceras estáticas, sin una segunda CSP. El cliente usa el proxy `/api/v1` del mismo
origen si `NEXT_PUBLIC_ATLAS_API_BASE_URL` no está configurada.
Las cargas directas con URL firmada necesitan `ATLAS_UPLOAD_ORIGINS` en el servidor:
una lista separada por comas de orígenes HTTPS exactos del almacenamiento autorizado.
Sin esa variable, la CSP bloqueará cargas a otros orígenes.

## Regla de red

No se permite `fetch` en componentes, rutas, hooks o services. Toda llamada debe pasar por `lib/apiClient.ts` y por el service correspondiente.

## Auditoría de vistas

La matriz completa de correspondencia entre las 39 capturas originales y las rutas reconstruidas está en:

```txt
docs/original-view-audit.md
```
