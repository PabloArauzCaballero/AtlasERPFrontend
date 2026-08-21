'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Icon } from '@/components/atlas/Icon';
import { cn } from '@/lib/cn';
import { useAuth } from '@/lib/authContext';
import { CollapsibleNavGroup } from './CollapsibleNavGroup';
import { NAVIGATION, isActivePath } from './navigation';

interface SidebarProps {
  /**
   * Se invoca al activar cualquier enlace. En el cajón del móvil sirve para
   * cerrarlo: navegar y dejar el menú tapando la pantalla a la que se acaba de
   * llegar es la forma más rápida de que un cajón se perciba roto.
   */
  onNavigate?: () => void;
}

/**
 * Contenido del menú lateral de la consola interna.
 *
 * No decide dónde vive: en escritorio lo enmarca la columna fija de `AppShell`,
 * y en móvil el cajón deslizante. Por eso ocupa el alto de su contenedor y no
 * se posiciona a sí mismo.
 */
export function AtlasSidebar({ onNavigate = () => {} }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();

  async function handleLogout() {
    onNavigate?.();
    await logout();
    router.replace('/login');
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-slate-200/80 px-5 py-5">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-[#006a61] text-white"><Icon name="account_balance" className="text-[23px]" /></span>
          <div className="min-w-0">
            <p className="truncate text-sm font-extrabold text-[#006a61]">Financial Core</p>
            <p className="truncate text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Enterprise Hub</p>
          </div>
        </div>
      </div>
      <nav data-tutorial-id="sidebar-nav" className="custom-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
        <Link
          href="/operaciones"
          data-tutorial-id="sidebar-dashboard"
          onClick={onNavigate}
          className={cn('mb-2 flex items-center gap-3 rounded-md px-3 py-2.5 text-xs font-bold', pathname === '/operaciones' ? 'bg-[#00544d] text-white' : 'text-slate-600 hover:bg-white')}
        >
          <Icon name="dashboard" className="text-[19px]" /> Dashboard
        </Link>
        {/*
         * El Centro va arriba y no en un grupo: quien lo necesita es
         * precisamente quien todavía no entiende los grupos.
         */}
        <Link
          href="/operaciones/tutoriales"
          onClick={onNavigate}
          className={cn('mb-3 flex items-center gap-3 rounded-md px-3 py-2.5 text-xs font-bold', pathname === '/operaciones/tutoriales' ? 'bg-[#00544d] text-white' : 'text-slate-600 hover:bg-white')}
        >
          <Icon name="school" className="text-[19px]" /> Centro de Tutoriales
        </Link>
        {NAVIGATION.map((group) => (
          <section className="mb-3" key={group.label}>
            <div className="mb-1 flex items-center gap-2 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-500"><span className={`h-1.5 w-1.5 rounded-full ${group.accent}`} />{group.label}</div>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActivePath(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    className={cn('flex items-center gap-3 rounded-md px-3 py-2 text-xs font-semibold transition-colors', active ? 'bg-[#00544d] text-white shadow-sm' : 'text-slate-600 hover:bg-white hover:text-[#006a61]')}
                  >
                    <Icon name={item.icon} className={cn('shrink-0 text-[18px]', active ? 'text-white/75' : 'text-slate-500')} />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
              {group.subGroups?.map((subGroup) => (
                <CollapsibleNavGroup key={subGroup.label} label={subGroup.label} icon={subGroup.icon} items={subGroup.items} onNavigate={onNavigate} />
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
      <div className="border-t border-slate-200/80 p-3">
        <div className="flex gap-2">
          <button className="flex min-h-11 flex-1 items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-white"><Icon name="help" className="text-[18px]" />Ayuda</button>
          <button onClick={handleLogout} className="grid h-11 w-11 place-items-center rounded-md text-red-600 hover:bg-red-50" aria-label="Cerrar sesión"><Icon name="logout" className="text-[18px]" /></button>
        </div>
      </div>
    </div>
  );
}
