import { cn } from '@/lib/cn';
import { Icon } from './Icon';

type NoticeTone = 'info' | 'success' | 'warning' | 'danger';

const classes: Record<NoticeTone, string> = {
  info: 'border-blue-200 bg-blue-50 text-blue-800',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  danger: 'border-red-200 bg-red-50 text-red-800',
};
const icons: Record<NoticeTone, string> = { info: 'info', success: 'check_circle', warning: 'warning', danger: 'error' };

export function InlineNotice({ tone = 'info', title, children, className }: Readonly<{ tone?: NoticeTone; title?: string; children: React.ReactNode; className?: string }>) {
  return (
    <div className={cn(`flex gap-3 rounded-md border p-3 text-sm ${classes[tone]}`, className)}>
      <Icon name={icons[tone]} className="mt-0.5 text-[18px]" />
      <div>{title ? <p className="font-bold">{title}</p> : null}<div className="text-xs leading-5">{children}</div></div>
    </div>
  );
}
