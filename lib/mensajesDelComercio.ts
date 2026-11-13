/**
 * Lo que se le dice al COMERCIO cuando el núcleo rechaza algo, por código de negocio.
 *
 * El núcleo publica el motivo como código (`CREDIT_EXPOSURE_LIMIT_EXCEEDED`), en `error.code` o —en
 * los endpoints más viejos— como prefijo del mensaje con un código genérico de HTTP al lado
 * (`{ code: 'CONFLICT', message: 'CREDIT_EXPOSURE_LIMIT_EXCEEDED' }`). Las pantallas enseñaban ese
 * texto tal cual: la cajera leía «CREDIT_EXPOSURE_LIMIT_EXCEEDED» con el cliente delante.
 *
 * Una sola tabla por cliente, por código; una familia por prefijo para lo que aún no tiene frase; y
 * un respaldo que NUNCA imprime un código. La prueba de esta tabla falla si un código del catálogo
 * del núcleo con audiencia `merchant` no tiene su frase aquí.
 */

import catalogo from './error-codes.json';

const MENSAJES: Readonly<Record<string, string>> = {
  // La compra en la caja
  CREDIT_EXPOSURE_LIMIT_EXCEEDED:
    'El cliente no tiene cupo suficiente para esta compra. La solicitud quedó cerrada; puede volver a pedirla por un importe menor.',
  CREDIT_DECISION_EXPIRED:
    'La aprobación de esta compra venció. La solicitud quedó cerrada; el cliente puede escanear el QR y pedirla de nuevo.',
  CREDIT_BUSINESS_ACCEPTANCE_NOT_PENDING:
    'Esta solicitud ya fue respondida (desde otra caja o por Cuotea). Actualizamos la lista.',
  CREDIT_APPLICATION_ALREADY_DECIDED: 'Esta solicitud ya tiene una respuesta. Actualizamos la lista.',
  CREDIT_APPLICATION_NOT_FOUND: 'Esta solicitud ya no está disponible para tu comercio.',
  CREDIT_APPLICATION_NOT_APPROVED: 'Cuotea todavía no aprobó esta compra. Espera unos segundos y vuelve a mirar.',
  CREDIT_EXPOSURE_ALREADY_CONSUMED: 'El cupo de esta compra ya se usó en otra operación. La solicitud quedó cerrada.',
  CREDIT_EXPOSURE_RESERVATION_NOT_AVAILABLE:
    'El cupo reservado para esta compra ya no está disponible. La solicitud quedó cerrada.',
  CREDIT_LIMIT_UNKNOWN: 'No pudimos confirmar el cupo del cliente. Intenta de nuevo en unos minutos.',
  CONSENT_REVOKED_AFTER_DECISION:
    'El cliente retiró una autorización necesaria para el crédito. Esta compra no puede seguir.',
  REQUIRED_CONSENT_MISSING: 'Al cliente le falta aceptar una autorización necesaria para el crédito.',
  DECISION_ENGINE_UNAVAILABLE: 'El sistema de aprobación no responde en este momento. Intenta de nuevo en unos minutos.',
  LOAN_ALREADY_DISBURSED: 'Esta compra ya fue desembolsada.',
  // El pago inicial que se cobra en caja
  DOWN_PAYMENT_ALREADY_CONFIRMED: 'Este pago inicial ya estaba confirmado.',
  DOWN_PAYMENT_NOT_PENDING: 'Este pago inicial ya fue respondido. Actualizamos la lista.',
  DOWN_PAYMENT_ALREADY_PENDING: 'El cliente ya avisó este pago inicial; está esperando tu respuesta.',
  DOWN_PAYMENT_WITHOUT_PROOF: 'El cliente todavía no subió el comprobante del pago inicial.',
  DOWN_PAYMENT_AMOUNT_MISMATCH: 'El importe avisado no coincide con el pago inicial de esta compra.',
  DOWN_PAYMENT_AMOUNT_INVALID: 'El importe del pago inicial no es válido.',
  DOWN_PAYMENT_EXPECTED_UNKNOWN: 'No pudimos calcular el pago inicial de esta compra. Avísale a soporte.',
  DOWN_PAYMENT_NOT_ALLOWED_YET: 'Todavía no se puede registrar el pago inicial: primero hay que aceptar la compra.',
  // Los comprobantes de cuota
  PAYMENT_CLAIM_NOT_FOUND: 'Este comprobante ya no está disponible.',
  PAYMENT_CLAIM_NOT_PENDING: 'Este comprobante ya fue respondido. Actualizamos la lista.',
  PAYMENT_CLAIM_ALREADY_PENDING: 'El cliente ya avisó este pago; está esperando tu respuesta.',
  PAYMENT_CLAIM_WITHOUT_PROOF: 'Este aviso de pago no trae imagen del comprobante.',
  INSTALLMENT_ALREADY_PAID: 'Esa cuota ya está pagada.',
  // El expediente, las sucursales y las cajas
  PARTNER_NOT_FOUND: 'No encontramos el expediente de tu comercio.',
  PARTNER_NOT_EDITABLE_IN_STATUS: 'El expediente de tu comercio no se puede modificar en su estado actual.',
  PARTNER_NETWORK_NOT_EDITABLE_IN_STATUS: 'Las sucursales no se pueden modificar mientras el expediente está en revisión.',
  PARTNER_QR_NOT_EDITABLE_IN_STATUS: 'El QR de cobro no se puede cambiar en el estado actual del expediente.',
  PARTNER_SUBMISSION_INCOMPLETE: 'Faltan datos o documentos en el expediente. Revisa lo marcado y vuelve a enviarlo.',
  PARTNER_BRANCH_NOT_FOUND: 'No encontramos esa sucursal.',
  PARTNER_BRANCH_ALREADY_LINKED: 'Esa sucursal ya está vinculada.',
  PARTNER_CONTACT_ALREADY_VERIFIED: 'Ese contacto ya está verificado.',
  PARTNER_VERIFICATION_CODE_INVALID: 'El código no es correcto. Revísalo e inténtalo de nuevo.',
  PARTNER_VERIFICATION_CODE_EXPIRED: 'El código venció. Pide uno nuevo.',
  PARTNER_VERIFICATION_NOT_REQUESTED: 'Primero pide el código de verificación.',
  PARTNER_VERIFICATION_RATE_LIMITED: 'Pediste varios códigos seguidos. Espera un momento antes de pedir otro.',
  PARTNER_VERIFICATION_ATTEMPTS_EXHAUSTED: 'Se agotaron los intentos. Pide un código nuevo.',
  POS_SERIAL_ALREADY_REGISTERED: 'Ese número de serie ya está registrado en otra caja.',
  BRANCH_CODE_ALREADY_REGISTERED: 'Ya tienes una sucursal con ese código. Usa otro.',
  // El QR de cobro
  QR_NOT_FOUND: 'No encontramos ese QR.',
  QR_NOT_PENDING_REVIEW: 'Ese QR ya fue revisado.',
  QR_EXPIRED: 'Ese QR venció. Genera o sube uno nuevo.',
  QR_REVOKED: 'Ese QR fue dado de baja. Usa el vigente.',
  QR_NOT_RECOGNIZED: 'No reconocimos ese QR. Comprueba que sea el de tu comercio.',
  QR_IMAGE_UNREADABLE: 'No pudimos leer el QR de la imagen. Sube una foto más nítida.',
  QR_OBJECT_NOT_AN_IMAGE: 'El archivo no es una imagen. Sube el QR como foto o PNG.',
  QR_OBJECT_NOT_FOUND: 'La imagen del QR no terminó de subirse. Vuelve a subirla.',
  QR_OBJECT_NOT_READABLE: 'No pudimos abrir la imagen del QR. Vuelve a subirla.',
  QR_OBJECT_OUTSIDE_PARTNER_SCOPE: 'Esa imagen no pertenece a tu comercio. Vuelve a subirla.',
  QR_IMAGE_HAS_NO_CODE: 'No encontramos ningún QR en esa imagen. Sube una foto donde se vea el código entero.',
  QR_IMAGE_TOO_LARGE: 'La imagen del QR es demasiado grande. Sube una foto más liviana.',
  // El alta, el contrato y la ficha en el ERP
  PARTNER_CONTRACT_TEMPLATE_ARCHIVED: 'Ese modelo de contrato ya no está vigente. Pide a Cuotea el modelo actual.',
  PARTNER_CONTRACT_TEMPLATE_NOT_FOUND: 'No encontramos el modelo de contrato. Avísale a soporte.',
  PARTNER_DECISION_CONFLICT: 'El expediente cambió mientras lo revisabas. Actualiza y vuelve a intentarlo.',
  PARTNER_DECISION_DELEGADA_AL_MOTOR: 'La aprobación de este expediente la decide el sistema de verificación de Cuotea.',
  PARTNER_ERP_ACCOUNT_ALREADY_LINKED: 'Este expediente ya está vinculado a otra ficha. Avísale a soporte.',
  PARTNER_NOT_UNDER_REVIEW: 'El expediente no está en revisión ahora mismo.',
  PARTNER_TAX_ID_ALREADY_REGISTERED: 'Ya hay un comercio registrado con ese NIT.',
  ERP_BRANCH_ALREADY_LINKED: 'Esa sucursal ya está vinculada a otra del sistema.',
  ERP_DOCUMENT_KEY_NOT_OWNED: 'Ese documento no pertenece a tu comercio. Vuelve a subirlo.',
  ERP_DOCUMENT_NOT_FOUND: 'No encontramos ese documento. Vuelve a subirlo.',
  POWER_OF_ATTORNEY_OBJECT_NOT_FOUND: 'El poder notarial no terminó de subirse. Vuelve a subirlo.',
  POWER_OF_ATTORNEY_OUTSIDE_PARTNER_SCOPE: 'Ese poder notarial no pertenece a tu comercio. Vuelve a subirlo.',
  // Usuarios del comercio
  MERCHANT_USER_EMAIL_TAKEN: 'Ese correo ya tiene un usuario. Usa otro.',
  MERCHANT_USER_NOT_FOUND: 'No encontramos ese usuario.',
  MERCHANT_PROVISIONING_REQUEST_ALREADY_DECIDED: 'Esa solicitud de acceso ya fue respondida.',
  MERCHANT_PROVISIONING_REQUEST_NOT_FOUND: 'No encontramos esa solicitud de acceso.',
  MERCHANT_PROVISIONING_REQUEST_PENDING_FOR_EMAIL: 'Ya hay una solicitud de acceso pendiente para ese correo.',
  WEAK_PASSWORD: 'La contraseña es muy débil. Usa al menos 8 caracteres con letras y números.',
  MAIL_CHANNEL_NOT_AVAILABLE: 'El envío de correos no está disponible ahora. Intenta más tarde.',
  // Archivos
  EVIDENCE_CONTENT_TYPE_NOT_ALLOWED: 'Ese tipo de archivo no se admite. Sube una imagen o un PDF.',
  DOCUMENT_STORAGE_NOT_CONFIGURED: 'El almacén de archivos no está disponible ahora. Intenta más tarde.',
  // La red
  UPSTREAM_UNAVAILABLE: 'Cuotea no respondió a tiempo. Revisa la lista antes de repetir: puede que ya se haya guardado.',
};

