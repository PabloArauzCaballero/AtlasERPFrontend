/**
 * Cobertura BNPL dicha como se le dice a quien opera.
 *
 * El backend responde con códigos estables (`FOUR_EYES_REQUIRED`, `DUPLICATE_REFERENCE`…) y con un
 * mensaje escrito para el registro técnico —«La CxP ATLAS→comercio…»—. Quien liquida una cobertura
 * no habla de «CxP» ni de «ATLAS→comercio»: habla de la cobertura, del comercio y del comprobante.
 * Aquí se traduce por CÓDIGO, no por texto, para que un cambio de redacción del backend no deje la
 * pantalla hablando en jerga.
 *
 * Sin dependencias a propósito: la batería `e2e/cobertura-bnpl.evidencia.spec.ts` transpila este
 * módulo al vuelo y lo prueba aislado.
 */

/** Por código del backend: qué pasó y qué hacer. */
export const MENSAJES_COBERTURA: Record<string, string> = {
  FOUR_EYES_REQUIRED:
    'Usted registró esta liquidación, así que no puede aprobarla ni rechazarla: tiene que hacerlo otra persona del equipo de finanzas.',
  DUPLICATE_REFERENCE:
    'Esa referencia ya está registrada en otro pago. Revise el número del comprobante: cada pago lleva su propia referencia.',
  SETTLEMENT_ALREADY_REGISTERED:
    'Esta cobertura ya tiene una liquidación registrada. Espere a que otra persona la apruebe o la rechace antes de registrar otra.',
  SETTLEMENT_IN_PROGRESS:
    'Esta cobertura tiene una liquidación esperando aprobación. Pida que la rechacen antes de cancelar la cobertura.',
  PAYABLE_CANCELLED: 'Esta cobertura está cancelada: ya no se le puede registrar un pago.',
  PAYABLE_ALREADY_PAID: 'Esta cobertura ya está pagada al comercio. Si hubo un error, hay que revertirlo con un movimiento aprobado.',
  PAYABLE_NOT_PAYABLE: 'La cobertura cambió de estado y ya no admite este pago. Recargue la lista para ver cómo está.',
  NO_SETTLEMENT: 'Esta cobertura todavía no tiene una liquidación registrada que aprobar.',
  NO_PENDING_SETTLEMENT: 'Esta cobertura no tiene una liquidación pendiente: ya se decidió o todavía no se registró.',
  SETTLEMENT_AMOUNT_MISMATCH:
    'El importe liquidado ya no coincide con la cobertura. Rechace esta liquidación y registre una nueva con el importe correcto.',
  NOT_DUE: 'La cuota todavía no venció: sólo se cubre una cuota vencida e impaga.',
  ALREADY_PAID: 'La cuota ya está pagada: no hay nada que cubrir.',
  CANCELLED: 'La cuota o su compra están canceladas: no hay nada que cubrir.',
  ALREADY_COVERED: 'La cuota ya tiene una cobertura en curso. Búsquela en la pestaña «Coberturas».',
  STATUS_NOT_ELIGIBLE: 'La cuota no está en un estado que se pueda cubrir.',
  RECOVERY_OVERPAYMENT: 'El monto supera lo que falta por recuperar. Revise el importe: no se puede cobrar de más al cliente.',
  RECOVERY_WRITTEN_OFF: 'Esta recuperación está castigada: ya no admite cobros.',
  CURRENCY_MISMATCH: 'La moneda del cobro no es la de la recuperación.',
  ALREADY_REVERSED: 'Ese cobro ya se había revertido.',
  RECOVERY_NEGATIVE: 'El reverso dejaría lo recuperado por debajo de cero.',
  REVIEW_ITEM_ALREADY_RESOLVED:
    'Otra persona ya resolvió esta revisión mientras usted la tenía abierta. Recargue la lista para ver cómo quedó.',
  REVIEW_ACTION_NOT_ALLOWED:
    'Esta revisión no se resuelve así: si hay un aviso de pago pendiente, hay que confirmarlo o rechazarlo; si no, sólo se puede descartar con un motivo.',
  NO_PENDING_NOTICE: 'El aviso de pago ya se decidió por otra vía. Descarte la revisión con un motivo.',
  NOTICE_NOT_PENDING: 'Ese aviso de pago ya no está pendiente. Recargue la lista y elija otro.',
  NOTICE_ID_REQUIRED: 'La cuota tiene varios avisos de pago pendientes: elija cuál está decidiendo.',
  COVERAGE_IN_PLACE:
    'Atlas ya cubrió esta cuota al comercio: no se puede dar además por pagada por el cliente. Cancele la cobertura si aún no se pagó, o registre lo cobrado como recuperación.',
};

/**
 * Un mismo código dice cosas distintas según dónde se opera: `FOUR_EYES_REQUIRED` en la cola de
 * revisión no habla de una liquidación sino de la cobertura que esa persona pidió.
 */
