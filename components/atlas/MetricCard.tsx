import { Icon } from './Icon';

interface MetricCardProps {
  label: string;
  value: React.ReactNode;
  detail?: string;
  icon?: string;
  trend?: 'up' | 'down' | 'flat';
  tone?: 'navy' | 'teal' | 'amber' | 'red' | 'purple';
}

const iconTone = {
  navy: 'bg-blue-50 text-[#006a61]',
  teal: 'bg-teal-50 text-teal-700',
  amber: 'bg-amber-50 text-amber-700',
  red: 'bg-red-50 text-red-700',
  purple: 'bg-violet-50 text-violet-700',
};

export function MetricCard({ label, value, detail, icon = 'analytics', trend = 'flat', tone = 'navy' }: MetricCardProps) {
  const trendClass = trend === 'up' ? 'text-emerald-600' : trend === 'down' ? 'text-red-600' : 'text-slate-500';
  return (
    <article className="flex min-h-28 items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white/80 p-4 backdrop-blur-[2px] shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">{label}</p>
        <div className="mt-1 truncate text-2xl font-bold text-slate-900">{value}</div>
        {detail ? <p className={`mt-1 flex items-center gap-1 text-[11px] font-semibold ${trendClass}`}><Icon name={trend === 'up' ? 'trending_up' : trend === 'down' ? 'trending_down' : 'fiber_manual_record'} className="text-[14px]" />{detail}</p> : null}
      </div>
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${iconTone[tone]}`}><Icon name={icon} className="text-[23px]" /></span>
    </article>
  );
}
