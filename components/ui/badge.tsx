import { cn } from '@/lib/cn';

interface BadgeProps {
  children: React.ReactNode;
  tone?: 'neutral' | 'success' | 'warning' | 'danger';
}

const tones = {
  neutral: 'bg-surface-muted text-on-surface-variant',
  success: 'bg-emerald-50 text-emerald-700',
  warning: 'bg-amber-50 text-amber-700',
  danger: 'bg-red-50 text-red-700',
};

export function Badge({ children, tone = 'neutral' }: BadgeProps) {
  return <span className={cn('rounded-full px-2 py-1 text-xs font-semibold', tones[tone])}>{children}</span>;
}
