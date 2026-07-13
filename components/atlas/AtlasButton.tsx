'use client';

import { cn } from '@/lib/cn';
import { Icon } from './Icon';
import { LoadingSpinner } from '@/components/ui/LoadingIndicator';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';

interface AtlasButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: string;
  loading?: boolean;
  variant?: ButtonVariant;
}

const variants: Record<ButtonVariant, string> = {
  primary: 'border-[#031636] bg-[#031636] text-white hover:bg-[#142746]',
  secondary: 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50',
  danger: 'border-red-600 bg-red-600 text-white hover:bg-red-700',
  ghost: 'border-transparent bg-transparent text-slate-700 hover:bg-slate-100',
  success: 'border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700',
};

export function AtlasButton({ children, className, icon, loading = false, variant = 'primary', disabled, type = 'button', ...props }: AtlasButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cn('inline-flex h-9 items-center justify-center gap-2 rounded-md border px-3 text-xs font-bold shadow-sm transition active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60', variants[variant], className)}
      {...props}
    >
      {loading ? <LoadingSpinner label="Procesando" /> : icon ? <Icon name={icon} className="text-[17px]" /> : null}
      {children}
    </button>
  );
}
