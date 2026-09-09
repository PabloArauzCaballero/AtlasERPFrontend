/**
 * Enlaces al Motor de Decisión desde el ERP.
 *
 * El ERP no decide nada del KYB —pide, y guarda lo que el Motor publicó—, así que lo único honesto
 * que puede ofrecer sobre una decisión es llevar a donde está la traza. Sin
 * `NEXT_PUBLIC_DECISION_ENGINE_URL` no se pinta ningún enlace: un enlace a una pantalla que no
 * existe hace dudar de si el dato está mal. Mismo criterio que `engine-links.ts` del portal interno.
 */
const BASE = (process.env.NEXT_PUBLIC_DECISION_ENGINE_URL ?? '').replace(/\/+$/, '');

export function engineConfigurado(): boolean {
  return BASE.length > 0;
}

export function engineExecutionUrl(executionId: string | null | undefined): string | null {
  if (!engineConfigurado() || !executionId) return null;
  return `${BASE}/executions/${encodeURIComponent(executionId)}`;
}

export function engineManualReviewUrl(caseCode: string | null | undefined): string | null {
  if (!engineConfigurado() || !caseCode) return null;
  return `${BASE}/manual-reviews/${encodeURIComponent(caseCode)}`;
}
