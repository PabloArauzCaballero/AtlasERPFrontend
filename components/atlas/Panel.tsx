import { cn } from '@/lib/cn';
import { Icon } from './Icon';

interface PanelProps {
  title?: string | undefined;
  description?: string | undefined;
  icon?: string | undefined;
  action?: React.ReactNode | undefined;
  children: React.ReactNode;
  className?: string | undefined;
  compact?: boolean;
  /**
   * Ancla para el motor de tutoriales. Se declara explícitamente en vez de
   * aceptar props sueltas: así el panel sigue teniendo una superficie cerrada y
   * el recorrido puede apuntar a él sin envolverlo en un `div` de más.
   */
  'data-tutorial-id'?: string | undefined;
}

export function Panel({ title, description, icon, action, children, className, compact = false, ...rest }: PanelProps) {
  return (
    <section
      data-tutorial-id={rest['data-tutorial-id']}
      className={cn('overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]', className)}
    >
      {title || action ? (
        <header className="flex min-h-14 items-center justify-between gap-4 border-b border-slate-200 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            {icon ? <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-slate-100 text-slate-700"><Icon name={icon} className="text-[18px]" /></span> : null}
            <div className="min-w-0">
              {title ? <h2 className="truncate text-sm font-bold text-slate-900">{title}</h2> : null}
              {description ? <p className="mt-0.5 text-xs text-slate-500">{description}</p> : null}
            </div>
          </div>
          {action}
        </header>
      ) : null}
      <div className={compact ? 'p-3' : 'p-4'}>{children}</div>
    </section>
  );
}
