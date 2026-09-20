export type ViewArea = 'Panel operaciones' | 'Portal comercio';
export type ViewStatus = 'integrada' | 'solo-accion' | 'brecha-backend';

export interface AtlasViewLink {
  area: ViewArea;
  phase: string;
  title: string;
  href: string;
  status: ViewStatus;
  backend: string;
}

export const atlasViewLinks: AtlasViewLink[] = [
  { area: 'Panel operaciones', phase: 'CRM B2B', title: 'Cuentas B2B', href: '/operaciones/crm/cuentas', status: 'integrada', backend: 'GET /b2b/accounts' },
  { area: 'Panel operaciones', phase: 'CRM B2B', title: 'Crear cuenta B2B', href: '/operaciones/crm/cuentas/crear', status: 'solo-accion', backend: 'POST /b2b/accounts' },
  { area: 'Panel operaciones', phase: 'CRM B2B', title: 'Detalle de cuenta', href: '/operaciones/crm/cuentas/detalle', status: 'solo-accion', backend: 'GET /b2b/accounts/:id' },
  { area: 'Panel operaciones', phase: 'CRM B2B', title: 'Calificar cuenta', href: '/operaciones/crm/cuentas/calificar', status: 'solo-accion', backend: 'POST /b2b/accounts/:accountId/qualify' },
  { area: 'Panel operaciones', phase: 'CRM B2B', title: 'Pipeline comercial (oportunidades, tablero y propuestas)', href: '/operaciones/crm/oportunidades', status: 'solo-accion', backend: 'POST/PATCH /b2b/opportunities' },
  { area: 'Panel operaciones', phase: 'CRM B2B', title: 'Propuestas comerciales (pestaña del pipeline)', href: '/operaciones/crm/propuestas', status: 'integrada', backend: 'GET /b2b/proposals · PATCH /b2b/proposals/:id/{send,accept,reject}' },
  { area: 'Panel operaciones', phase: 'CRM B2B', title: 'Nueva propuesta comercial', href: '/operaciones/crm/propuestas/crear', status: 'solo-accion', backend: 'POST /b2b/proposals' },
  { area: 'Panel operaciones', phase: 'CRM B2B', title: 'Excepciones comerciales (pestaña del pipeline)', href: '/operaciones/crm/aprobaciones', status: 'solo-accion', backend: 'PATCH /b2b/proposals/approvals/:id/decision' },
  { area: 'Panel operaciones', phase: 'CRM B2B', title: 'Contrato comercial', href: '/operaciones/crm/contratos', status: 'solo-accion', backend: 'POST/PATCH /b2b/contracts' },
  { area: 'Panel operaciones', phase: 'CRM B2B', title: 'Onboarding comercio', href: '/operaciones/crm/onboarding', status: 'integrada', backend: 'GET/POST/PATCH /b2b/onboarding · PATCH /b2b/onboarding/cases/:id/activate' },
  { area: 'Panel operaciones', phase: 'CRM B2B', title: 'Nuevo caso de onboarding', href: '/operaciones/crm/onboarding/crear', status: 'solo-accion', backend: 'POST /b2b/onboarding/cases' },
  { area: 'Portal comercio', phase: 'Comercio', title: 'Gestión POS (solicitudes de compra y comprobantes)', href: '/portal-comercio/gestion-pos', status: 'integrada', backend: 'GET /merchant-credit/:id/applications · POST :id/applications/:appId/acceptance · GET /merchant-credit/:id/payment-claims · POST :claimId/verification' },
  { area: 'Portal comercio', phase: 'Comercio', title: 'Mi empresa (estado, ficha, QR de cobro y sucursales)', href: '/portal-comercio/expediente', status: 'integrada', backend: 'GET /partner-onboarding/mine | :id/status · PATCH :id/commercial-profile · GET/POST :id/qr-codes · POST/PATCH /portal/branches · POST :id/branches/:branchId/pos-terminals' },
  { area: 'Panel operaciones', phase: 'CRM B2B', title: 'Facturación B2B', href: '/operaciones/crm/facturacion', status: 'solo-accion', backend: 'POST /b2b/billing/*' },
  { area: 'Panel operaciones', phase: 'CRM B2B', title: 'Conciliación y cobertura', href: '/operaciones/crm/conciliacion-cobertura', status: 'solo-accion', backend: 'POST/PATCH /b2b/coverage | reconciliation' },
  { area: 'Panel operaciones', phase: 'Contabilidad', title: 'Estructura financiera', href: '/operaciones/contabilidad/estructura', status: 'solo-accion', backend: 'POST /accounting/financial-structure/*' },
  { area: 'Panel operaciones', phase: 'Contabilidad', title: 'Cuentas GL', href: '/operaciones/contabilidad/cuentas-gl', status: 'integrada', backend: 'GET/POST /accounting/financial-structure/gl-accounts' },
  { area: 'Panel operaciones', phase: 'Contabilidad', title: 'Impuestos y COA', href: '/operaciones/contabilidad/impuestos-coa', status: 'solo-accion', backend: 'POST /charts-of-accounts | tax-codes' },
  { area: 'Panel operaciones', phase: 'Contabilidad', title: 'Periodos y ledgers', href: '/operaciones/contabilidad/periodos-ledgers', status: 'solo-accion', backend: 'POST /fiscal-years | periods | ledgers' },
  { area: 'Panel operaciones', phase: 'Contabilidad', title: 'Sucursales y años fiscales', href: '/operaciones/contabilidad/sucursales-fiscales', status: 'solo-accion', backend: 'POST /branches | fiscal-years' },
  { area: 'Panel operaciones', phase: 'Contabilidad', title: 'Business partners', href: '/operaciones/contabilidad/business-partners', status: 'integrada', backend: 'GET/POST /accounting/business-partners' },
  { area: 'Panel operaciones', phase: 'Contabilidad', title: 'Contratos contables', href: '/operaciones/contabilidad/contratos', status: 'solo-accion', backend: 'POST /accounting/contracts' },
  { area: 'Panel operaciones', phase: 'Contabilidad', title: 'Documentos contables', href: '/operaciones/contabilidad/documentos', status: 'integrada', backend: 'GET /accounting/documents · POST /accounting/documents/:id/{post,reverse}' },
  { area: 'Panel operaciones', phase: 'Contabilidad', title: 'Crear documento contable', href: '/operaciones/contabilidad/documentos/crear', status: 'solo-accion', backend: 'POST /accounting/documents' },
  { area: 'Panel operaciones', phase: 'Contabilidad', title: 'Factura AR contable', href: '/operaciones/contabilidad/factura-ar', status: 'solo-accion', backend: 'POST /accounting/billing/ar-invoices' },
  { area: 'Panel operaciones', phase: 'Contabilidad', title: 'Recibos', href: '/operaciones/contabilidad/recibos', status: 'integrada', backend: 'GET/PATCH/DELETE /accounting/receipts' },
  { area: 'Panel operaciones', phase: 'Contabilidad', title: 'Registrar recibo', href: '/operaciones/contabilidad/recibos/crear', status: 'solo-accion', backend: 'POST /accounting/receipts' },
  { area: 'Panel operaciones', phase: 'Contabilidad', title: 'Cierre de periodos', href: '/operaciones/contabilidad/cierres', status: 'integrada', backend: 'GET /accounting/financial-structure/periods · POST/PATCH /accounting/closings/periods/*' },
  { area: 'Panel operaciones', phase: 'Ads', title: 'Dashboard Ads', href: '/operaciones/ads/dashboard', status: 'integrada', backend: 'GET /admin/ads/dashboard' },
  { area: 'Panel operaciones', phase: 'Ads', title: 'Directorio de anunciantes', href: '/operaciones/ads/anunciantes', status: 'integrada', backend: 'GET/POST /admin/ads/advertisers' },
  { area: 'Panel operaciones', phase: 'Ads', title: 'Gestión de campañas', href: '/operaciones/ads/campanas', status: 'integrada', backend: 'GET/POST/PATCH /admin/ads/campaigns' },
  { area: 'Panel operaciones', phase: 'Ads', title: 'Segmentos de audiencia', href: '/operaciones/ads/segmentos', status: 'integrada', backend: 'GET/POST /admin/ads/segments' },
  { area: 'Panel operaciones', phase: 'Ads', title: 'Correo de campaña', href: '/operaciones/ads/correo', status: 'integrada', backend: 'POST/GET /admin/ads/email' },
  { area: 'Panel operaciones', phase: 'Ads', title: 'Inventario, políticas y auditoría', href: '/operaciones/ads/inventario', status: 'integrada', backend: 'GET/POST /admin/ads/inventory | policies | audit' },
  { area: 'Panel operaciones', phase: 'Ads', title: 'Facturación de anunciantes', href: '/operaciones/ads/facturacion', status: 'integrada', backend: 'POST /admin/ads/billing/period-close | invoices/:id/payments' },
  { area: 'Panel operaciones', phase: 'CRM', title: 'Sucursales de comercios', href: '/operaciones/crm/sucursales', status: 'integrada', backend: 'GET/POST/PATCH /b2b/onboarding/branches' },
  { area: 'Panel operaciones', phase: 'CRM', title: 'Calificación de riesgo', href: '/operaciones/crm/calificacion-riesgo', status: 'integrada', backend: 'GET/POST /b2b/credit-rating' },
  { area: 'Panel operaciones', phase: 'Contabilidad', title: 'Condiciones de pago a proveedor', href: '/operaciones/contabilidad/condiciones-pago', status: 'integrada', backend: 'GET/POST/PATCH /accounting/supplier-payment-terms' },
  { area: 'Panel operaciones', phase: 'Contabilidad', title: 'Vínculos multientidad', href: '/operaciones/contabilidad/vinculos', status: 'integrada', backend: 'GET/POST/DELETE /accounting/*/links' },
  { area: 'Panel operaciones', phase: 'CRM', title: 'Segmentos comerciales', href: '/operaciones/crm/segmentos', status: 'integrada', backend: 'GET/POST/PATCH/DELETE /b2b/segments' },
  { area: 'Panel operaciones', phase: 'Ads', title: 'Cola de moderación', href: '/operaciones/ads/moderacion', status: 'integrada', backend: 'GET/POST /admin/ads/moderation' },
  { area: 'Panel operaciones', phase: 'Ads', title: 'Monitor delivery y fraude', href: '/operaciones/ads/delivery-monitor', status: 'integrada', backend: 'GET/PATCH /admin/ads/delivery-monitor | events' },
  { area: 'Panel operaciones', phase: 'Auditoría', title: 'Registro de actividad', href: '/operaciones/auditoria/business-actions', status: 'integrada', backend: 'GET /audit/business-actions' },
  { area: 'Panel operaciones', phase: 'Usuarios', title: 'Administración de usuarios y seguridad', href: '/operaciones/admin/seguridad', status: 'integrada', backend: 'GET/PATCH /internal/users, /internal/users/:id/roles' },
  { area: 'Panel operaciones', phase: 'Control', title: 'Campañas de notificación masiva', href: '/operaciones/admin/notificaciones', status: 'integrada', backend: 'GET/POST/PATCH /admin/notification-campaigns → AtlasBackend operations/notifications/campaigns y audience-segments' },
  { area: 'Panel operaciones', phase: 'Brecha documentada', title: 'Buscar una pantalla', href: '/operaciones/admin/busqueda-global', status: 'brecha-backend', backend: 'Sin endpoint de búsqueda global federada' },
  { area: 'Panel operaciones', phase: 'Usuarios', title: 'Gestión de roles y permisos', href: '/operaciones/admin/roles', status: 'integrada', backend: 'GET /internal/roles, /internal/permissions (solo lectura)' },
];

