import Link from 'next/link';
import { ScreenGuideButton } from '@/components/tutorial/ScreenGuideButton';
import { Icon } from './Icon';

interface WorkspaceHeaderProps {
  eyebrow?: string;
  title: string;
  description: string;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  actions?: React.ReactNode;
  /**
   * Oculta los botones de ayuda. Sólo para cabeceras que no encabezan una vista
   * —una sección dentro de otra pantalla—, donde repetirlos confundiría sobre a
   * qué se refiere la explicación.
   */
  hideHelp?: boolean;
}

export function WorkspaceHeader({ eyebrow, title, description, breadcrumbs = [], actions, hideHelp = false }: WorkspaceHeaderProps) {
  return (
    <div data-tutorial-id="workspace-header" className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <div className="min-w-0">
        {breadcrumbs.length ? (
          <nav aria-label="Migas de pan" className="mb-2 flex flex-wrap items-center gap-1.5 text-xs font-semibold text-slate-500">
            {breadcrumbs.map((item, index) => (
              <span key={`${item.label}-${index}`} className="flex items-center gap-1.5">
                {index ? <Icon name="chevron_right" className="text-[14px]" /> : null}
                {item.href ? <Link href={item.href} className="hover:text-slate-900">{item.label}</Link> : <span className="text-slate-800">{item.label}</span>}
              </span>
            ))}
          </nav>
        ) : null}
        {eyebrow ? <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">{eyebrow}</p> : null}
        {/* El título se recompone en móvil en vez de encogerse: a 30 px en 360 px de ancho parte en
            tres líneas y empuja el contenido fuera de la primera pantalla. `text-pretty` evita
            además la palabra huérfana en la última, que es donde más se nota al partir. */}
        <h1 className="text-pretty text-xl font-bold leading-tight tracking-tight text-[#006a61] sm:text-2xl md:text-[30px] md:leading-[38px]">{title}</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">{description}</p>
      </div>
      {/*
       * La ayuda va aquí, junto al título, y no en cada pantalla.
       *
       * Es la diferencia entre una función que existe en 50 vistas y una que
       * alguien tiene que acordarse de poner 50 veces: `ScreenGuideButton`
       * resuelve su contenido por la ruta, así que aparece sola en todas —y en
       * las que se añadan después— sin tocar ni una pantalla.
       */}
      <div className="atlas-rail -mx-3 flex shrink-0 items-center gap-2 overflow-x-auto px-3 pb-0.5 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        {hideHelp ? null : <ScreenGuideButton />}
        {actions}
      </div>
    </div>
  );
}
