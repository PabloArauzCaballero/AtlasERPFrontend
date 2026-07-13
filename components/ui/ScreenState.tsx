import type { AsyncStatus } from '@/hooks/useAsyncResource';
import { Button } from './button';
import { Card } from './card';
import { InlineLoading, SkeletonBlock } from './LoadingIndicator';

interface ScreenStateProps {
  error?: string | null;
  hasData?: boolean;
  onRetry?: () => void;
  status: AsyncStatus;
}

function LoadingCard({ compact }: { compact: boolean }) {
  return (
    <Card className="space-y-3 text-sm text-on-surface-variant">
      <InlineLoading text={compact ? 'Actualizando datos' : 'Cargando datos del backend'} />
      {!compact ? (
        <div className="space-y-2 pt-1">
          <SkeletonBlock className="h-8" />
          <SkeletonBlock className="h-8" />
          <SkeletonBlock className="h-8" />
        </div>
      ) : null}
    </Card>
  );
}

export function ScreenState({ error, hasData = false, onRetry, status }: ScreenStateProps) {
  if (status === 'idle' || status === 'success') return null;
  if (status === 'loading') return <LoadingCard compact={hasData} />;

  if (status === 'empty') {
    return <Card className="text-sm text-on-surface-variant">No hay registros para los filtros actuales.</Card>;
  }

  if (status === 'error') {
    return (
      <Card className="space-y-3 border-red-200 bg-red-50 text-sm text-red-700">
        <p>{error ?? 'No se pudo cargar la información.'}</p>
        {onRetry ? <Button onClick={onRetry}>Reintentar</Button> : null}
      </Card>
    );
  }

  return null;
}