/** Lo que aún no tiene frase propia cae a la de su familia: nunca al código. */
const FAMILIAS: readonly (readonly [string, string])[] = [
  ['DOWN_PAYMENT_', 'No pudimos registrar el pago inicial. Revisa la lista y vuelve a intentarlo.'],
  ['PAYMENT_CLAIM_', 'No pudimos registrar la respuesta a este comprobante. Revisa la lista y vuelve a intentarlo.'],
  ['CREDIT_', 'No pudimos completar esta compra. Revisa la lista y vuelve a intentarlo.'],
  ['QR_', 'No pudimos usar ese QR. Vuelve a intentarlo o avísale a soporte.'],
  ['PARTNER_VERIFICATION_', 'No pudimos verificar el código. Pide uno nuevo.'],
  ['PARTNER_', 'No pudimos actualizar el expediente de tu comercio. Vuelve a intentarlo.'],
];

/**
 * Las respuestas que significan «esta solicitud ya no se puede aceptar»: la pantalla la muestra
 * CERRADA en vez de dejarla pendiente con un botón que sólo puede volver a fallar.
 */
export const CODIGOS_QUE_CIERRAN_LA_SOLICITUD: ReadonlySet<string> = new Set([
  'CREDIT_EXPOSURE_LIMIT_EXCEEDED',
  'CREDIT_DECISION_EXPIRED',
  'CREDIT_EXPOSURE_ALREADY_CONSUMED',
  'CREDIT_EXPOSURE_RESERVATION_NOT_AVAILABLE',
  'CONSENT_REVOKED_AFTER_DECISION',
]);

