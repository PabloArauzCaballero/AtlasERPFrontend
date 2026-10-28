'use client';

import Link from 'next/link';
import { Icon } from '@/components/atlas/Icon';
import { cn } from '@/lib/cn';
import { isActivePath } from './navigation';

interface Destino {
  href: string;
  /** Etiqueta corta: en 375 px caben cuatro y «Cartera y facturación» no. */
  label: string;
  icon: string;
  /** Otras rutas que dejan activa la pestaña (Cartera y facturación son la misma conversación). */
  alsoHrefs?: string[];
}

/**
 * Las cuatro pantallas del portal del comercio, las mismas que ya existen en `PORTAL_COMERCIO_NAV`:
 * esta barra no añade ninguna. «Mi empresa» vivía sólo en el avatar y «Soporte y tutoriales» en un
 * botón flotante que, en 375 px, se pintaba encima del texto de la pantalla.
 */
const DESTINOS: Destino[] = [
  { href: '/portal-comercio/gestion-pos', label: 'POS', icon: 'point_of_sale' },
  { href: '/portal-comercio/cartera', alsoHrefs: ['/portal-comercio/facturacion'], label: 'Cartera', icon: 'account_balance_wallet' },
  { href: '/portal-comercio/expediente', label: 'Mi empresa', icon: 'badge' },
  { href: '/portal-comercio/soporte', label: 'Soporte', icon: 'support_agent' },
];

/**
 * Navegación inferior del portal del comercio, sólo por debajo de `lg`.
 *
 * Respeta la barra de gestos de iOS con `env(safe-area-inset-bottom)`, que vale algo porque el
 * `layout` raíz declara `viewport-fit=cover`. La barra del escritorio sigue siendo el lateral.
 */
export function MerchantBottomNav({ pathname }: Readonly<{ pathname: string }>) {
  return (
    <nav
      aria-label="Accesos del portal"
      data-tutorial-id="portal-nav-movil"
      className="fixed inset-x-0 bottom-0 z-[46] border-t border-slate-200/80 bg-white/90 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur-xl lg:hidden"
    >
      <ul className="flex items-stretch">
        {DESTINOS.map((destino) => {
          const activo = [destino.href, ...(destino.alsoHrefs ?? [])].some((href) => isActivePath(pathname, href));
          return (
            <li key={destino.href} className="flex flex-1">
              <Link
                href={destino.href}
                aria-current={activo ? 'page' : undefined}
                className={cn(
                  'relative flex h-14 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-semibold leading-none transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#006a61]/60',
                  activo ? 'text-[#006a61]' : 'text-slate-600',
                )}
              >
                {/* La barrita superior marca la pestaña activa sin depender sólo del color. */}
                <span aria-hidden="true" className={cn('absolute inset-x-5 top-0 h-0.5 rounded-b-full bg-[#006a61] transition-opacity', activo ? 'opacity-100' : 'opacity-0')} />
                <Icon name={destino.icon} className="text-[22px]" />
                {destino.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
