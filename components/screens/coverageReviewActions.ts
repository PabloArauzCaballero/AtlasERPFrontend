import { conMensajesDeCobertura, descripcionDelAviso } from '@/lib/coberturaBnpl';
import { toast } from '@/lib/toast';
import { b2bService, type ResolveReviewItemInput } from '@/services/b2bService';
import type { JsonObject, ResourceRow } from '@/services/types';
import type { ActionField } from './StructuredActionForm';
import type { CrudExtraAction } from './CrudDirectory';

/**
 * Las tres salidas de una cuota en revisión, desde su fila.
 *
 * Antes la pestaña «En revisión» era una lista de consulta: una cuota con un aviso de pago sin
 * verificar no se podía ni dar por pagada ni cubrir, y se quedaba ahí. Ahora quien es de finanzas:
 *  - confirma el pago del cliente (se comprobó con el comercio): cuenta como pagado;
 *  - rechaza el aviso (el pago no se sostiene): la cuota vuelve a poder cubrirse;
 *  - descarta la revisión, con un motivo, cuando no hay pago que decidir (contrato no activo).
 *
 * Qué acciones admite cada fila lo dice el sistema (`allowedActions`), calculado para esta sesión:
 * quien pidió la cobertura que abrió la revisión no la resuelve, y la fila no le ofrece nada.
 */

type Accion = ResolveReviewItemInput['action'];

const permite = (row: ResourceRow, accion: Accion) =>
  Array.isArray(row.allowedActions) && (row.allowedActions as unknown[]).includes(accion);

function avisosPendientes(row: ResourceRow): ResourceRow[] {
  return Array.isArray(row.pendingNotices) ? (row.pendingNotices as ResourceRow[]) : [];
}

/** Con un solo aviso pendiente no se pregunta cuál: el sistema lo toma. */
function campoDeAviso(row: ResourceRow): ActionField[] {
  const avisos = avisosPendientes(row);
  if (avisos.length <= 1) return [];
  return [
    {
      name: 'noticeId',
      label: 'Aviso de pago',
      tooltip: 'La cuota tiene varios pagos avisados por el cliente; elija el que está decidiendo ahora.',
      type: 'select',
      required: true,
      span: 2,
      options: avisos.map((aviso) => ({
        value: String(aviso.id ?? ''),
        label: descripcionDelAviso(aviso),
        description: aviso.evidenceRef ? `Comprobante indicado: ${String(aviso.evidenceRef)}` : 'Sin comprobante indicado por el cliente.',
      })),
    },
  ];
}

async function resolver(row: ResourceRow, accion: Accion, payload: JsonObject, recargar: () => void) {
  const aviso = String(payload.noticeId ?? '');
  const resultado = await conMensajesDeCobertura(
    () =>
      b2bService.resolveCoverageReviewItem(String(row.id ?? ''), {
        action: accion,
        note: String(payload.note ?? '').trim(),
        ...(aviso ? { noticeId: aviso } : {}),
      }),
    'revision',
  );
  if (Number(resultado.pendingNoticesLeft ?? 0) > 0) {
    toast.info('Queda otro aviso por decidir', 'La cuota sigue en revisión hasta decidir todos sus avisos de pago.');
  }
  recargar();
  return resultado;
}

export function accionesDeRevision(recargar: () => void): CrudExtraAction[] {
  return [
    {
      key: 'confirmar-aviso',
      label: 'Confirmar pago del cliente',
      icon: 'task_alt',
      tone: 'success',
      primary: true,
      enabled: (row) => permite(row, 'CONFIRM_NOTICE'),
      form: {
        title: () => 'Confirmar el pago que avisó el cliente',
        description: (row) =>
          `Úselo sólo si comprobó con el comercio que recibió el dinero (${avisosPendientes(row).map(descripcionDelAviso).join('; ') || 'aviso pendiente'}). El pago se descuenta de la cuota; si la cubre entera, queda pagada y ya no se cubre.`,
        submitLabel: 'Confirmar pago',
        fields: (row) => [
          ...campoDeAviso(row),
          { name: 'note', label: 'Qué se verificó', tooltip: 'Cómo se comprobó el pago: con quién habló, qué extracto o comprobante vio. Queda en el historial. Mínimo 3 caracteres.', type: 'textarea', required: true, span: 2 },
        ],
        submit: (row, payload) => resolver(row, 'CONFIRM_NOTICE', payload, recargar),
      },
    },
    {
      key: 'rechazar-aviso',
      label: 'Rechazar aviso de pago',
      icon: 'block',
      tone: 'danger',
      enabled: (row) => permite(row, 'REJECT_NOTICE'),
      form: {
        title: () => 'Rechazar el aviso de pago del cliente',
        description:
          'Úselo si el comercio no recibió ese pago. La cuota sigue impaga y podrá cubrirse desde la pestaña «Cuotas».',
        submitLabel: 'Rechazar aviso',
        fields: (row) => [
          ...campoDeAviso(row),
          { name: 'note', label: 'Motivo del rechazo', tooltip: 'Por qué el pago avisado no vale (p. ej. el comercio no lo recibió). Queda en el historial. Mínimo 3 caracteres.', type: 'textarea', required: true, span: 2 },
        ],
        submit: (row, payload) => resolver(row, 'REJECT_NOTICE', payload, recargar),
      },
    },
    {
      key: 'descartar',
      label: 'Descartar revisión',
      icon: 'do_not_disturb_on',
      enabled: (row) => permite(row, 'DISMISS'),
      form: {
        title: () => 'Descartar la revisión',
        description:
          'Cierra la revisión sin tocar ningún pago ni programar la cobertura. Queda en el historial con su motivo.',
        submitLabel: 'Descartar',
        fields: [
          { name: 'note', label: 'Motivo', tooltip: 'Por qué no corresponde cubrir esta cuota (p. ej. contrato suspendido). Mínimo 3 caracteres.', type: 'textarea', required: true, span: 2 },
        ],
        submit: (row, payload) => resolver(row, 'DISMISS', payload, recargar),
      },
    },
  ];
}
