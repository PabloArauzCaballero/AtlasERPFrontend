import { AmbientBackground } from '@/components/ambient/AmbientBackground';
import { AtlasSidebar } from './AtlasSidebar';
import { AtlasTopbar } from './AtlasTopbar';

/**
 * El armazón del portal interno.
 *
 * El fondo ambiental envuelve al marco entero y no a cada página: se monta una sola vez por sesión,
 * así que navegar no lo reinicia y su deriva es continua. Va detrás de todo, sin eventos de
 * puntero y marcado `aria-hidden`; se apaga solo con la pestaña oculta, en equipos de gama baja y
 * con movimiento reducido.
 *
 * Las superficies del contenido son translúcidas a propósito (`bg-surface/90`): dejan pasar un
 * punto del fondo para que su movimiento se perciba también donde hay texto. Opacas, el fondo
 * quedaría reducido a un marco alrededor del trabajo y no se vería nunca.
 */
export function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="relative min-h-screen bg-background text-slate-900">
      <AmbientBackground variant="dashboard" />
      <AtlasTopbar />
      <AtlasSidebar />
      <main className="relative min-h-screen pt-16 lg:pl-64">
        <div className="mx-auto w-full max-w-[1600px] space-y-6 p-4 md:p-6">{children}</div>
      </main>
    </div>
  );
}
