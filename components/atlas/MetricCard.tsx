import { Icon } from './Icon';

interface MetricCardProps {
  label: string;
  value: React.ReactNode;
  detail?: string;
  icon?: string;
  trend?: 'up' | 'down' | 'flat';
  tone?: 'navy' | 'teal' | 'amber' | 'red' | 'purple';
}

/*
 * El chip del icono lleva un degradado corto del propio tono, no un plano.
 *
 * Es la diferencia entre un círculo de color y un objeto con volumen: dos paradas de la misma
 * familia bastan para que la luz parezca venir de arriba, que es lo que hace que una tarjeta se
 * lea como una pieza física y no como un rectángulo pintado.
 */
const iconTone = {
  navy: 'bg-gradient-to-br from-[#e2f1ef] to-[#cde5e2] text-[#00544d]',
  teal: 'bg-gradient-to-br from-teal-50 to-teal-100 text-teal-700',
  amber: 'bg-gradient-to-br from-amber-50 to-amber-100 text-amber-700',
  red: 'bg-gradient-to-br from-red-50 to-red-100 text-red-700',
  purple: 'bg-gradient-to-br from-violet-50 to-violet-100 text-violet-700',
};

export function MetricCard({ label, value, detail, icon = 'analytics', trend = 'flat', tone = 'navy' }: MetricCardProps) {
  const trendClass = trend === 'up' ? 'text-emerald-600' : trend === 'down' ? 'text-red-600' : 'text-slate-500';
  return (
    <article className="group relative flex min-h-28 items-center justify-between gap-4 overflow-hidden rounded-xl border border-slate-200/90 bg-white/80 p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_28px_-18px_rgba(15,23,42,0.25)] backdrop-blur-[2px] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_4px_10px_rgba(15,23,42,0.06),0_22px_44px_-20px_rgba(15,23,42,0.35)]">
      {/* Halo que sólo aparece al apuntar: confirma qué tarjeta está bajo el cursor en una rejilla
          de tarjetas iguales, y desaparece sin dejar ruido cuando no hay puntero. */}
      <span aria-hidden className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-primary-wash opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <div className="relative min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">{label}</p>
        <div className="mt-1 truncate text-2xl font-bold tabular-nums tracking-tight text-slate-900">{value}</div>
        {detail ? <p className={`mt-1 flex items-center gap-1 text-[11px] font-semibold ${trendClass}`}><Icon name={trend === 'up' ? 'trending_up' : trend === 'down' ? 'trending_down' : 'fiber_manual_record'} className="text-[14px]" />{detail}</p> : null}
      </div>
      <span className={`relative grid h-11 w-11 shrink-0 place-items-center rounded-2xl transition-transform duration-200 ease-out group-hover:scale-110 ${iconTone[tone]}`}><Icon name={icon} className="text-[23px]" /></span>
    </article>
  );
}
