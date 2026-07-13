'use client';

import { useEffect, useState } from 'react';
import type { Option } from '@/services/optionLoaders';

/** Carga opciones {label,value} desde un loader una sola vez (para selects de UUID). */
export function useOptions(loader: () => Promise<Option[]>): Option[] {
  const [options, setOptions] = useState<Option[]>([]);
  useEffect(() => {
    let cancelled = false;
    loader()
      .then((result) => { if (!cancelled) setOptions(result); })
      .catch(() => { /* select queda vacío si falla la carga */ });
    return () => { cancelled = true; };
    // Se carga una vez al montar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return options;
}
