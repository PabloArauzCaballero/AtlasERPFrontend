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
  { area: 'Panel operaciones', phase: 'CRM B2B', title: 'Bulk cuentas B2B', href: '/operaciones/crm/bulk-cuentas', status: 'solo-accion', backend: 'POST /b2b/accounts/bulk' },
  { area: 'Panel operaciones', phase: 'CRM B2B', title: 'Pipeline de oportunidades', href: '/operaciones/crm/oportunidades', status: 'solo-accion', backend: 'POST/PATCH /b2b/opportunities' },
  { area: 'Panel operaciones', phase: 'CRM B2B', title: 'Propuesta comercial', href: '/operaciones/crm/propuestas', status: 'solo-accion', backend: 'POST/PATCH /b2b/proposals' },
  { area: 'Panel operaciones', phase: 'CRM B2B', title: 'Cola de aprobaciones', href: '/operaciones/crm/aprobaciones', status: 'solo-accion', backend: 'PATCH /b2b/proposals/approvals/:id/decision' },
  { area: 'Panel operaciones', phase: 'CRM B2B', title: 'Contrato comercial', href: '/operaciones/crm/contratos', status: 'solo-accion', backend: 'POST/PATCH /b2b/contracts' },
  { area: 'Panel operaciones', phase: 'CRM B2B', title: 'Onboarding comercio', href: '/operaciones/crm/onboarding', status: 'solo-accion', backend: 'POST/PATCH /b2b/onboarding' },
  { area: 'Panel operaciones', phase: 'CRM B2B', title: 'Activación de comercio', href: '/operaciones/crm/activacion-comercio', status: 'solo-accion', backend: 'PATCH /b2b/onboarding/cases/:id/activate' },
  { area: 'Portal comercio', phase: 'Comercio', title: 'Sucursales del comercio', href: '/portal-comercio/sucursales-usuarios', status: 'solo-accion', backend: 'POST/PATCH /portal/branches | POST /partner-onboarding/:id/branches' },
  { area: 'Portal comercio', phase: 'Comercio', title: 'Mi empresa', href: '/portal-comercio/expediente', status: 'integrada', backend: 'GET /partner-onboarding/mine | :id/status · PATCH :id/commercial-profile' },
  { area: 'Portal comercio', phase: 'Comercio', title: 'Mi QR de cobro', href: '/portal-comercio/qr-cobro', status: 'integrada', backend: 'GET /partner-onboarding/:id/qr-codes | :id/qr-codes/:qrId/content · POST :id/qr-codes' },
  { area: 'Panel operaciones', phase: 'CRM B2B', title: 'Facturación B2B', href: '/operaciones/crm/facturacion', status: 'solo-accion', backend: 'POST /b2b/billing/*' },
  { area: 'Panel operaciones', phase: 'CRM B2B', title: 'Tarifas y pricing', href: '/operaciones/crm/tarifas', status: 'integrada', backend: 'GET/POST/PATCH /portal/plans · GET /portal/billing-products' },
  { area: 'Panel operaciones', phase: 'CRM B2B', title: 'Conciliación y cobertura', href: '/operaciones/crm/conciliacion-cobertura', status: 'solo-accion', backend: 'POST/PATCH /b2b/coverage | reconciliation' },
  { area: 'Panel operaciones', phase: 'Contabilidad', title: 'Estructura financiera', href: '/operaciones/contabilidad/estructura', status: 'solo-accion', backend: 'POST /accounting/financial-structure/*' },
  { area: 'Panel operaciones', phase: 'Contabilidad', title: 'Cuentas GL', href: '/operaciones/contabilidad/cuentas-gl', status: 'integrada', backend: 'GET/POST /accounting/financial-structure/gl-accounts' },
  { area: 'Panel operaciones', phase: 'Contabilidad', title: 'Impuestos y COA', href: '/operaciones/contabilidad/impuestos-coa', status: 'solo-accion', backend: 'POST /charts-of-accounts | tax-codes' },
  { area: 'Panel operaciones', phase: 'Contabilidad', title: 'Periodos y ledgers', href: '/operaciones/contabilidad/periodos-ledgers', status: 'solo-accion', backend: 'POST /fiscal-years | periods | ledgers' },
  { area: 'Panel operaciones', phase: 'Contabilidad', title: 'Sucursales y años fiscales', href: '/operaciones/contabilidad/sucursales-fiscales', status: 'solo-accion', backend: 'POST /branches | fiscal-years' },
  { area: 'Panel operaciones', phase: 'Contabilidad', title: 'Business partners', href: '/operaciones/contabilidad/business-partners', status: 'integrada', backend: 'GET/POST /accounting/business-partners' },
  { area: 'Panel operaciones', phase: 'Contabilidad', title: 'Contratos contables', href: '/operaciones/contabilidad/contratos', status: 'solo-accion', backend: 'POST /accounting/contracts' },
  { area: 'Panel operaciones', phase: 'Contabilidad', title: 'Crear documento contable', href: '/operaciones/contabilidad/documentos', status: 'solo-accion', backend: 'POST/PATCH /accounting/documents' },
  { area: 'Panel operaciones', phase: 'Contabilidad', title: 'Bulk documentos contables', href: '/operaciones/contabilidad/bulk-documentos', status: 'solo-accion', backend: 'POST /accounting/documents/bulk' },
  { area: 'Panel operaciones', phase: 'Contabilidad', title: 'Factura AR contable', href: '/operaciones/contabilidad/factura-ar', status: 'solo-accion', backend: 'POST /accounting/billing/ar-invoices' },
  { area: 'Panel operaciones', phase: 'Contabilidad', title: 'Registrar recibo', href: '/operaciones/contabilidad/recibos', status: 'solo-accion', backend: 'POST /accounting/receipts' },
  { area: 'Panel operaciones', phase: 'Contabilidad', title: 'Cierre de periodos', href: '/operaciones/contabilidad/cierres', status: 'solo-accion', backend: 'POST/PATCH /accounting/closings/*' },
  { area: 'Panel operaciones', phase: 'Ads', title: 'Dashboard Ads', href: '/operaciones/ads/dashboard', status: 'integrada', backend: 'GET /admin/ads/dashboard' },
  { area: 'Panel operaciones', phase: 'Ads', title: 'Directorio de anunciantes', href: '/operaciones/ads/anunciantes', status: 'integrada', backend: 'GET/POST /admin/ads/advertisers' },
  { area: 'Panel operaciones', phase: 'Ads', title: 'Bulk anunciantes', href: '/operaciones/ads/bulk-anunciantes', status: 'solo-accion', backend: 'POST /admin/ads/advertisers/bulk' },
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
  { area: 'Panel operaciones', phase: 'Auditoría', title: 'Business Action Log', href: '/operaciones/auditoria/business-actions', status: 'integrada', backend: 'GET /audit/business-actions' },
  { area: 'Panel operaciones', phase: 'Usuarios', title: 'Administración de usuarios y seguridad', href: '/operaciones/admin/seguridad', status: 'integrada', backend: 'GET/PATCH /internal/users, /internal/users/:id/roles' },
  { area: 'Panel operaciones', phase: 'Brecha documentada', title: 'Centro de notificaciones y alertas', href: '/operaciones/admin/notificaciones', status: 'brecha-backend', backend: 'Sin módulo de notificaciones en este backend' },
  { area: 'Panel operaciones', phase: 'Brecha documentada', title: 'Centro de comando y búsqueda global', href: '/operaciones/admin/busqueda-global', status: 'brecha-backend', backend: 'Sin endpoint de búsqueda global federada' },
  { area: 'Panel operaciones', phase: 'Usuarios', title: 'Gestión de roles y permisos', href: '/operaciones/admin/roles', status: 'integrada', backend: 'GET /internal/roles, /internal/permissions (solo lectura)' },
  { area: 'Panel operaciones', phase: 'Navegación', title: 'Mapa del sitio y navegación', href: '/operaciones/admin/mapa-sitio', status: 'integrada', backend: 'Registro local de vistas y contratos' },
];
