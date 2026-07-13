import { cn } from '@/lib/cn';

interface LoadingSpinnerProps {
  className?: string;
  label?: string;
}

interface InlineLoadingProps extends LoadingSpinnerProps {
  text?: string;
}

/**
 * Spinner pequeño y reutilizable para acciones que no deben parecer congeladas.
 */
export function LoadingSpinner({ className, label = 'Cargando' }: LoadingSpinnerProps) {
  return (
    <span aria-label={label} className={cn('inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent', className)} role="status" />
  );
}

/**
 * Indicador compacto para botones, tarjetas y zonas de actualización.
 */
export function InlineLoading({ className, text = 'Cargando', label }: InlineLoadingProps) {
  return (
    <span className={cn('inline-flex items-center gap-2 text-sm text-on-surface-variant', className)}>
      <LoadingSpinner label={label ?? text} />
      <span>{text}</span>
    </span>
  );
}

export function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-surface-muted', className)} />;
}
