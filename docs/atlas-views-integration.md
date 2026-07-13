# Integración de vistas Stitch Phase 1 con backend ATLAS

## Alcance aplicado

Se agregó un frontend Next.js 15 en `frontend/atlas-erp-web` para acoplar las vistas recibidas contra el backend integrado existente.

La integración respeta estas reglas:

- `app/` solo compone rutas.
- `components/` solo renderiza UI reutilizable.
- `hooks/` maneja estado de carga, error, vacío y éxito.
- `services/` llama a la API por dominio.
- `lib/apiClient.ts` es el único archivo que ejecuta `fetch`.
- No se mezclan permisos entre Portal comercio y Panel operaciones.
- Las tablas enmascaran PII básica como email, teléfono y NIT/taxId.
- Los montos se formatean en BOB cuando corresponde.

## Estado de acople por tipo

| Estado | Significado |
|---|---|
| integrada | La vista tiene lectura real contra endpoint existente. |
| solo-accion | El backend permite ejecutar comandos, pero no expone listado para renderizar la pantalla completa. |
| brecha-backend | La vista existe en los ZIP, pero el backend recibido no tiene contrato API para ella. |

## Vistas con integración activa de lectura

- Cuentas B2B → `GET /api/v1/b2b/accounts`.
- Cuentas GL → `GET /api/v1/accounting/financial-structure/gl-accounts`.
- Business partners → `GET /api/v1/accounting/business-partners`.
- Dashboard Ads → `GET /api/v1/admin/ads/dashboard`.
- Directorio de anunciantes → `GET /api/v1/admin/ads/advertisers`.
- Gestión de campañas → `GET /api/v1/admin/ads/campaigns`.
- Cola de moderación Ads → `GET /api/v1/admin/ads/moderation/queue`.
- Monitor delivery y fraude → `GET /api/v1/admin/ads/delivery-monitor`.
- Business Action Log → `GET /api/v1/audit/business-actions`.

## Vistas acopladas como comandos

Estas pantallas usan endpoints reales, pero el backend no ofrece todavía endpoint de listado completo:

- Crear cuenta B2B.
- Calificar cuenta.
- Bulk cuentas B2B.
- Pipeline de oportunidades.
- Propuesta comercial.
- Cola de aprobaciones.
- Contrato comercial.
- Onboarding y activación de comercio.
- Sucursales y usuarios merchant.
- Registrar compra BNPL.
- Facturación B2B.
- Conciliación y cobertura.
- Estructura financiera contable.
- Impuestos y COA.
- Periodos, ledgers, sucursales y años fiscales.
- Contratos contables.
- Documentos contables, bulk documentos, factura AR, recibos y cierres.
- Bulk anunciantes Ads.

## Brechas backend detectadas

| Vista Stitch | Brecha | Recomendación |
|---|---|---|
| Administración de usuarios y seguridad | No existe módulo API de usuarios, roles ni permisos administrables. | Crear módulo `admin-security` con usuarios, roles, permisos y auditoría. |
| Centro de notificaciones y alertas | No hay endpoints de notificaciones, preferencias ni estado leído/no leído. | Crear módulo `notifications` con bandeja y preferencias por usuario. |
| Centro de comando y búsqueda global | No existe búsqueda federada multi-módulo. | Crear `GET /api/v1/search` con whitelist de módulos, paginación y permisos por dominio. |
| Pipeline, aprobaciones y algunas vistas contables | Hay comandos, pero faltan listados específicos. | Agregar endpoints `GET` separados, no reutilizar comandos ni consultar tablas directamente desde frontend. |

## Cómo ejecutar

```bash
cd frontend/atlas-erp-web
cp .env.example .env.local
npm install
npm run dev
```

Para pruebas locales rápidas del backend, puede activarse `AUTH_DISABLED_FOR_LOCAL_TESTING=true` en el backend. En producción esa variable está bloqueada por validación de entorno.

## Notas de cautela

No se inventaron endpoints faltantes. Las vistas con brecha muestran un bloqueo explícito para evitar una integración falsa que falle en producción.
