import Link from 'next/link';
import { Icon } from '@/components/atlas/Icon';

const links = [
  { href: '/portal-comercio/planes', label: 'Planes y suscripción', icon: 'workspace_premium' },
  { href: '/portal-comercio/facturacion', label: 'Consumo y facturación', icon: 'receipt_long' },
  { href: '/portal-comercio/campanas', label: 'Campañas', icon: 'campaign' },
  { href: '/portal-comercio/sucursales-usuarios', label: 'Sucursales', icon: 'storefront' },
  { href: '/portal-comercio/compras-bnpl', label: 'Registro BNPL', icon: 'point_of_sale' },
];

export function MerchantPortalShell({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-900">
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-5 shadow-sm">
        <div className="flex items-center gap-3"><div className="grid h-8 w-8 place-items-center rounded bg-[#031636] text-white"><Icon name="account_balance" className="text-[19px]" /></div><div><p className="text-sm font-extrabold tracking-tight">ATLAS ERP</p><p className="text-[9px] font-bold uppercase tracking-[.18em] text-slate-400">Merchant Portal</p></div></div>
        <div className="flex items-center gap-3"><button className="grid h-8 w-8 place-items-center rounded-full text-slate-500 hover:bg-slate-100" aria-label="Notificaciones"><Icon name="notifications" className="text-[19px]" /></button><div className="h-7 w-px bg-slate-200" /><div className="text-right"><p className="text-xs font-bold">Comercio</p><p className="text-[10px] text-slate-500">Operación merchant</p></div><div className="grid h-8 w-8 place-items-center rounded-full bg-slate-200 text-xs font-bold">MC</div></div>
      </header>
      <div className="mx-auto grid min-h-[calc(100vh-56px)] max-w-[1600px] lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="hidden border-r border-slate-200 bg-white p-4 lg:block">
          <p className="mb-3 px-3 text-[10px] font-extrabold uppercase tracking-[.14em] text-slate-400">Operación</p>
          <nav className="space-y-1">{links.map((item) => <Link key={item.href} href={item.href} className="flex items-center gap-3 rounded-md px-3 py-2.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-[#031636]"><Icon name={item.icon} className="text-[18px]" />{item.label}</Link>)}</nav>
          <div className="mt-8 rounded-lg bg-[#031636] p-4 text-white"><Icon name="verified_user" className="text-[22px] text-cyan-300" /><p className="mt-3 text-xs font-bold">Canal merchant seguro</p><p className="mt-1 text-[10px] leading-4 text-slate-300">Las acciones se registran con trazabilidad y permisos separados del panel operativo.</p></div>
        </aside>
        <main className="min-w-0 p-4 md:p-6 xl:p-8">{children}</main>
      </div>
    </div>
  );
}
