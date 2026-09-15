import type {
  AudienceAttribute,
  AudienceOperator,
  AudienceRule,
  CampaignChannel,
  CampaignPurpose,
  CampaignStatus,
} from '@/services/notificationCampaignsService';

/**
 * Vocabulario de la pantalla de campañas: etiquetas legibles para cada estado, canal, atributo y
 * operador. Ningún código crudo llega a quien opera: «hasOverdueInstallment is_true» se lee «Tiene
 * una cuota vencida».
 *
 * Los atributos y sus operadores son un espejo del contrato de AtlasBackend
 * (`platform/contracts/campaign-audience.ts`). Si allí se añade uno, aquí hay que darle nombre; si
 * aquí se ofrece uno que allí no existe, el backend lo rechaza al validar y el aviso lo dice.
 */

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'purple';

export const STATUS_META: Record<CampaignStatus, { label: string; tone: Tone; hint: string }> = {
  draft: { label: 'Borrador', tone: 'neutral', hint: 'No envía nada hasta que se programe.' },
  scheduled: { label: 'Programada', tone: 'info', hint: 'Empieza sola a la hora de inicio.' },
  running: { label: 'En curso', tone: 'success', hint: 'Enviando a la cadencia elegida.' },
  paused: { label: 'Pausada', tone: 'warning', hint: 'No sale nada hasta reanudarla.' },
  completed: { label: 'Terminada', tone: 'purple', hint: 'Llegó a todos o venció su fecha de fin.' },
  cancelled: { label: 'Cancelada', tone: 'danger', hint: 'Se anularon los avisos que no habían salido.' },
  failed: { label: 'Fallida', tone: 'danger', hint: 'El envío se detuvo por un error: revisa el motivo.' },
};

export const CHANNEL_META: Record<CampaignChannel, { label: string; icon: string; hint: string }> = {
  in_app: { label: 'Bandeja de la app', icon: 'inbox', hint: 'Aparece en la pestaña Avisos. Llega a toda la audiencia.' },
  push: { label: 'Notificación push', icon: 'notifications_active', hint: 'Sólo a quien tiene la app con los avisos activados.' },
  email: { label: 'Correo electrónico', icon: 'mail', hint: 'Sólo a quien tiene un correo verificado.' },
};

export const PURPOSE_OPTIONS: Array<{ value: CampaignPurpose; label: string }> = [
  { value: 'marketing', label: 'Comercial (sólo a quien aceptó recibir promociones)' },
  { value: 'operational', label: 'Operativa (servicio, cobranza o seguridad: va a toda la audiencia)' },
];

export const OPERATOR_LABELS: Record<AudienceOperator, string> = {
  eq: 'es',
  neq: 'no es',
  in: 'es alguno de',
  not_in: 'no es ninguno de',
  gte: 'al menos',
  lte: 'como máximo',
  is_true: 'sí',
  is_false: 'no',
};

export type ValueKind = 'none' | 'text' | 'list' | 'number' | 'select';

export interface AttributeMeta {
  label: string;
  hint: string;
  operators: AudienceOperator[];
  valueKind: (operator: AudienceOperator) => ValueKind;
  options?: Array<{ value: string; label: string }>;
  unit?: string;
}

const DEPARTMENTS = ['La Paz', 'Cochabamba', 'Santa Cruz', 'Oruro', 'Potosí', 'Chuquisaca', 'Tarija', 'Beni', 'Pando'].map((name) => ({
  value: name.toLowerCase(),
  label: name,
}));

const textOrList = (operator: AudienceOperator): ValueKind => (operator === 'in' || operator === 'not_in' ? 'list' : 'text');
const flag = (): ValueKind => 'none';

