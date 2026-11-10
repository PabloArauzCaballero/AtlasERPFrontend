import { cn } from '@/lib/cn';

type StatusTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'purple';

const toneClasses: Record<StatusTone, string> = {
  neutral: 'bg-surface-sunken text-ink-muted',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-primary-wash text-primary',
  // `purple` se conserva como nombre para no tocar llamadas; la identidad sólo admite el azul.
  purple: 'bg-primary-wash text-primary',
};

export function StatusPill({ children, tone = 'neutral', dot = true }: Readonly<{ children: React.ReactNode; tone?: StatusTone; dot?: boolean }>) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium', toneClasses[tone])}>
      {dot ? <span className="h-1.5 w-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}
