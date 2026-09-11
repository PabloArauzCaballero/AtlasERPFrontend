'use client';

import { useCallback } from 'react';
import { InlineNotice } from '@/components/atlas/InlineNotice';
import { useAsyncResource } from '@/hooks/useAsyncResource';
import { b2bService } from '@/services/b2bService';

/**
 * Qué contrato legal por defecto rige en Atlas, dicho en la cola de onboarding.
 *
 * Es el texto que Atlas exige tener vigente para que el Motor apruebe a un comercio; no es el
 * contrato comercial del caso, que sigue siendo del ERP. Se publica y se versiona desde el portal
 * interno, y aquí sólo se LEE: si no hay ninguno, la cola lo dice en vez de dejar que el primer
 * rechazo del Motor lo cuente. Sin sesión de Atlas (401) no se afirma nada.
 */
export function LegalContractNotice() {
  const recurso = useAsyncResource(useCallback(() => b2bService.getDefaultLegalContractTemplate(), []));
  if (recurso.status === 'loading' || recurso.status === 'idle') return null;
  if (recurso.status === 'unauthorized' || recurso.status === 'forbidden' || recurso.status === 'error' || recurso.status === 'timeout') return null;

  const plantilla = recurso.data?.template ?? null;
  if (!plantilla) {
    return (
      <InlineNotice tone="warning" title="No hay contrato legal por defecto publicado en Atlas">
        El Motor no aprueba a ningún comercio sin un contrato legal vigente. Se publica desde el portal interno
        (Administración › Contratos de comercio); el ERP sólo lo lee.
      </InlineNotice>
    );
  }
  return (
    <InlineNotice tone="info" title={`Contrato legal por defecto vigente: ${String(plantilla.name)} · v${String(plantilla.version)}`}>
      Código {String(plantilla.templateCode)}. Rige para todos los comercios nuevos; el contrato comercial de cada caso se pacta aparte, en su fila.
    </InlineNotice>
  );
}