/**
 * Cómo se le cuenta cada estado a quien USA el ERP.
 *
 * Las claves (`solo-accion`, `brecha-backend`) son vocabulario de quien lo programa. Pintarlas tal
 * cual, junto con la ruta del endpoint, convertía el centro de comando y el mapa del sistema en un
 * informe técnico, y quien entraba a buscar una pantalla no sabía qué estaba mirando.
 */
export const viewStatusInfo: Readonly<Record<ViewStatus, { label: string; tone: 'success' | 'warning' | 'danger'; meaning: string }>> = {
  integrada: { label: 'Completa', tone: 'success', meaning: 'Muestra la información guardada y permite trabajar con ella.' },
  'solo-accion': { label: 'Sólo registrar', tone: 'warning', meaning: 'Sirve para crear o cambiar algo, pero todavía no muestra la lista de lo que ya se registró.' },
  'brecha-backend': { label: 'En construcción', tone: 'danger', meaning: 'La pantalla existe, pero al sistema aún le falta la parte que la alimenta. No es una avería.' },
};

export interface ViewModule {
  name: string;
  icon: string;
  /** Para qué sirve el módulo, en una frase y sin jerga. */
  purpose: string;
  phases: readonly string[];
}

/** Los módulos con el MISMO nombre que en el menú lateral: así el mapa y el menú se reconocen. */
export const viewModules: readonly ViewModule[] = [
  { name: 'CRM', icon: 'business_center', purpose: 'Comercios y empresas clientes: cuentas, oportunidades, contratos y facturación.', phases: ['CRM B2B', 'CRM'] },
  { name: 'Contabilidad', icon: 'account_balance_wallet', purpose: 'Plan de cuentas, documentos contables, recibos, periodos y cierres.', phases: ['Contabilidad'] },
  { name: 'Ads', icon: 'campaign', purpose: 'Publicidad: anunciantes, campañas, audiencias y su facturación.', phases: ['Ads'] },
  { name: 'Portal del comercio', icon: 'storefront', purpose: 'Lo que ve el propio comercio: su empresa, sus sucursales y su QR de cobro.', phases: ['Comercio'] },
  { name: 'Control', icon: 'verified_user', purpose: 'Usuarios, permisos, auditoría y las herramientas para orientarse en el ERP.', phases: ['Usuarios', 'Auditoría', 'Brecha documentada', 'Navegación'] },
];

const OTHER_VIEWS: ViewModule = { name: 'Otras pantallas', icon: 'apps', purpose: 'Pantallas que todavía no tienen un módulo asignado.', phases: [] };

/** El módulo de una vista. Nunca la deja fuera: lo que no encaja cae en «Otras pantallas». */
export function moduleOfView(view: AtlasViewLink): ViewModule {
  return viewModules.find((module) => module.phases.includes(view.phase)) ?? OTHER_VIEWS;
}

/** Todas las vistas repartidas por módulo, sin módulos vacíos. */
export function viewsByModule(views: readonly AtlasViewLink[] = atlasViewLinks): Array<{ module: ViewModule; views: AtlasViewLink[] }> {
  return [...viewModules, OTHER_VIEWS]
    .map((module) => ({ module, views: views.filter((view) => moduleOfView(view) === module) }))
    .filter((group) => group.views.length > 0);
}
