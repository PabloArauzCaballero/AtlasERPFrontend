'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { TutorialProvider } from '@/components/tutorial/TutorialProvider';
import { Icon } from '@/components/atlas/Icon';
import { IsotipoCuotea, LogoCuotea } from '@/components/atlas/Marca';
import { SelectorDeTema } from '@/components/atlas/SelectorDeTema';
import { cn } from '@/lib/cn';
import { useAuth } from '@/lib/authContext';
import { MerchantBottomNav } from './MerchantBottomNav';
import { NavDrawer } from './NavDrawer';
import { isActivePath, PORTAL_COMERCIO_MENU } from './navigation';

function PortalNav({ pathname, onNavigate = () => {} }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav data-tutorial-id="portal-nav" className="space-y-1">
      {PORTAL_COMERCIO_MENU.map((item) => {
        const active = [item.href, ...(item.alsoHrefs ?? [])].some((href) => isActivePath(pathname, href));
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2.5 text-xs font-medium transition-colors',
              active ? 'bg-brand-soft font-semibold text-slate-900' : 'text-slate-600 hover:bg-surface-sunken hover:text-slate-900',
            )}
          >
            <Icon name={item.icon} className={cn('shrink-0 text-[18px]', active ? 'text-slate-900' : 'text-slate-500')} />
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
  const displayRole = merchant ? 'Comercio' : 'Acceso delegado';
  const initials = displayName.trim().slice(0, 2).toUpperCase();

  useEffect(() => setNavOpen(false), [pathname]);

  return (
    <TutorialProvider>
    <div className="relative min-h-[100dvh] bg-canvas text-slate-900">

      <header className="sticky top-0 z-50 flex h-14 items-center justify-between gap-2 border-b border-slate-200 bg-white px-2 sm:px-5">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => setNavOpen(true)}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-md text-slate-600 hover:bg-surface-sunken lg:hidden"
            aria-label="Abrir navegación"
          >
            <Icon name="menu" className="text-[22px]" />
          </button>
          <LogoCuotea alto={24} className="hidden sm:inline-flex" />
          <IsotipoCuotea lado={28} className="sm:hidden" />
          <p className="truncate text-xs font-medium text-slate-600">Portal del comercio</p>
        </div>
        <div className="flex shrink-0 items-center gap-1 sm:gap-3">
          <div className="hidden h-7 w-px bg-slate-200 sm:block" />
          {/* El nombre del comercio se retira en pantallas muy estrechas: con la
              barra a 320 px empujaba los botones fuera del borde derecho. La
              identidad sigue visible en la ficha del menú lateral. */}
          <Link href="/portal-comercio/expediente" title="Mi empresa" aria-label={`Mi empresa: ${displayName}`} className="flex min-h-11 items-center gap-2 rounded-full py-1 pl-2 pr-1 transition-colors hover:bg-surface-sunken sm:gap-3">
            <div className="hidden max-w-40 text-right sm:block">
              <p className="truncate text-xs font-semibold">{displayName}</p>
              <p className="truncate text-xs text-slate-600">{displayRole}</p>
            </div>
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface-sunken text-xs font-semibold">{initials}</div>
          </Link>
          <button type="button" onClick={() => void logout()} className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-slate-500 hover:bg-surface-sunken" aria-label="Cerrar sesión"><Icon name="logout" className="text-[19px]" /></button>
        </div>
      </header>

      <NavDrawer open={navOpen} onClose={() => setNavOpen(false)} label="Navegación del portal">
        <div className="border-b border-slate-200 p-4">
          <p className="truncate text-sm font-semibold">{displayName}</p>
          <p className="truncate text-xs text-slate-600">{displayRole}</p>
        </div>
        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
          <p className="mb-2 px-3 text-xs font-medium text-slate-600">Operación</p>
          <PortalNav pathname={pathname} onNavigate={() => setNavOpen(false)} />
          <div className="mt-6 px-3"><p className="mb-1.5 text-xs font-medium text-slate-600">Apariencia</p><SelectorDeTema soloIconos className="w-full" /></div>
        </div>
      </NavDrawer>

      <div className="relative z-10 mx-auto grid min-h-[calc(100dvh-56px)] max-w-[1600px] grid-cols-[minmax(0,1fr)] lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="hidden border-r border-slate-200 bg-white p-4 lg:block">
          <p className="mb-3 px-3 text-xs font-medium text-slate-600">Operación</p>
          <PortalNav pathname={pathname} />
          <div className="mt-6 px-3"><p className="mb-1.5 text-xs font-medium text-slate-600">Apariencia</p><SelectorDeTema soloIconos className="w-full" /></div>
        </aside>
        {/* `pb-24`: deja sitio al botón flotante del asistente para que no tape la última fila. */}
        <main className="min-w-0 p-3 pb-40 sm:p-4 sm:pb-40 md:p-6 md:pb-40 lg:pb-36 xl:p-8 xl:pb-36">{children}</main>
      </div>

      {/* Justo encima del botón del asistente (h-14 en la esquina inferior derecha). */}
      <Link
        href="/portal-comercio/soporte"
        data-tutorial-id="portal-soporte"
        className={cn(
          // Sólo en escritorio: por debajo de `lg` «Soporte» es una pestaña de la barra inferior, porque
          // en 375 px este botón se pintaba encima del texto de la pantalla.
          'fixed bottom-[5.5rem] right-4 z-[45] hidden h-11 items-center gap-2 rounded-full border border-border-strong px-4 text-xs font-semibold text-slate-900 transition-colors sm:right-6 lg:flex lg:bottom-[6.5rem]',
          isActivePath(pathname, '/portal-comercio/soporte') ? 'bg-brand-soft' : 'bg-white hover:bg-surface-sunken',
        )}
      >
        <Icon name="support_agent" className="text-[18px]" />
        <span>Soporte y tutoriales</span>
      </Link>
      <MerchantBottomNav pathname={pathname} />
    </div>
    </TutorialProvider>
  );
}
