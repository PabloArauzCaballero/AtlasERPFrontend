'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AmbientBackground } from '@/components/atlas/AmbientBackground';
import { TutorialProvider } from '@/components/tutorial/TutorialProvider';
import { Icon } from '@/components/atlas/Icon';
import { cn } from '@/lib/cn';
import { useAuth } from '@/lib/authContext';
import { NavDrawer } from './NavDrawer';
import { isActivePath } from './navigation';

const links = [
  /* Lo primero del menu: es la pantalla donde el comercio responde a sus clientes. */
  { href: '/portal-comercio/solicitudes', label: 'Solicitudes de compra', icon: 'inbox' },
  /* Justo debajo: son los dos momentos en que el comercio tiene que responder algo. */
  { href: '/portal-comercio/comprobantes', label: 'Comprobantes por verificar', icon: 'receipt_long' },
  /* El QR con el que le pagan. Antes vivia enterrado en «Mi empresa» y dejaba de funcionar en cuanto
     el expediente se aprobaba, asi que el comercio operando era el unico que no podia subirlo. */
  { href: '/portal-comercio/qr-cobro', label: 'Mi QR de cobro', icon: 'qr_code_2' },
  { href: '/portal-comercio/cartera', label: 'Mi cartera', icon: 'account_balance_wallet' },
  { href: '/portal-comercio/planes', label: 'Planes y suscripción', icon: 'workspace_premium' },
  { href: '/portal-comercio/facturacion', label: 'Consumo y facturación', icon: 'receipt_long' },
  { href: '/portal-comercio/campanas', label: 'Campañas', icon: 'campaign' },
  { href: '/portal-comercio/sucursales-usuarios', label: 'Sucursales', icon: 'storefront' },
  /* La ficha del negocio y el QR que se imprime: existia la pantalla, pero no habia como llegar. */
  { href: '/portal-comercio/expediente', label: 'Mi empresa', icon: 'badge' },
  { href: '/portal-comercio/tutoriales', label: 'Centro de Tutoriales', icon: 'school' },
];

function PortalNav({ pathname, onNavigate = () => {} }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav data-tutorial-id="portal-nav" className="space-y-1">
      {links.map((item) => {
        const active = isActivePath(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2.5 text-xs font-semibold transition',
              active ? 'bg-[#006a61] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-[#006a61]',
            )}
          >
            <Icon name={item.icon} className={cn('shrink-0 text-[18px]', active ? 'text-cyan-300' : 'text-slate-500')} />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function MerchantPortalShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const { merchant, user, logout } = useAuth();
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);
  // El staff interno también abre este portal, en nombre de un comercio: se identifica a quien
  // realmente está operando, para que quede claro en pantalla y no sólo en la auditoría.
  const displayName = merchant?.fullName ?? merchant?.email ?? user?.fullName ?? 'Comercio';
  const displayRole = merchant ? 'Operación merchant' : 'Acceso delegado (staff)';
  const initials = displayName.trim().slice(0, 2).toUpperCase();

  useEffect(() => setNavOpen(false), [pathname]);

  return (
    <TutorialProvider>
    <div className="relative min-h-[100dvh] text-slate-900">
      <AmbientBackground variant="portal" accent="portal" />

      <header className="sticky top-0 z-50 flex h-14 items-center justify-between gap-2 border-b border-slate-200/80 bg-white/85 px-2 shadow-sm backdrop-blur-xl sm:px-5">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => setNavOpen(true)}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-md text-slate-600 hover:bg-slate-100 lg:hidden"
            aria-label="Abrir navegación"
          >
            <Icon name="menu" className="text-[22px]" />
          </button>
          <div className="hidden h-8 w-8 shrink-0 place-items-center rounded bg-[#006a61] text-white sm:grid"><Icon name="account_balance" className="text-[19px]" /></div>
          <div className="min-w-0">
            <p className="truncate text-sm font-extrabold tracking-tight">ATLAS ERP</p>
            <p className="truncate text-[9px] font-bold uppercase tracking-[.18em] text-slate-500">Merchant Portal</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1 sm:gap-3">
          <button className="hidden h-11 w-11 place-items-center rounded-full text-slate-500 hover:bg-slate-100 sm:grid" aria-label="Notificaciones"><Icon name="notifications" className="text-[19px]" /></button>
          <div className="hidden h-7 w-px bg-slate-200 sm:block" />
          {/* El nombre del comercio se retira en pantallas muy estrechas: con la
              barra a 320 px empujaba los botones fuera del borde derecho. La
              identidad sigue visible en la ficha del menú lateral. */}
          <div className="hidden max-w-40 text-right sm:block">
            <p className="truncate text-xs font-bold">{displayName}</p>
            <p className="truncate text-[10px] text-slate-500">{displayRole}</p>
          </div>
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-200 text-xs font-bold">{initials}</div>
          <button type="button" onClick={() => void logout()} className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-slate-500 hover:bg-slate-100" aria-label="Cerrar sesión"><Icon name="logout" className="text-[19px]" /></button>
        </div>
      </header>

      <NavDrawer open={navOpen} onClose={() => setNavOpen(false)} label="Navegación del portal">
        <div className="border-b border-slate-200/80 p-4">
          <p className="truncate text-sm font-bold">{displayName}</p>
          <p className="truncate text-[10px] text-slate-500">{displayRole}</p>
        </div>
        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
          <p className="mb-2 px-3 text-[10px] font-extrabold uppercase tracking-[.14em] text-slate-500">Operación</p>
          <PortalNav pathname={pathname} onNavigate={() => setNavOpen(false)} />
        </div>
      </NavDrawer>

      <div className="relative z-10 mx-auto grid min-h-[calc(100dvh-56px)] max-w-[1600px] grid-cols-[minmax(0,1fr)] lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="hidden border-r border-slate-200/80 bg-white/70 p-4 backdrop-blur-xl lg:block">
          <p className="mb-3 px-3 text-[10px] font-extrabold uppercase tracking-[.14em] text-slate-500">Operación</p>
          <PortalNav pathname={pathname} />
          <div className="mt-8 rounded-lg bg-[#006a61] p-4 text-white"><Icon name="verified_user" className="text-[22px] text-cyan-300" /><p className="mt-3 text-xs font-bold">Canal merchant seguro</p><p className="mt-1 text-[10px] leading-4 text-slate-300">Las acciones se registran con trazabilidad y permisos separados del panel operativo.</p></div>
        </aside>
        <main className="min-w-0 p-3 sm:p-4 md:p-6 xl:p-8">{children}</main>
      </div>
    </div>
    </TutorialProvider>
  );
}
