const bobFormatter = new Intl.NumberFormat('es-BO', {
  style: 'currency',
  currency: 'BOB',
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat('es-BO', {
  dateStyle: 'medium',
  timeZone: 'America/La_Paz',
});

export function formatBob(value: number): string {
  return bobFormatter.format(value);
}

export function formatMicrosAsBob(value: number | string | null | undefined): string {
  const numeric = typeof value === 'string' ? Number(value) : value;
  return typeof numeric === 'number' && Number.isFinite(numeric)
    ? formatBob(numeric / 1_000_000)
    : '—';
}

/** `AAAA-MM-DD` a secas: lo que devuelven las columnas `DATE` del ERP (vigencias, vencimientos). */
const SOLO_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';

  /*
   * Una fecha sin hora no tiene zona horaria, y tratarla como si la tuviera la mueve un día.
   *
   * `new Date('2026-01-01')` es medianoche UTC, y este formateador pinta en `America/La_Paz`
   * (UTC-4): el inicio de un contrato guardado el 1 de enero salía en pantalla como «31 dic de
   * 2025». En un vencimiento o en el cierre de una vigencia ese día de menos no es un detalle
   * cosmético. Se ancla a mediodía UTC, que queda fuera del alcance de cualquier desplazamiento.
   */
  if (typeof value === 'string') {
    const partes = SOLO_FECHA.exec(value);
    if (partes) {
      const [, anio, mes, dia] = partes;
      return dateFormatter.format(new Date(Date.UTC(Number(anio), Number(mes) - 1, Number(dia), 12)));
    }
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : dateFormatter.format(date);
}

const dateTimeFormatter = new Intl.DateTimeFormat('es-BO', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'America/La_Paz',
});

/** Fecha y hora en La Paz. Una fecha sin hora (`AAAA-MM-DD`) se pinta como fecha, sin inventar una hora. */
export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  if (typeof value === 'string' && SOLO_FECHA.test(value)) return formatDate(value);
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : dateTimeFormatter.format(date);
}

/**
 * Cédula de identidad (CI) a la vista (ERP-11): el número se tapa como un teléfono —sólo quedan los
 * tres últimos dígitos— y el complemento y la extensión (`-1A`, `SC`) se tapan enteros, porque con
 * ellos y la terminación el carnet vuelve a ser casi único. Los separadores se conservan para que
 * la forma siga leyéndose como un carnet: `7654321-1A SC` → `****321-** **`.
 *
 * Es enmascarado de PANTALLA, igual que el de teléfonos y NIT: el dato viaja completo desde el
 * backend. En los formularios donde alguien escribe la cédula no se usa.
 */
export function maskCedula(value: unknown): string {
  if (value === null || value === undefined) return '—';
  const text = String(value).trim();
  if (!text) return '';
  const partes = /^(\d+)(.*)$/s.exec(text);
  if (!partes) {
    /* Sin número al principio (cédula extranjera, pasaporte): quedan los tres últimos caracteres. */
    return text.replace(/[\p{L}\d](?=(?:[^\p{L}\d]*[\p{L}\d]){3})/gu, '*');
  }
  const [, numero = '', resto = ''] = partes;
  return numero.replace(/\d(?=\d{3})/g, '*') + maskComplementoCedula(resto);
}

/** Complemento o extensión de la cédula, solos: se tapan enteros (conservando separadores). */
export function maskComplementoCedula(value: unknown): string {
  if (value === null || value === undefined) return '—';
  return String(value).replace(/[\p{L}\d]/gu, '*');
}

/** Columnas que guardan el número de una cédula. Por nombre exacto o por sufijo inequívoco. */
function esCampoCedula(normalized: string): boolean {
  return (
    /^(ci|cedula|carnet|cinumber|cinumero|nationalid|identitynumber|identitydocument|identitydocumentnumber|numerodocumento)$/.test(normalized) ||
    normalized.endsWith('documentnumber')
  );
}

/** Columnas con el complemento o la extensión de una cédula (`taxIdComplement`, `ciExtension`...). */
function esCampoComplementoCedula(normalized: string): boolean {
  return /(complement|complemento|documentextension|ciextension|ciexpedido)$/.test(normalized);
}

export function maskPii(value: unknown, fieldName: string): string {
  if (value === null || value === undefined) return '—';
  const text = String(value);
  const normalized = fieldName.toLowerCase();

  /* Antes que el NIT: `taxIdComplement` lleva «tax» y es el complemento de una CI. */
  if (esCampoComplementoCedula(normalized)) return maskComplementoCedula(text);
  if (esCampoCedula(normalized)) return maskCedula(text);

  if (normalized.includes('email')) {
    const [name, domain] = text.split('@');
    return name && domain ? `${name.slice(0, 2)}***@${domain}` : '***';
  }

  if (normalized.includes('phone')) return text.replace(/\d(?=\d{3})/g, '*');
  if (normalized.includes('tax') || normalized.includes('nit')) return `${text.slice(0, 2)}***`;
  return text;
}

export type StatusTone = 'neutral' | 'success' | 'warning' | 'danger';

/**
 * Color de una etiqueta de estado, a partir de su propio texto.
 *
 * Cada tabla tenía su cadena de expresiones regulares, y todas empezaban preguntando por lo
 * aprobado. Con eso `PENDING_APPROVAL` salía en VERDE —la subcadena «APPROV» gana antes de que
 * nadie mire «PEND»—, o sea que una propuesta que está esperando permiso se leía como concedida.
 * `CLOSED_WON` salía en rojo por la misma razón al revés: «CLOSED» disparaba el rechazo.
 *
 * Aquí el orden es el que importa: primero lo que se cerró bien, luego lo que se cerró mal, luego
 * lo que sigue en curso, y solo al final lo que está concedido. Un estado desconocido queda gris,
 * que es lo honesto: no se inventa un color para algo que no se sabe leer.
 */
export function statusTone(value: unknown): StatusTone {
  const upper = String(value ?? '').toUpperCase();
  if (/(^|_)(WON|GANADA)(_|$)/.test(upper)) return 'success';
  if (/REJECT|BLOCK|FAIL|CANCEL|CLOSED|VOID|REVERS|LOST|OVERDUE|DEFAULT|SUSPEND|DISQUALIF/.test(upper)) return 'danger';
  if (/PEND|REVIEW|DRAFT|PROGRESS|PARTIAL|SCHEDULED|WAITING|HOLD/.test(upper)) return 'warning';
  if (/ACTIVE|APPROV|ACCEPT|SUCCESS|PAID|SIGNED|POSTED|COMPLET|OPEN|ISSUED|SETTLED|RECOVERED|CONFIRMED|VERIFIED|CUSTOMER/.test(upper)) return 'success';
  // Palabra entera: «DONE» está dentro de «ABANDONED».
  if (/(^|_)DONE(_|$)/.test(upper)) return 'success';
  return 'neutral';
}