/** Las que dicen que alguien ya respondió: la lista está vieja y hay que recargarla. */
export const CODIGOS_DE_LISTA_VIEJA: ReadonlySet<string> = new Set([
  'CREDIT_BUSINESS_ACCEPTANCE_NOT_PENDING',
  'CREDIT_APPLICATION_ALREADY_DECIDED',
  'CREDIT_APPLICATION_NOT_FOUND',
  'DOWN_PAYMENT_NOT_PENDING',
  'DOWN_PAYMENT_ALREADY_CONFIRMED',
  'PAYMENT_CLAIM_NOT_PENDING',
  'PAYMENT_CLAIM_NOT_FOUND',
]);

/** Los códigos que sólo repiten el estado HTTP: no dicen qué pasó. */
const GENERICOS = new Set([
  'BAD_REQUEST',
  'PAYLOAD_TOO_LARGE',
  'RATE_LIMIT_EXCEEDED',
  'INTERNAL_ERROR',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'GONE',
  'UNPROCESSABLE_ENTITY',
  'TOO_MANY_REQUESTS',
  'INTERNAL_SERVER_ERROR',
  'BAD_GATEWAY',
  'SERVICE_UNAVAILABLE',
  'GATEWAY_TIMEOUT',
  'VALIDATION_ERROR',
  'HTTP_ERROR',
  'ERROR',
]);

