/**
 * Lo que el cierre comprueba DE VERDAD, dicho antes de pulsar.
 *
 * Sólo bloquea un control: que no queden documentos contables del período en borrador. Los de
 * conciliación contable y extractos bancarios existen, pero ninguna parte del ERP carga esos datos,
 * así que hoy siempre dan cero y no protegen nada.
 */
export const TEXTO_CONFIRMAR_CIERRE =
  'Antes de cerrar se comprueba que no queden documentos contables del período en borrador; si hay alguno, no se cierra. ' +
  'La conciliación contable y los extractos bancarios NO se comprueban: el ERP no tiene esos datos. ' +
  'El cierre sólo congela el período: no liquida impuestos ni traslada el resultado del ejercicio; esos asientos se registran aparte.';

const EVALUACION: Record<string, string> = {
  ENFORCED: 'comprobado',
  NO_DATA_SOURCE: 'sin fuente de datos, no se comprobó',
  INFORMATIVE: 'sólo informativo',
};

/** El informe de controles que devuelve el cierre, en una frase por control. */
export function resumenDelCierre(resultado: unknown): string {
  const informe = (resultado as { controlReportJson?: { controls?: unknown; closeNumber?: unknown } } | null)?.controlReportJson;
  const controles = Array.isArray(informe?.controls) ? (informe.controls as Array<Record<string, unknown>>) : [];
  const vez = typeof informe?.closeNumber === 'number' && informe.closeNumber > 1 ? ` Es la ${informe.closeNumber}.ª vez que se cierra este período.` : '';
  if (!controles.length) return `No quedaban documentos en borrador. La conciliación y los extractos bancarios no se comprobaron.${vez}`;
  const lineas = controles.map((control) => {
    const texto = String(control.description ?? control.code ?? '');
    const como = EVALUACION[String(control.evaluation ?? '')] ?? 'sin evaluar';
    return `${texto} (${como})`;
  });
  return `${lineas.join(' · ')}${vez}`;
}
