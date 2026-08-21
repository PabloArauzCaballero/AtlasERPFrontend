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

/*
 * La acción principal va en casi negro, no en el acento.
 *
 * Es la regla del motor de decisión, y su razón está escrita en su propio tema: un bloque de color
 * saturado del tamaño de un botón compite con el contenido. En este sistema el color es SEÑAL —lo
 * llevan los estados y la letra del acento—, así que el botón aporta jerarquía por contraste y no
 * por saturación. `danger` y `success` sí lo llevan: ahí el color ES la información.
 */
const variants: Record<ButtonVariant, string> = {
  primary: 'border-slate-900 bg-slate-900 text-white hover:bg-slate-950',
  secondary: 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50',
  danger: 'border-danger bg-danger text-white hover:brightness-95',
  ghost: 'border-transparent bg-transparent text-slate-700 hover:bg-slate-100',
  success: 'border-success bg-success text-white hover:brightness-95',
};

export function AtlasButton({ children, className, icon, loading = false, variant = 'primary', disabled, type = 'button', ...props }: AtlasButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cn(
        'atlas-tap inline-flex h-9 items-center justify-center gap-2 rounded-lg border px-3 text-xs font-bold shadow-sm transition-all duration-150 ease-out',
        'hover:-translate-y-px hover:shadow-md active:translate-y-0 active:scale-[0.97]',
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20',
        'disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-60 disabled:shadow-none',
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
