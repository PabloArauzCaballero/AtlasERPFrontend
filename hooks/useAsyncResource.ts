'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type AsyncStatus = 'idle' | 'loading' | 'success' | 'empty' | 'error';

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
        status: 'error',
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
