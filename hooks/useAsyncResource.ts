'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '@/lib/apiClient';

/**
 * Los estados que una carga puede tener, y que la pantalla puede tratar por separado.
 *
 * Antes eran cinco —`idle | loading | success | empty | error`— y los tres casos que exigen
 * acciones DISTINTAS caían todos en `error`: `LiveDirectoryScreen` pintaba el mismo aviso rojo
 * («No se pudo cargar la información») tanto si al usuario le faltaba un permiso, como si se le
 * había caducado la sesión, como si el servidor no había contestado.
 *
 * Son tres salidas opuestas: pedir el rol, volver a entrar, o reintentar. Con un solo estado la
 * pantalla no podía ofrecer ninguna, y el usuario se quedaba con «¿por qué no puedo continuar?»
 * sin forma de averiguarlo. `error` se conserva para todo lo demás (500, 404, respuesta rara).
 */
export type AsyncStatus =
  | 'idle'
  | 'loading'
  | 'success'
  | 'empty'
  | 'unauthorized'
  | 'forbidden'
  | 'timeout'
  | 'error';

interface AsyncState<TData> {
  data: TData | null;
  error: string | null;
  status: AsyncStatus;
}

function isEmptyPayload(value: unknown): boolean {
  if (Array.isArray(value)) return value.length === 0;
  if (value && typeof value === 'object' && 'items' in value) {
    const items = (value as { items?: unknown }).items;
    return Array.isArray(items) && items.length === 0;
  }
  return value === null || value === undefined;
}

/**
 * Traduce el fallo al estado que la pantalla sabe tratar.
 *
 * Sólo `ApiError` trae `status`; cualquier otra cosa que se lance (un fallo al mapear la respuesta,
 * un error de programación) es un `error` genérico y debe seguir siéndolo: fingir un 500 donde hay
 * un `TypeError` escondería un defecto nuestro detrás de un mensaje de servidor.
 */
function statusFromError(error: unknown): AsyncStatus {
  if (!(error instanceof ApiError)) return 'error';
  if (error.timedOut || error.status === 504 || error.status === 408) return 'timeout';
  if (error.status === 401) return 'unauthorized';
  if (error.status === 403) return 'forbidden';
  // Sin respuesta (red caída, servidor apagado): se ofrece reintentar, que es la acción correcta.
  if (error.status === 0) return 'timeout';
  return 'error';
}

/**
 * Ejecuta cargas asíncronas manteniendo datos previos durante recargas.
 * Esto evita que la pantalla parezca congelada o parpadee mientras cambia filtro/página.
 */
export function useAsyncResource<TData>(load: () => Promise<TData>, autoLoad = true) {
  const requestIdRef = useRef(0);
  const [state, setState] = useState<AsyncState<TData>>({
    data: null,
    error: null,
    status: 'idle',
  });

  const reload = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setState((current) => ({ ...current, error: null, status: 'loading' }));

    try {
      const data = await load();
      if (requestIdRef.current !== requestId) return;
      setState({ data, error: null, status: isEmptyPayload(data) ? 'empty' : 'success' });
    } catch (error) {
      if (requestIdRef.current !== requestId) return;
      setState((current) => ({
        data: current.data,
        error: error instanceof Error ? error.message : 'Error inesperado.',
        status: statusFromError(error),
      }));
    }
  }, [load]);

  useEffect(() => {
    if (autoLoad) void reload();
  }, [autoLoad, reload]);

  useEffect(() => () => {
    requestIdRef.current += 1;
  }, []);

  return { ...state, reload };
}

/** `true` para cualquier estado que signifique «esta carga no trajo datos porque algo falló». */
export function isFailureStatus(status: AsyncStatus): boolean {
  return status === 'error' || status === 'unauthorized' || status === 'forbidden' || status === 'timeout';
}
