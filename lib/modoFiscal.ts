import type { EstadoFiscal } from '@/services/fiscalService';

/**
 * Qué significa, para quien opera, el modo de facturación electrónica del entorno.
 *
 * Hasta el 2026-09-29 las pantallas decían «se envía sola a Impuestos en segundos» y «Factura
 * enviada a Impuestos» con el emulador del SIN detrás (o apagada): ninguna factura llegaba a
 * Impuestos Nacionales. El servidor manda ahora `transporteReal` y `nota`; con uno anterior que no
 * los manda, se asume lo prudente: NO hay envío real.
 */
export interface ModoFiscal {
  /** El nombre del modo en palabras: «Emulador del SIN (pruebas)». */
  etiqueta: string;
  /** `true` sólo si el servidor afirma que las facturas llegan de verdad a Impuestos. */
  real: boolean;
  /** Qué implica, en una frase. */
  aviso: string;
  /** Apagada en el entorno: las pantallas esconden lo que habla con Impuestos. */
  apagada: boolean;
  /** A dónde «se envía» una factura, para los avisos: «al emulador de Impuestos». */
  destino: string;
}

const ETIQUETAS: Record<string, string> = {
  disabled: 'Apagada',
  mock_server: 'Emulador del SIN (pruebas)',
  piloto: 'Piloto del SIN',
  produccion: 'Producción del SIN',
};

export function describirModoFiscal(estado: Partial<EstadoFiscal> | null | undefined): ModoFiscal {
  const mode = String(estado?.mode ?? '');
  const etiqueta = ETIQUETAS[mode] ?? (mode || 'Desconocido');
  const real = estado?.transporteReal === true;
  const respaldo = mode === 'disabled' || estado?.activo === false
    ? 'Las facturas se emiten como representación interna, sin documento fiscal ni validez fiscal: nada se envía a Impuestos Nacionales.'
    : mode === 'mock_server'
      ? 'Hoy sólo funciona contra un emulador del SIN: no hay envío real a Impuestos. El número fiscal, la validación y la anulación son simulados y no tienen validez fiscal.'
      : 'No hay envío real a Impuestos Nacionales en este entorno: ninguna factura llega al SIN.';
  const aviso = real ? (estado?.nota ?? 'Las facturas se envían a Impuestos Nacionales.') : (estado?.nota || respaldo);
  const destino = real ? 'a Impuestos' : mode === 'mock_server' ? 'al emulador de Impuestos' : 'al servicio fiscal de pruebas';
  const apagada = mode === 'disabled' || estado?.activo === false;
  return { etiqueta, real, aviso, destino, apagada };
}