const MENSAJES_POR_CONTEXTO: Record<ContextoDeCobertura, Record<string, string>> = {
  liquidacion: {},
  revision: {
    FOUR_EYES_REQUIRED:
      'Usted pidió la cobertura que mandó esta cuota a revisión, así que no puede resolverla: tiene que hacerlo otra persona del equipo de finanzas.',
  },
};

export type ContextoDeCobertura = 'liquidacion' | 'revision';

/**
 * `SETTLEMENT_MISMATCH` trae la lista de lo que no cuadra, en jerga («importe 10.00 ≠ CxP 300.00;
 * el beneficiario no es el comercio de la CxP»). Se traduce cada motivo por separado para que la
 * persona sepa QUÉ campo corregir, que es lo único útil de este rechazo.
 */
const MOTIVOS_DE_DESCUADRE: Array<{ patron: RegExp; texto: (m: RegExpMatchArray) => string }> = [
  { patron: /importe\s+(\S+)\s*≠\s*CxP\s+(\S+)/i, texto: (m) => `el importe (${m[1]}) no es el de la cobertura (${m[2]})` },
  { patron: /moneda\s+(\S+)\s*≠\s*CxP\s+(\S+)/i, texto: (m) => `la moneda (${m[1]}) no es la de la cobertura (${m[2]})` },
  { patron: /beneficiario/i, texto: () => 'el comercio elegido no es el de la cobertura' },
  { patron: /futuro/i, texto: () => 'la fecha del pago no puede ser posterior a hoy' },
  { patron: /evidencia/i, texto: () => 'el comprobante no se encontró o fue retirado; vuelva a adjuntarlo' },
];

function explicarDescuadre(mensaje: string): string {
  const cola = mensaje.includes(':') ? mensaje.slice(mensaje.indexOf(':') + 1) : mensaje;
  const motivos = cola
    .split(';')
    .map((parte) => parte.trim().replace(/\.$/, ''))
    .filter(Boolean)
    .map((parte) => {
      for (const motivo of MOTIVOS_DE_DESCUADRE) {
        const encontrado = parte.match(motivo.patron);
        if (encontrado) return motivo.texto(encontrado);
      }
      return null;
    })
    .filter((texto): texto is string => texto !== null);
  if (motivos.length === 0) return 'Los datos del pago no coinciden con la cobertura. Revise importe, moneda, comercio, fecha y comprobante.';
  return `Los datos del pago no coinciden con la cobertura: ${motivos.join('; ')}.`;
}

/** El texto para la persona, a partir del error que lanzó el cliente de la API. */
export function mensajeDeCobertura(error: unknown, contexto: ContextoDeCobertura = 'liquidacion'): string | null {
  if (!error || typeof error !== 'object') return null;
  const { code, message } = error as { code?: unknown; message?: unknown };
  if (typeof code !== 'string') return null;
  if (code === 'SETTLEMENT_MISMATCH') return explicarDescuadre(typeof message === 'string' ? message : '');
  return MENSAJES_POR_CONTEXTO[contexto][code] ?? MENSAJES_COBERTURA[code] ?? null;
}

/**
 * Ejecuta la llamada y, si falla con un código conocido, relanza el MISMO error con el mensaje
 * traducido. Se conserva el objeto (y su `status`/`code`) para quien necesite ramificar.
 */
export async function conMensajesDeCobertura<T>(
  llamada: () => Promise<T>,
  contexto: ContextoDeCobertura = 'liquidacion',
): Promise<T> {
  try {
    return await llamada();
  } catch (error) {
    const traducido = mensajeDeCobertura(error, contexto);
    if (traducido && error instanceof Error) error.message = traducido;
    throw error;
  }
}

/** Por qué una cuota está en la cola de revisión. */
export const MOTIVOS_DE_REVISION: Record<string, string> = {
  PAYMENT_NOTICE_UNRESOLVED: 'El cliente avisó un pago que nadie verificó a tiempo',
  COVERAGE_WITH_PENDING_NOTICE: 'Se pidió cubrir una cuota con un aviso de pago sin verificar',
  CONTRACT_NOT_ACTIVE: 'Se pidió cubrir una cuota de un contrato que no está activo',
};

/** Cómo se cerró una revisión, para la vista de lo ya resuelto. */
export const DESENLACES_DE_REVISION: Record<string, string> = {
  COVERAGE_SCHEDULED: 'Se programó la cobertura',
  NOTICE_CONFIRMED: 'Se confirmó el pago del cliente',
  NOTICE_REJECTED: 'Se rechazó el aviso de pago',
  DISMISSED: 'Se descartó',
};

export function motivoDeRevision(codigo: unknown): string {
  const texto = String(codigo ?? '');
  return MOTIVOS_DE_REVISION[texto] ?? (texto ? texto.replaceAll('_', ' ').toLowerCase() : '—');
}

/**
 * Importe exacto con dos decimales, como cadena («300» → «300.00»). Devuelve `null` si no es un
 * importe positivo con dos decimales como mucho: el backend lo rechazaría igual, y mejor decirlo
 * antes de subir el comprobante.
 */
