'use client';

import { useCallback } from 'react';
import { InlineNotice } from '@/components/atlas/InlineNotice';
import { useAsyncResource } from '@/hooks/useAsyncResource';
import { b2bService } from '@/services/b2bService';

/**
 * Avisa SÓLO si falta el contrato legal por defecto.
 *
 * Antes anunciaba también el contrato vigente, y eso era un párrafo fijo en la cabecera de la cola
 * que repetía en cada visita algo que no cambia y que no pide hacer nada. Que haya contrato es lo
 * normal: el silencio ya lo dice. Que NO lo haya sí para el trabajo —ningún comercio se aprueba sin
 * él— y por eso es lo único que se pinta. Sin sesión de Atlas no se afirma nada.
 */
export function LegalContractNotice() {
  const recurso = useAsyncResource(useCallback(() => b2bService.getDefaultLegalContractTemplate(), []));
  if (recurso.status === 'loading' || recurso.status === 'idle') return null;
  if (recurso.status === 'unauthorized' || recurso.status === 'forbidden' || recurso.status === 'error' || recurso.status === 'timeout') return null;
  if (recurso.data?.template) return null;

  return (
    <InlineNotice tone="warning" title="Falta publicar el contrato de afiliación">
      Ningún comercio nuevo se puede aprobar sin un contrato vigente. Se publica en el portal interno,
      en Administración › Contratos de comercio.
    </InlineNotice>
  );
}
