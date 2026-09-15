/**
 * Modo «estoy transcribiendo un papel».
 *
 * Quien pasa al sistema un formulario rellenado a mano usa la misma pantalla de siempre; lo único
 * que cambia es que declara el NÚMERO DE SERIE impreso al pie del papel. Con eso el backend marca
 * cada registro como nacido en papel (`source_system = ERP_PAPER`, serie en la auditoría) sin que
 * ninguna pantalla tenga que saberlo: las cabeceras salen de aquí y las pone `apiClient`.
 *
 * Vive en `sessionStorage`, no por usuario ni en el servidor: es un estado de la SESIÓN de trabajo
 * de quien transcribe (treinta papeles seguidos), y se apaga al cerrar la pestaña.
 */

export interface Transcripcion {
  /** `DOC-` y doce caracteres hexadecimales: el `documentId` que imprimió el generador. */
  serial: string;
  formCode?: string;
  formVersion?: string;
}

const CLAVE = 'atlas_transcripcion_papel';
export const PATRON_SERIE = /^DOC-[0-9A-F]{12}$/;

function almacen(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

export function transcripcionActiva(): Transcripcion | null {
  const raw = almacen()?.getItem(CLAVE);
  if (!raw) return null;
  try {
    const valor = JSON.parse(raw) as Partial<Transcripcion>;
    if (typeof valor.serial !== 'string' || !PATRON_SERIE.test(valor.serial)) return null;
    return {
      serial: valor.serial,
      ...(valor.formCode ? { formCode: valor.formCode } : {}),
      ...(valor.formVersion ? { formVersion: valor.formVersion } : {}),
    };
  } catch {
    return null;
  }
}

/** Normaliza la serie tal como la escribe una persona («doc-4f3a…», con espacios) y la valida. */
export function normalizarSerie(entrada: string): string | null {
  const serie = entrada.trim().toUpperCase().replace(/\s+/g, '');
  const conPrefijo = serie.startsWith('DOC-') ? serie : `DOC-${serie}`;
  return PATRON_SERIE.test(conPrefijo) ? conPrefijo : null;
}

export function activarTranscripcion(valor: Transcripcion): void {
  almacen()?.setItem(CLAVE, JSON.stringify(valor));
  notificar();
}

export function desactivarTranscripcion(): void {
  almacen()?.removeItem(CLAVE);
  notificar();
}

/** Cabeceras que el backend entiende (`RequestContextMiddleware`). Vacío si no se transcribe. */
export function cabecerasDeTranscripcion(): Record<string, string> {
  const activa = transcripcionActiva();
  if (!activa) return {};
  return {
    'x-atlas-entry-channel': 'PAPER',
    'x-atlas-paper-serial': activa.serial,
    ...(activa.formCode
      ? { 'x-atlas-paper-form': activa.formVersion ? `${activa.formCode}@${activa.formVersion}` : activa.formCode }
      : {}),
  };
}

const EVENTO = 'atlas:transcripcion';
function notificar(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENTO));
}

/** Para que un componente se repinte cuando el modo cambia desde otro sitio de la misma pestaña. */
export function alCambiarTranscripcion(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(EVENTO, callback);
  return () => window.removeEventListener(EVENTO, callback);
}
