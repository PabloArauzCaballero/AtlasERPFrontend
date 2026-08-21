'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { AmbientBackground } from '@/components/atlas/AmbientBackground';
import { TutorialProvider } from '@/components/tutorial/TutorialProvider';
import { AtlasSidebar } from './AtlasSidebar';
import { AtlasTopbar } from './AtlasTopbar';
import { NavDrawer } from './NavDrawer';
import { areaForPath } from './navigation';

/**
 * Armazón de la consola interna.
 *
 * Tres piezas: la barra superior fija, el menú lateral —columna fija en
 * escritorio, cajón deslizante por debajo de `lg`— y el contenido. Detrás de
 * todo, el fondo ambiental, que se tiñe con el color del área en la que se está.
 *
 * El estado del cajón vive aquí porque lo abre la barra superior y lo pinta el
 * lateral: es el ancestro común, y lo alternativo sería un contexto para un solo
 * booleano.
 */
export function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);
  const area = useMemo(() => areaForPath(pathname), [pathname]);

  // Navegar cierra el cajón. `AtlasSidebar` ya lo cierra al pulsar un enlace,
  // pero no toda navegación sale de ahí —una miga de pan, el botón atrás del
  // navegador— y el cajón no debe sobrevivir a un cambio de pantalla.
  useEffect(() => setNavOpen(false), [pathname]);

  return (
    <TutorialProvider>
    <div className="relative min-h-[100dvh] text-slate-900">
      <AmbientBackground variant="console" accent={area} />

      <AtlasTopbar onOpenNav={() => setNavOpen(true)} />

      <aside className="fixed bottom-0 left-0 top-16 z-40 hidden w-64 border-r border-slate-200/80 bg-white/70 backdrop-blur-xl lg:block">
        <AtlasSidebar />
      </aside>

      <NavDrawer open={navOpen} onClose={() => setNavOpen(false)} label="Navegación de la consola">
        <AtlasSidebar onNavigate={() => setNavOpen(false)} />
      </NavDrawer>

      <main className="relative z-10 pt-16 lg:pl-64">
        <div className="mx-auto w-full max-w-[1600px] space-y-5 p-3 sm:p-4 md:space-y-6 md:p-6">{children}</div>
      </main>
    </div>
    </TutorialProvider>
  );
}
