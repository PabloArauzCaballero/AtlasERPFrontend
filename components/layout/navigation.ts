import { PUBLICIDAD_VISIBLE } from '@/lib/modulos';

export interface NavItem {
  label: string;
  href: string;
  icon: string;
}

export interface NavSubGroup {
  label: string;
  icon: string;
  items: NavItem[];
}

export interface NavGroup {
  label: string;
  icon: string;
  /** Clase de color del punto que encabeza el grupo. */
  accent: string;
  /** Clave del área para el fondo ambiental; es el mismo color que `accent`. */
  area: string;
  items: NavItem[];
  subGroups?: NavSubGroup[];
}

/**
 * Modelo de navegación de la consola interna.
 *
 * Vive aquí y no dentro de `AtlasSidebar` porque hay dos superficies que lo
 * pintan —la barra lateral fija del escritorio y el cajón deslizante del móvil—
 * y un menú que existe en dos copias se desincroniza a la primera pantalla nueva.
 *
 * Tres rótulos dicen a quién se refieren y no se pueden acortar: «Usuarios internos» son los del
 * propio ERP —se administran, no se segmentan—, «Segmentos de audiencia» es a quién se le sirve un
 * anuncio, y «Segmentos comerciales» es población de negocio (partners y clientes solicitantes de
 * crédito). Llamando «Usuarios» y «Segmentos» a secas, las tres cosas se leían como la misma.
 */
const ADS: NavGroup = {
  label: 'Publicidad', icon: 'campaign', accent: 'bg-violet-500', area: 'ads', items: [
    { label: 'Dashboard', href: '/operaciones/ads/dashboard', icon: 'monitoring' },
    { label: 'Anunciantes', href: '/operaciones/ads/anunciantes', icon: 'business' },
    { label: 'Campañas', href: '/operaciones/ads/campanas', icon: 'campaign' },
    { label: 'Segmentos de audiencia', href: '/operaciones/ads/segmentos', icon: 'groups' },
    { label: 'Moderación', href: '/operaciones/ads/moderacion', icon: 'verified' },
    { label: 'Delivery y fraude', href: '/operaciones/ads/delivery-monitor', icon: 'radar' },
    { label: 'Inventario y políticas', href: '/operaciones/ads/inventario', icon: 'space_dashboard' },
    { label: 'Facturación', href: '/operaciones/ads/facturacion', icon: 'receipt_long' },
    { label: 'Correo de campaña', href: '/operaciones/ads/correo', icon: 'forward_to_inbox' },
  ],
};

/**
 * El menú de la consola interna: tres grupos y diecisiete entradas a la vista.
 *
 * Eran cuatro grupos y treinta y seis entradas, todas al mismo nivel dentro de su grupo, y esa
 * planitud era el problema: CRM ofrecía «Cuentas B2B» y «Tags de clasificación» con el mismo peso,
 * aunque una se abre cada día y la otra se toca cuando alguien inventa una etiqueta nueva. Elegir
 * entre catorce cosas iguales cuesta más que elegir entre ocho y un cajón.
 *
 * El criterio para bajar algo a un subgrupo es cuándo se usa, no de qué trata: lo que se hace con
 * un comercio delante se queda arriba; lo que se configura una vez y se revisa de tarde en tarde,
 * abajo. Contabilidad ya estaba así desde antes y es el patrón que se copia.
 *
 * «Propuestas» va la ÚLTIMA de CRM, y va donde va por decisión de producto: no se sube junto al
 * pipeline ni se vuelve a meter dentro de él como pestaña.
 *
 * Y dos entradas se fueron del todo, porque el menú de quien lleva la operación no es el sitio
 * donde el equipo que construye el ERP mira su propio andamiaje:
 *
 * - «Centro de comando», que `lib/viewRegistry.ts` declara `brecha-backend` —«sin endpoint de
 *   búsqueda global federada»—. Una pantalla que el sistema aún no puede alimentar no es una opción
 *   del menú: es una puerta a un cuarto vacío. La ruta sigue respondiendo para quien la tenga
 *   guardada, y es a donde lleva el buscador de la barra superior.
 * - «Mapa del sistema», que listaba las pantallas del ERP con una etiqueta de cuánto funcionaba
 *   cada una («En construcción» incluida). Eso es estado de la obra, no trabajo de nadie: a quien
 *   factura no le sirve, y de paso anunciaba en el menú lo que falta por terminar.
 *
 * Con «Mapa del sistema» se fue también el cajón «Sistema», que quedaba con una sola entrada:
 * «Roles y permisos» sube al grupo, que es donde se busca. Y «Business Action Log» pasa a llamarse
 * «Registro de actividad»: lo que hay dentro son las acciones que hizo la gente, no un «log».
 */
