'use client';

import { useEffect } from 'react';
import { instalarCapturadorDeErrores } from '@/lib/erroresCliente';

/**
 * Engancha el capturador de errores del navegador (`lib/erroresCliente.ts`) una vez por carga de
 * página. Va en el layout raíz, fuera de `AuthProvider`: tiene que funcionar también sin sesión.
 */
export function CapturadorDeErrores() {
  useEffect(() => {
    instalarCapturadorDeErrores();
  }, []);
  return null;
}
