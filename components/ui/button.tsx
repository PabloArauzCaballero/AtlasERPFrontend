import { cn } from '@/lib/cn';
import type { ButtonHTMLAttributes } from 'react';
import { LoadingSpinner } from './LoadingIndicator';

type ButtonVariant = 'primary' | 'secondary' | 'destructive';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
  loadingLabel?: string;
  variant?: ButtonVariant;
}

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-on-primary hover:opacity-90',
  secondary: 'border border-border-subtle bg-surface hover:bg-surface-muted',
  destructive: 'bg-danger text-white hover:opacity-90',
};

export function Button({ children, className, disabled, isLoading = false, loadingLabel = 'Cargando', variant = 'primary', ...props }: ButtonProps) {
  return (
    <button
      aria-busy={isLoading}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60',
        variants[variant],
        className,
      )}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? <LoadingSpinner className="h-3.5 w-3.5" label={loadingLabel} /> : null}
      <span>{isLoading ? loadingLabel : children}</span>
    </button>
  );
}
