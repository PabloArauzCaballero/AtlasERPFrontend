'use client';

import { cn } from '@/lib/cn';
import { Icon } from './Icon';
import { LoadingSpinner } from '@/components/ui/LoadingIndicator';

type ButtonVariant = 'primary' | 'strong' | 'secondary' | 'danger' | 'ghost' | 'success';

interface AtlasButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: string;
  loading?: boolean;
  variant?: ButtonVariant;
}

/*
 * La acción principal de la pantalla va en amarillo de marca con tinta encima, y sólo ella (una por
 * pantalla). `strong` es el botón en tinta para una acción importante que no es la principal;
 * `secondary` es el botón neutro de consola; `ghost` es el terciario, texto azul sin fondo.
 * `danger` y `success` van rellenos: ahí el color ES la información.
 */
const variants: Record<ButtonVariant, string> = {
  primary: 'border-brand bg-brand text-on-brand hover:border-brand-strong hover:bg-brand-strong active:bg-brand-strong',
  strong: 'border-ink bg-ink text-canvas hover:border-slate-800 hover:bg-slate-800',
  secondary: 'border-border-strong bg-white text-slate-900 hover:bg-surface-sunken',
  danger: 'border-danger bg-danger text-white hover:opacity-90',
  ghost: 'border-transparent bg-transparent text-primary hover:bg-primary-wash',
  success: 'border-success bg-success text-white hover:opacity-90',
};

export function AtlasButton({ children, className, icon, loading = false, variant = 'primary', disabled, type = 'button', ...props }: AtlasButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cn(
        'atlas-tap inline-flex h-9 items-center justify-center gap-2 rounded-md border px-3 text-xs font-semibold transition-colors duration-150 ease-out',
        'disabled:cursor-not-allowed disabled:opacity-60',
        variants[variant],
        className,
      )}
      {...props}
    >
      {loading ? <LoadingSpinner label="Procesando" /> : icon ? <Icon name={icon} className="text-[17px]" /> : null}
      {children}
    </button>
  );
}