export function importeExacto(valor: unknown): string | null {
  const texto = String(valor ?? '').trim().replace(',', '.');
  const partes = /^(\d{1,16})(?:\.(\d{1,2}))?$/.exec(texto);
  if (!partes) return null;
  const entero = partes[1]!.replace(/^0+(?=\d)/, '');
  const decimales = (partes[2] ?? '').padEnd(2, '0');
  if (/^0+$/.test(entero) && decimales === '00') return null;
  return `${entero}.${decimales}`;
}

/** Referencia de pago/liquidación: la misma regla que aplica el backend. */
export const PATRON_REFERENCIA = /^[A-Za-z0-9][A-Za-z0-9._:/-]{2,119}$/;

/** Margen de reloj, igual de generoso que el del backend: dos relojes nunca están en hora exacta. */
const MARGEN_RELOJ_MS = 5 * 60_000;

/**
 * Lo que se puede comprobar antes de mandar nada, en el orden en que se rellena el formulario.
 * Devuelve el primer problema, dicho en lenguaje de usuario, o `null` si está listo.
 */
export function problemaDeLiquidacion(
  datos: { settlementReference?: unknown; amount?: unknown; paidAt?: unknown; tieneComprobante: boolean },
  ahora: Date = new Date(),
): string | null {
  if (!PATRON_REFERENCIA.test(String(datos.settlementReference ?? '').trim())) {
    return 'La referencia del pago debe tener entre 3 y 120 caracteres: letras, números y . _ : / - (sin espacios).';
  }
  if (importeExacto(datos.amount) === null) return 'El importe debe ser mayor que cero y con dos decimales como máximo.';
  const fecha = new Date(String(datos.paidAt ?? ''));
  if (Number.isNaN(fecha.getTime())) return 'Indique la fecha y hora del pago según el comprobante.';
  if (fecha.getTime() > ahora.getTime() + MARGEN_RELOJ_MS) return 'La fecha del pago no puede ser posterior a hoy.';
  if (!datos.tieneComprobante) return 'Adjunte el comprobante del pago o elija uno ya subido del comercio.';
  return null;
}

/** Importe para leer («Bs 1.234,50», también «Bs 0,00»); sólo se muestra, no se opera. */
export function importeLegible(valor: unknown, moneda: unknown = 'BOB'): string {
  const partes = /^(\d{1,16})(?:\.(\d{1,2}))?$/.exec(String(valor ?? '').trim());
  if (!partes) return '—';
  const entero = partes[1]!.replace(/^0+(?=\d)/, '');
  const decimales = (partes[2] ?? '').padEnd(2, '0');
  const miles = entero.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const simbolo = String(moneda ?? 'BOB') === 'BOB' ? 'Bs' : String(moneda);
  return `${simbolo} ${miles},${decimales}`;
}

function fechaCorta(valor: unknown): string {
  const fecha = new Date(String(valor ?? ''));
  if (Number.isNaN(fecha.getTime())) return '';
  return `${String(fecha.getUTCDate()).padStart(2, '0')}/${String(fecha.getUTCMonth() + 1).padStart(2, '0')}/${fecha.getUTCFullYear()}`;
}

/** Un aviso de pago del cliente, dicho en una línea: «Bs 300,00 pagados el 20/09/2026». */
export function descripcionDelAviso(aviso: { amount?: unknown; paidAt?: unknown }): string {
  const fecha = fechaCorta(aviso.paidAt);
  return `${importeLegible(aviso.amount)}${fecha ? ` pagados el ${fecha}` : ''}`;
}

/** La cuota de un elemento de revisión: «Cuota 2 · vence el 30/09/2026». */
export function descripcionDeCuota(cuota: { installmentNumber?: unknown; dueDate?: unknown } | null | undefined): string {
  if (!cuota) return '—';
  const fecha = fechaCorta(cuota.dueDate);
  return `Cuota ${String(cuota.installmentNumber ?? '')}${fecha ? ` · vence el ${fecha}` : ''}`;
}

/**
 * La liquidación de una cobertura según el listado del sistema. `registradaPorMi` sale de
 * `settlementRegisteredByMe` (lo calcula el sistema para esta sesión) o de lo que esta misma
 * pantalla acaba de registrar, que la tabla todavía puede no haber recargado.
 */
export function estadoDeLiquidacion(
  fila: { settlementStatus?: unknown; settlementRegisteredByMe?: unknown },
  registradaAqui = false,
): { texto: string; pendiente: boolean; registradaPorMi: boolean; hay: boolean } {
  const estado = String(fila.settlementStatus ?? '');
  const registradaPorMi = fila.settlementRegisteredByMe === true || registradaAqui;
  if (estado === 'CONFIRMED') return { texto: 'Pago aprobado', pendiente: false, registradaPorMi, hay: true };
  if (estado === 'PENDING_APPROVAL' || registradaAqui) {
    return {
      texto: registradaPorMi
        ? 'Registrado por usted · falta la aprobación de otra persona'
        : 'Registrado · espera la aprobación de otra persona',
      pendiente: true,
      registradaPorMi,
      hay: true,
    };
  }
  return { texto: 'Sin registrar', pendiente: false, registradaPorMi: false, hay: false };
}