/** `CODIGO` o `CODIGO: detalle` al principio de un texto. */
const PREFIJO = /^([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)(?=$|\s*:)/;
/** Cualquier código suelto dentro de un texto, para no enseñarlo nunca. */
const PARECE_CODIGO = /\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+){1,}\b/;

/** El código de negocio de un error: el de `error.code` si no es genérico, o el prefijo del mensaje. */
export function codigoDeNegocio(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null;
  const { code, message } = error as { code?: unknown; message?: unknown };
  const propio = typeof code === 'string' ? code.trim() : '';
  if (propio && !GENERICOS.has(propio)) return propio;
  const prefijo = typeof message === 'string' ? PREFIJO.exec(message.trim())?.[1] : undefined;
  return prefijo && !GENERICOS.has(prefijo) ? prefijo : null;
}

/**
 * Los códigos que el catálogo del núcleo (`error-codes.json`, copia de
 * `AtlasBackend/contracts/error-codes/error-codes.json`) marca `internal`: no hay frase para el
 * comercio, pero soporte los necesita. La pantalla dice el texto genérico y añade el código.
 */
const INTERNOS: ReadonlySet<string> = new Set(
  (catalogo as { codes: { code: string; audience: string }[] }).codes
    .filter((entrada) => entrada.audience === 'internal')
    .map((entrada) => entrada.code),
);

/** ¿Tiene frase propia este código? (La usa la prueba contra el catálogo del núcleo.) */
export function tieneMensajeParaComercio(codigo: string): boolean {
  return Object.prototype.hasOwnProperty.call(MENSAJES, codigo);
}

/**
 * La frase para el comercio. Orden: la del código; la de su familia; el texto del error si es una
 * frase humana (los mensajes del propio portal lo son); y si no, el respaldo. Nunca un código.
 */
export function mensajeParaComercio(
  error: unknown,
  respaldo = 'No pudimos completar la operación. Revisa la lista y vuelve a intentarlo.',
): string {
  const codigo = codigoDeNegocio(error);
  if (codigo) {
    if (tieneMensajeParaComercio(codigo)) return MENSAJES[codigo]!;
    // Interno: no es para el comercio, pero sí para quien lo atienda en soporte.
    if (INTERNOS.has(codigo)) return `${respaldo} Si vuelve a pasar, avisa a soporte con el código ${codigo}.`;
    const familia = FAMILIAS.find(([prefijo]) => codigo.startsWith(prefijo));
    if (familia) return familia[1];
  }
  const texto =
    error && typeof error === 'object' && typeof (error as { message?: unknown }).message === 'string'
      ? ((error as { message: string }).message || '').trim()
      : '';
  if (texto && !PARECE_CODIGO.test(texto) && esFraseHumana(texto)) return texto;
  return respaldo;
}

/** Un error de programa («x.map is not a function») no es una frase para una persona. */
function esFraseHumana(texto: string): boolean {
  return !/is not a function|Cannot read properties|undefined|null|NaN|Unexpected token|\bat\s+\S+:\d+/i.test(texto);
}