export const NAVIGATION: NavGroup[] = [
  {
    label: 'CRM', icon: 'business_center', accent: 'bg-teal-500', area: 'crm',
    items: [
      { label: 'Cuentas B2B', href: '/operaciones/crm/cuentas', icon: 'domain' },
      { label: 'Pipeline', href: '/operaciones/crm/oportunidades', icon: 'view_kanban' },
      { label: 'Onboarding', href: '/operaciones/crm/onboarding', icon: 'fact_check' },
      { label: 'Contratos', href: '/operaciones/crm/contratos', icon: 'description' },
      { label: 'Facturación', href: '/operaciones/crm/facturacion', icon: 'receipt_long' },
      { label: 'Calificación de riesgo', href: '/operaciones/crm/calificacion-riesgo', icon: 'speed' },
      { label: 'Propuestas', href: '/operaciones/crm/propuestas', icon: 'request_quote' },
    ],
    subGroups: [
      {
        label: 'Configuración comercial', icon: 'tune', items: [
          { label: 'Conciliación', href: '/operaciones/crm/conciliacion-cobertura', icon: 'account_balance' },
          { label: 'Sucursales', href: '/operaciones/crm/sucursales', icon: 'store' },
          { label: 'Segmentos comerciales', href: '/operaciones/crm/segmentos', icon: 'group_work' },
          { label: 'Tags de clasificación', href: '/operaciones/crm/tags', icon: 'label' },
        ],
      },
    ],
  },
  {
    label: 'Contabilidad', icon: 'account_balance_wallet', accent: 'bg-blue-500', area: 'contabilidad',
    items: [
      { label: 'Business partners', href: '/operaciones/contabilidad/business-partners', icon: 'handshake' },
      { label: 'Contratos', href: '/operaciones/contabilidad/contratos', icon: 'description' },
      { label: 'Documentos', href: '/operaciones/contabilidad/documentos', icon: 'post_add' },
      { label: 'Factura AR', href: '/operaciones/contabilidad/factura-ar', icon: 'request_quote' },
      { label: 'Recibos', href: '/operaciones/contabilidad/recibos', icon: 'payments' },
      { label: 'Cierres', href: '/operaciones/contabilidad/cierres', icon: 'lock_clock' },
    ],
    subGroups: [
      {
        label: 'Configuración maestra', icon: 'tune', items: [
          { label: 'Estructura', href: '/operaciones/contabilidad/estructura', icon: 'corporate_fare' },
          { label: 'Cuentas GL', href: '/operaciones/contabilidad/cuentas-gl', icon: 'account_tree' },
          { label: 'Grupos de cuenta', href: '/operaciones/contabilidad/grupos-cuenta', icon: 'account_tree' },
          { label: 'Impuestos y COA', href: '/operaciones/contabilidad/impuestos-coa', icon: 'receipt' },
          { label: 'Periodos y ledgers', href: '/operaciones/contabilidad/periodos-ledgers', icon: 'calendar_month' },
          { label: 'Sucursales y fiscales', href: '/operaciones/contabilidad/sucursales-fiscales', icon: 'store' },
          { label: 'Condiciones de pago', href: '/operaciones/contabilidad/condiciones-pago', icon: 'handshake' },
          { label: 'Vínculos multientidad', href: '/operaciones/contabilidad/vinculos', icon: 'link' },
        ],
      },
    ],
  },
  ...(PUBLICIDAD_VISIBLE ? [ADS] : []),
  {
    label: 'Control', icon: 'verified_user', accent: 'bg-amber-500', area: 'control',
    items: [
      { label: 'Registro de actividad', href: '/operaciones/auditoria/business-actions', icon: 'history_edu' },
      { label: 'Notificaciones masivas', href: '/operaciones/admin/notificaciones', icon: 'notifications_active' },
      { label: 'Usuarios internos', href: '/operaciones/admin/seguridad', icon: 'manage_accounts' },
      { label: 'Roles y permisos', href: '/operaciones/admin/roles', icon: 'admin_panel_settings' },
    ],
  },
];

/** `true` si la ruta actual es ese ítem o cuelga de él. */
export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Área a la que pertenece la ruta actual, para teñir el fondo ambiental con el
 * mismo color que ya marca ese grupo en el menú. Sin coincidencia, el azul
 * institucional.
 */
export function areaForPath(pathname: string): string | undefined {
  for (const group of NAVIGATION) {
    const all = [...group.items, ...(group.subGroups?.flatMap((sub) => sub.items) ?? [])];
    if (all.some((item) => isActivePath(pathname, item.href))) return group.area;
  }
  return undefined;
}

/**
 * Variante de fondo ambiental que le toca a la ruta.
 *
 * El fondo se puso «a media asta» en TODA la consola —aurora al 0,62, red al 0,8, malla al 0,4—
 * razonando que así daría profundidad sin estorbar. Sobre blanco no ocurre eso: en una pantalla de
 * trabajo el verde se cuela por los huecos entre paneles, tiñe sus bordes y cubre la banda de
 * cabecera, donde el título y su descripción viven sobre el fondo y no sobre una tarjeta. El
 * resultado no se lee como profundidad, se lee como una mancha.
 *
 * Es la misma lección que el motor de decisión dejó escrita tras repetirla tres veces, y que aquí
 * se había recogido a medias: se copió la advertencia y luego se atenuó en vez de retirar.
 *
 * Así que el fondo se queda donde hay superficie libre que ganar y nada con lo que competir —el
 * panel de operaciones, que es una portada— y se retira de las pantallas de trabajo. La regla
 * enumera las portadas, que son pocas: una vista nueva nace con el lienzo limpio, que es lo que
 * necesita una tabla, sin que nadie tenga que acordarse de nada.
 */
export function ambientVariantFor(pathname: string): 'console' | 'trabajo' {
  return pathname === '/operaciones' ? 'console' : 'trabajo';
}
