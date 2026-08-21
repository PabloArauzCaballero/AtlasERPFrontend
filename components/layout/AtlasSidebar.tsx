'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Icon } from '@/components/atlas/Icon';
import { cn } from '@/lib/cn';
import { useAuth } from '@/lib/authContext';
import { CollapsibleNavGroup, type CollapsibleNavItem } from './CollapsibleNavGroup';

interface NavItem { label: string; href: string; icon: string }
interface NavSubGroup { label: string; icon: string; items: CollapsibleNavItem[] }
interface NavGroup { label: string; icon: string; accent: string; items: NavItem[]; subGroups?: NavSubGroup[] }

const navigation: NavGroup[] = [
  {
    label: 'CRM', icon: 'business_center', accent: 'bg-[#006a61]', items: [
      { label: 'Cuentas B2B', href: '/operaciones/crm/cuentas', icon: 'domain' },
      { label: 'Pipeline', href: '/operaciones/crm/oportunidades', icon: 'view_kanban' },
      { label: 'Propuestas', href: '/operaciones/crm/propuestas', icon: 'request_quote' },
      { label: 'Aprobaciones', href: '/operaciones/crm/aprobaciones', icon: 'approval' },
      { label: 'Onboarding', href: '/operaciones/crm/onboarding', icon: 'fact_check' },
      { label: 'Facturación', href: '/operaciones/crm/facturacion', icon: 'receipt_long' },
      { label: 'Conciliación', href: '/operaciones/crm/conciliacion-cobertura', icon: 'account_balance' },
      { label: 'Carga masiva', href: '/operaciones/crm/bulk-cuentas', icon: 'upload_file' },
    ],
  },
  {
    label: 'Contabilidad', icon: 'account_balance_wallet', accent: 'bg-[#006a61]/75',
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
        ],
      },
    ],
  },
  {
    label: 'Ads', icon: 'campaign', accent: 'bg-[#006a61]/55', items: [
      { label: 'Dashboard', href: '/operaciones/ads/dashboard', icon: 'monitoring' },
      { label: 'Anunciantes', href: '/operaciones/ads/anunciantes', icon: 'business' },
      { label: 'Campañas', href: '/operaciones/ads/campanas', icon: 'campaign' },
      { label: 'Segmentos', href: '/operaciones/ads/segmentos', icon: 'groups' },
      { label: 'Moderación', href: '/operaciones/ads/moderacion', icon: 'verified' },
      { label: 'Delivery y fraude', href: '/operaciones/ads/delivery-monitor', icon: 'radar' },
      { label: 'Carga masiva', href: '/operaciones/ads/bulk-anunciantes', icon: 'upload_file' },
    ],
  },
  {
    label: 'Control', icon: 'verified_user', accent: 'bg-[#006a61]/35', items: [
      { label: 'Business Action Log', href: '/operaciones/auditoria/business-actions', icon: 'history_edu' },
      { label: 'Notificaciones', href: '/operaciones/admin/notificaciones', icon: 'notifications_active' },
      { label: 'Usuarios', href: '/operaciones/admin/seguridad', icon: 'manage_accounts' },
      { label: 'Centro de comando', href: '/operaciones/admin/busqueda-global', icon: 'travel_explore' },
      { label: 'Mapa del sistema', href: '/operaciones/admin/mapa-sitio', icon: 'account_tree' },
      { label: 'Roles y permisos', href: '/operaciones/admin/roles', icon: 'admin_panel_settings' },
    ],
  },
];

export function AtlasSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();

  async function handleLogout() {
    await logout();
    router.replace('/login');
  }

  return (
    <aside className="fixed bottom-0 left-0 top-16 z-40 hidden w-64 flex-col border-r border-slate-200 bg-white/70 backdrop-blur-xl lg:flex">
      <div className="border-b border-slate-200 px-5 py-5">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-md bg-[#006a61] text-white"><Icon name="account_balance" className="text-[23px]" /></span>
          <div><p className="text-sm font-extrabold text-[#006a61]">Financial Core</p><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Enterprise Hub</p></div>
        </div>
      </div>
      <nav className="custom-scrollbar flex-1 overflow-y-auto p-3">
        <Link href="/operaciones" className={cn('mb-2 flex items-center gap-3 rounded-md px-3 py-2.5 text-xs font-bold', pathname === '/operaciones' ? 'bg-[#00544d] text-white' : 'text-slate-600 hover:bg-white')}>
          <Icon name="dashboard" className="text-[19px]" /> Dashboard
        </Link>
        {navigation.map((group) => (
          <section className="mb-3" key={group.label}>
            <div className="mb-1 flex items-center gap-2 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-500"><span className={`h-1.5 w-1.5 rounded-full ${group.accent}`} />{group.label}</div>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link key={item.href} href={item.href} className={cn('flex items-center gap-3 rounded-md px-3 py-2 text-xs font-semibold transition-colors', active ? 'bg-[#00544d] text-white shadow-sm' : 'text-slate-600 hover:bg-white hover:text-[#006a61]')}>
                    <Icon name={item.icon} className={cn('text-[18px]', active ? 'text-blue-200' : 'text-slate-400')} />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
              {group.subGroups?.map((subGroup) => (
                <CollapsibleNavGroup key={subGroup.label} label={subGroup.label} icon={subGroup.icon} items={subGroup.items} />
              ))}
            </div>
          </section>
        ))}
      </nav>
      {/*
       * Aquí había un acceso al «Portal comercio», y era un enlace roto para la
       * única población capaz de verlo.
       *
       * Esta barra es la de la consola INTERNA: sólo se pinta bajo
       * `app/operaciones/layout.tsx`, que exige `RequireAuth audience="internal"`.
       * Un comercio nunca llega hasta ella —su sesión entra por
       * `MerchantPortalShell`—, así que el enlace sólo lo veía el personal de
       * Atlas; y `app/portal-comercio/layout.tsx` exige `audience="merchant"`,
       * de modo que pulsarlo devolvía a `/operaciones` de inmediato.
       *
       * El portal del comercio es del comercio, y su entrada es su propio inicio
       * de sesión. Si algún día hace falta el acceso delegado del staff que
       * `MerchantPortalShell` menciona, lo que hay que abrir es la audiencia en
       * `RequireAuth` —con su auditoría—, no volver a poner el enlace: sin eso,
       * es una promesa que el enrutador ya se niega a cumplir.
       */}
      <div className="border-t border-slate-200 p-3">
        <div className="flex gap-2"><button className="flex flex-1 items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-white"><Icon name="help" className="text-[18px]" />Ayuda</button><button onClick={handleLogout} className="grid h-9 w-9 place-items-center rounded-md text-red-600 hover:bg-red-50" aria-label="Cerrar sesión"><Icon name="logout" className="text-[18px]" /></button></div>
      </div>
    </aside>
  );
}
