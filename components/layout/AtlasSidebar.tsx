'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Icon } from '@/components/atlas/Icon';
import { cn } from '@/lib/cn';
import { useAuth } from '@/lib/authContext';
import { CollapsibleNavGroup } from './CollapsibleNavGroup';
import { NAVIGATION, isActivePath, type NavGroup } from './navigation';

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
        {NAVIGATION.map((group, indice) => (
          <GrupoDeMenu
            key={group.label}
            group={group}
            pathname={pathname}
            /* En la portada se abre el primero: CRM es el trabajo diario y no tiene sentido llegar
               a la consola con los tres cajones cerrados. En cualquier otra ruta manda la ruta. */
            defaultOpen={pathname === '/operaciones' && indice === 0}
            onNavigate={onNavigate}
          />
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
      {/*
        * Al lado vivía un botón «Ayuda» que no hacía nada: ni abría la ayuda, ni llevaba al Centro
        * de Tutoriales que ya está arriba del menú. Quitado, queda sólo salir, y con su nombre: un
        * icono solitario en una esquina es la clase de control que se pulsa sin querer.
        */}
      <div className="border-t border-slate-200/80 p-3">
        <button
          type="button"
          onClick={handleLogout}
          className="flex min-h-11 w-full items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
        >
          <Icon name="logout" className="text-[18px]" /> Cerrar sesión
        </button>
      </div>
    </div>
  );
}

/**
 * Un grupo del menú, plegable.
 *
 * Los tres grupos se pintaban siempre abiertos: treinta y seis enlaces seguidos, de los que sólo
 * los del área en la que estás sirven para algo, y con Contabilidad y Control fuera de la pantalla
 * hasta que alguien se daba cuenta de que la barra se desplaza. Abierto queda el grupo al que
 * pertenece la ruta actual —el único que se está usando— y los demás son una línea.
 *
 * `abierto` arranca del cálculo y luego lo lleva el usuario: al entrar en un área se despliega
 * sola, pero si alguien cierra la suya para mirar otra, no se le vuelve a abrir en cada render.
 */
function GrupoDeMenu({ group, pathname, defaultOpen, onNavigate }: Readonly<{
  group: NavGroup;
  pathname: string;
  defaultOpen: boolean;
  onNavigate: () => void;
}>) {
  const rutas = [...group.items, ...(group.subGroups?.flatMap((sub) => sub.items) ?? [])];
  const contieneActiva = rutas.some((item) => isActivePath(pathname, item.href));
  const [abierto, setAbierto] = useState(defaultOpen || contieneActiva);

  return (
    <section className="mb-1" key={group.label}>
      <button
        type="button"
        onClick={() => setAbierto((valor) => !valor)}
        aria-expanded={abierto}
        className={cn(
          'mb-1 flex w-full items-center gap-2 rounded-md px-3 py-2 text-[10px] font-extrabold uppercase tracking-[0.12em] transition-colors',
          contieneActiva ? 'text-[#006a61]' : 'text-slate-500 hover:bg-white hover:text-[#006a61]',
        )}
      >
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${group.accent}`} />
        <span className="flex-1 truncate text-left">{group.label}</span>
        <Icon name={abierto ? 'expand_less' : 'expand_more'} className="text-[16px] text-slate-400" />
      </button>
      {abierto ? (
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
      ) : null}
    </section>
  );
}
