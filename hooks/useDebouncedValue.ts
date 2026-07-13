'use client';

import { useEffect, useState } from 'react';

/**
 * Retiene el último valor hasta que el usuario deja de editar.
 * Reduce llamadas repetidas al backend mientras se escribe en filtros de tabla.
 */
export function useDebouncedValue<TValue>(value: TValue, delayMs = 350): TValue {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedValue(value), delayMs);
    return () => window.clearTimeout(timeout);
  }, [delayMs, value]);

  return debouncedValue;
}
