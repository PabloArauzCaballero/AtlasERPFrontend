import { Icon } from './Icon';

export interface ExplainerPoint {
  title: string;
  text: React.ReactNode;
}

/**
 * «¿Qué estás viendo?», dicho en la propia pantalla.
 *
 * La guía del botón de ayuda existe para todas las vistas, pero hay que saber abrirla. Las vistas que
 * no muestran datos de negocio sino el propio sistema —el centro de comando y el mapa— son justo las
 * que desorientan a quien entra por primera vez, así que en ellas la explicación va arriba, a la vista.
 */
export function ScreenExplainer({ lead, points }: Readonly<{ lead: React.ReactNode; points: readonly ExplainerPoint[] }>) {
  return (
    <section aria-labelledby="screen-explainer-title" className="rounded-lg border border-teal-200 bg-teal-50/60 p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white text-[#006a61] ring-1 ring-teal-200">
          <Icon name="lightbulb" className="text-[18px]" />
        </span>
        <div className="min-w-0">
          <h2 id="screen-explainer-title" className="text-sm font-bold text-slate-900">¿Qué estás viendo?</h2>
          <p className="mt-0.5 max-w-4xl text-sm leading-6 text-slate-700">{lead}</p>
        </div>
      </div>
      <ol className="mt-4 grid gap-3 md:grid-cols-3">
        {points.map((point, index) => (
          <li key={point.title} className="rounded-md bg-white p-3 ring-1 ring-teal-100">
            <p className="flex items-center gap-2 text-xs font-bold text-slate-900">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#006a61] text-[10px] text-white">{index + 1}</span>
              {point.title}
            </p>
            <p className="mt-1.5 text-xs leading-5 text-slate-600">{point.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
