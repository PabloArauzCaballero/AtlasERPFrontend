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
NEXT_PUBLIC_ATLAS_API_BASE_URL=http://localhost:3000/api/v1
NEXT_PUBLIC_ATLAS_DEFAULT_PAGE_SIZE=25
```

## Instalación y validación

```bash
npm ci
npm run type-check
npm run lint
NEXT_TELEMETRY_DISABLED=1 CI=1 npm run build
```

Validación integral:

```bash
NEXT_TELEMETRY_DISABLED=1 CI=1 npm run check
npm audit --omit=dev
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

## Autenticación local

El cliente lee `atlas_access_token` desde `localStorage` y envía:

```http
Authorization: Bearer <token>
```

El bypass del backend solo debe usarse en desarrollo:

```env
AUTH_DISABLED_FOR_LOCAL_TESTING=true
```

## Regla de red

No se permite `fetch` en componentes, rutas, hooks o services. Toda llamada debe pasar por `lib/apiClient.ts` y por el service correspondiente.

## Auditoría de vistas

La matriz completa de correspondencia entre las 39 capturas originales y las rutas reconstruidas está en:

```txt
docs/original-view-audit.md
```
