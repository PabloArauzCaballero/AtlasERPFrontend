import type { AsyncStatus } from '@/hooks/useAsyncResource';
import { Icon } from '@/components/atlas/Icon';
import { AtlasButton } from '@/components/atlas/AtlasButton';
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

  /*
   * El vacío y el error dejan de ser una frase suelta dentro de una tarjeta.
   *
   * Un icono aquí NO es adorno: es lo que separa de un vistazo «no hay nada que mostrar» de «algo
   * se rompió», que son dos situaciones con acciones opuestas —cambiar los filtros o reintentar— y
   * que en una sola línea de texto gris se leían igual. El borde discontinuo dice lo mismo por
   * otra vía: un contenedor que espera contenido, no un contenedor con contenido.
   */
  if (status === 'empty') {
    return (
      <div className="flex min-h-48 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white/70 p-8 text-center">
        <span className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-slate-100 to-slate-200 text-slate-500">
          <Icon name="search_off" className="text-[26px]" />
        </span>
        <p className="text-sm font-bold text-slate-800">Sin registros</p>
        <p className="mt-1 max-w-md text-sm text-on-surface-variant">
          Ningún resultado coincide con los filtros actuales. Amplía el rango o limpia la búsqueda.
        </p>
      </div>
    );
  }

  /*
   * Los tres fallos que NO son «se rompió algo», cada uno con su salida.
   *
   * Antes los cuatro caían en la misma tarjeta roja con el mismo botón de reintentar, y reintentar
   * es exactamente lo que NO resuelve ni un permiso que falta ni una sesión caducada: el usuario
   * pulsaba, volvía a fallar igual, y no tenía forma de saber qué le pasaba. Aquí cada estado dice
   * qué ocurrió y ofrece la única acción que lo arregla.
   */
  if (status === 'forbidden') {
    return (
      <Card className="border-amber-200 bg-amber-50 text-sm text-amber-900">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-700">
            <Icon name="lock" className="text-[22px]" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-amber-900">Tu usuario no tiene acceso a esta información.</p>
            {/* Reintentar no se ofrece a propósito: el permiso no cambia por volver a pedirlo. */}
            <p className="mt-1 break-words">
              {error ?? 'Pide a un administrador el rol necesario para esta pantalla.'}
            </p>
          </div>
        </div>
      </Card>
    );
  }

  if (status === 'unauthorized') {
    return (
      <Card className="border-slate-300 bg-slate-50 text-sm text-slate-700">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-slate-200 text-slate-600">
            <Icon name="person_off" className="text-[22px]" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-slate-900">Tu sesión ha caducado.</p>
            <p className="mt-1 break-words">Vuelve a iniciar sesión para seguir donde estabas.</p>
            {/*
              * Se conserva la ruta actual para volver a ella después de entrar: mandar al usuario
              * al inicio le obliga a rehacer la navegación que ya había hecho.
              */}
            <AtlasButton
              className="mt-3"
              variant="secondary"
              icon="login"
              onClick={() => {
                const destino = typeof window === 'undefined' ? '' : window.location.pathname + window.location.search;
                window.location.href = `/login?next=${encodeURIComponent(destino)}`;
              }}
            >
              Iniciar sesión
            </AtlasButton>
          </div>
        </div>
      </Card>
    );
  }

  if (status === 'timeout') {
    return (
      <Card className="border-slate-300 bg-slate-50 text-sm text-slate-700">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-slate-200 text-slate-600">
            <Icon name="cloud_off" className="text-[22px]" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-slate-900">El servidor no respondió a tiempo.</p>
            <p className="mt-1 break-words">
              {error ?? 'Puede ser una conexión lenta. Vuelve a intentarlo.'}
            </p>
            {onRetry ? (
              <AtlasButton className="mt-3" variant="secondary" icon="refresh" onClick={onRetry}>
                Reintentar
              </AtlasButton>
            ) : null}
          </div>
        </div>
      </Card>
    );
  }

  if (status === 'error') {
    return (
      <Card className="border-red-200 bg-danger-wash text-sm text-red-700">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-red-100 text-red-600">
            <Icon name="error" className="text-[22px]" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-red-800">No se pudo cargar la información.</p>
            <p className="mt-1 break-words">{error ?? 'El servicio no respondió a tiempo.'}</p>
            {onRetry ? (
              <AtlasButton className="mt-3" variant="secondary" icon="refresh" onClick={onRetry}>
                Reintentar
              </AtlasButton>
            ) : null}
          </div>
        </div>
      </Card>
    );
  }

  return null;
}