export const ATTRIBUTE_META: Record<AudienceAttribute, AttributeMeta> = {
  city: { label: 'Ciudad', hint: 'La ciudad de su domicilio declarado.', operators: ['eq', 'neq', 'in', 'not_in'], valueKind: textOrList },
  department: {
    label: 'Departamento',
    hint: 'El departamento de su domicilio declarado.',
    operators: ['eq', 'neq', 'in', 'not_in'],
    valueKind: (operator) => (operator === 'in' || operator === 'not_in' ? 'list' : 'select'),
    options: DEPARTMENTS,
  },
  lifecycleStatus: {
    label: 'Etapa del cliente',
    hint: 'Estado del ciclo de vida, por ejemplo active u onboarding. Los bloqueados nunca reciben.',
    operators: ['eq', 'neq', 'in', 'not_in'],
    valueKind: textOrList,
  },
  hasCreditLine: { label: 'Tiene línea de crédito vigente', hint: 'Una línea aprobada con límite y sin vencer.', operators: ['is_true', 'is_false'], valueKind: flag },
  hasActiveLoan: { label: 'Tiene un crédito activo', hint: 'Un préstamo desembolsado y no cancelado.', operators: ['is_true', 'is_false'], valueKind: flag },
  hasOverdueInstallment: { label: 'Tiene una cuota vencida', hint: 'Al menos una cuota en mora.', operators: ['is_true', 'is_false'], valueKind: flag },
  daysSinceSignup: {
    label: 'Días desde el alta',
    hint: 'Antigüedad de la cuenta en días.',
    operators: ['gte', 'lte'],
    valueKind: () => 'number',
    unit: 'días',
  },
  hasPushDevice: { label: 'Tiene la app con avisos activados', hint: 'Un teléfono registrado para recibir push.', operators: ['is_true', 'is_false'], valueKind: flag },
  pushPlatform: {
    label: 'Sistema del teléfono',
    hint: 'Android o iPhone, según el dispositivo registrado.',
    operators: ['eq', 'in'],
    valueKind: (operator) => (operator === 'in' ? 'list' : 'select'),
    options: [
      { value: 'android', label: 'Android' },
      { value: 'ios', label: 'iPhone' },
    ],
  },
  hasVerifiedEmail: { label: 'Tiene correo verificado', hint: 'Un correo confirmado por la persona.', operators: ['is_true', 'is_false'], valueKind: flag },
  marketingOptIn: {
    label: 'Aceptó recibir promociones',
    hint: 'Consentimiento de comunicaciones comerciales dado en la app.',
    operators: ['is_true', 'is_false'],
    valueKind: flag,
  },
};

export const ATTRIBUTE_OPTIONS = (Object.keys(ATTRIBUTE_META) as AudienceAttribute[]).map((value) => ({ value, label: ATTRIBUTE_META[value].label }));

/** A dónde lleva tocar el aviso. Rutas reales de la app del cliente; nunca una URL externa. */
export const DEEP_LINK_OPTIONS = [
  { value: '', label: 'Abrir la app (sin pantalla concreta)' },
  { value: '/avisos', label: 'Avisos' },
  { value: '/pagos', label: 'Pagos y cuotas' },
  { value: '/escanear', label: 'Pagar con QR' },
  { value: '/progreso', label: 'Progreso de la solicitud' },
  { value: '/perfil', label: 'Perfil' },
  { value: '/preferencias-avisos', label: 'Preferencias de avisos' },
  { value: '/soporte', label: 'Soporte' },
  { value: '/ayuda', label: 'Ayuda' },
];

export const RATE_OPTIONS = [
  { value: '60', label: '60 por minuto (suave)' },
  { value: '300', label: '300 por minuto' },
  { value: '600', label: '600 por minuto (recomendado)' },
  { value: '1500', label: '1.500 por minuto' },
  { value: '6000', label: '6.000 por minuto (máximo)' },
];

export function describeRule(rule: AudienceRule): string {
  const meta = ATTRIBUTE_META[rule.attribute];
  if (!meta) return `${rule.attribute} ${rule.operator}`;
  if (rule.operator === 'is_true') return meta.label;
  if (rule.operator === 'is_false') return `No: ${meta.label.charAt(0).toLowerCase()}${meta.label.slice(1)}`;
  const values = Array.isArray(rule.value) ? rule.value : [rule.value];
  const shown = values
    .map((value) => meta.options?.find((option) => option.value === String(value))?.label ?? String(value ?? ''))
    .join(', ');
  return `${meta.label} ${OPERATOR_LABELS[rule.operator]} ${shown}${meta.unit ? ` ${meta.unit}` : ''}`;
}

const dateTime = new Intl.DateTimeFormat('es-BO', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/La_Paz' });
const integer = new Intl.NumberFormat('es-BO');

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : dateTime.format(date);
}

export function formatCount(value: number | null | undefined): string {
  return integer.format(Number(value ?? 0));
}

/** `datetime-local` trabaja en la hora del navegador; la consola se opera desde Bolivia. */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Mensaje legible de un error de la API, sin perder el código que devuelve el backend. */
export function errorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const known: Record<string, string> = {
    NOTIFICATION_CAMPAIGN_AUDIENCE_EMPTY: 'La audiencia está vacía: nadie cumple el segmento hoy.',
    NOTIFICATION_CAMPAIGN_START_IN_PAST: 'La fecha de inicio ya pasó. Elige una futura o «enviar ahora».',
    NOTIFICATION_CAMPAIGN_ENDS_BEFORE_START: 'La fecha de fin tiene que ser posterior al inicio.',
    NOTIFICATION_CAMPAIGN_WINDOW_INVALID: 'La fecha de fin tiene que ser posterior al inicio.',
    NOTIFICATION_CAMPAIGN_STATUS_CHANGED: 'Otra persona cambió esta campaña mientras la mirabas. Recarga.',
    NOTIFICATION_AUDIENCE_SEGMENT_NAME_TAKEN: 'Ya existe un segmento activo con ese nombre.',
    NOTIFICATION_AUDIENCE_SEGMENT_NOT_FOUND: 'El segmento ya no existe o fue archivado.',
  };
  const code = Object.keys(known).find((key) => raw.includes(key));
  return (code && known[code]) || raw;
}
