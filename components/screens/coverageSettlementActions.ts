import { conMensajesDeCobertura, estadoDeLiquidacion, importeExacto, problemaDeLiquidacion } from '@/lib/coberturaBnpl';
import { toast } from '@/lib/toast';
import { b2bService } from '@/services/b2bService';
import { subirArchivoDelErp } from '@/services/filesService';
import { loadB2BAccounts, loadMerchantEvidenceFiles } from '@/services/optionLoaders';
import type { JsonObject, ResourceRow } from '@/services/types';
import type { CrudExtraAction } from './CrudDirectory';

/**
 * Las cuatro operaciones sobre una cobertura, desde su fila: registrar la liquidación, aprobarla,
 * rechazarla y cancelar la cobertura.
 *
 * Antes bastaba una fecha para dar por pagado al comercio, y con eso nacía la deuda del cliente.
 * Ahora el pago se registra con su referencia, importe, moneda, comercio y comprobante, y queda
 * PENDIENTE hasta que OTRA persona lo aprueba (doble control).
 *
 * El listado trae la liquidación viva de cada cobertura (`settlementStatus`) y si la registró quien
 * mira (`settlementRegisteredByMe`, lo calcula el sistema con la sesión). Con eso:
 *  - «Registrar pago» sólo aparece si no hay un pago registrado;
 *  - «Aprobar» y «Rechazar» sólo aparecen si hay uno PENDIENTE y no lo registró quien mira;
 *  - lo que esta pantalla acaba de registrar cuenta como propio aunque la tabla no haya recargado;
 *  - si aun así el sistema rechaza por doble control (`FOUR_EYES_REQUIRED`), se explica en claro.
 */

/** Estados de la cobertura en los que todavía se puede pagar o cancelar. */
const ABIERTA = new Set(['SCHEDULED', 'DUE']);
const abierta = (row: ResourceRow) => ABIERTA.has(String(row.status ?? ''));

/** Lo que esta sesión sabe de cada cobertura (por id) tras operar sobre ella. */
export type EstadoLocalDeLiquidacion = 'REGISTRADA_POR_MI' | 'DECIDIDA';

export interface DependenciasDeLiquidacion {
  estadoLocal: Record<string, EstadoLocalDeLiquidacion | undefined>;
  marcar: (payableId: string, estado: EstadoLocalDeLiquidacion | undefined) => void;
  recargar: () => void;
}

/** Texto de la columna «Pago al comercio»: lo que dice el sistema, más lo recién hecho aquí. */
export function textoDeLiquidacion(row: ResourceRow, estado: EstadoLocalDeLiquidacion | undefined): string {
  return estadoDeLiquidacion(row, estado === 'REGISTRADA_POR_MI').texto;
}

const TIPOS_DE_COMPROBANTE = 'application/pdf,image/jpeg,image/png';

async function registrar(row: ResourceRow, payload: JsonObject, deps: DependenciasDeLiquidacion) {
  const payableId = String(row.id ?? '');
  const archivo = payload.evidenceFile instanceof File ? payload.evidenceFile : null;
  const elegido = String(payload.evidenceFileId ?? '');
  const problema = problemaDeLiquidacion({
    settlementReference: payload.settlementReference,
    amount: payload.amount,
    paidAt: payload.paidAt,
    tieneComprobante: Boolean(archivo || elegido),
  });
  if (problema) throw new Error(problema);

  /* El comprobante va al expediente del comercio de la cobertura: ahí lo buscará quien apruebe. */
  let evidenceFileId = elegido;
  if (archivo) {
    try {
      evidenceFileId = String((await subirArchivoDelErp('B2B_ACCOUNT', String(row.accountId ?? ''), archivo)).id ?? '');
    } catch (error) {
      const detalle = error instanceof Error && error.message ? ` ${error.message}` : '';
      throw new Error(`No se pudo subir el comprobante.${detalle}`);
    }
  }

  const resultado = await conMensajesDeCobertura(() =>
    b2bService.registerPayableSettlement(payableId, {
      settlementReference: String(payload.settlementReference ?? '').trim(),
      amount: importeExacto(payload.amount) ?? '',
      currency: String(payload.currency ?? 'BOB'),
      beneficiaryAccountId: String(payload.beneficiaryAccountId ?? ''),
      paidAt: String(payload.paidAt ?? ''),
      evidenceFileId,
    }),
  );
  if (resultado.outcome === 'PENDING_APPROVAL') {
    deps.marcar(payableId, 'REGISTRADA_POR_MI');
    toast.info('Falta la segunda firma', 'El pago queda pendiente hasta que otra persona del equipo de finanzas lo apruebe.');
  }
  deps.recargar();
  return resultado;
}

export function accionesDeLiquidacion(deps: DependenciasDeLiquidacion): CrudExtraAction[] {
  const estado = (row: ResourceRow) =>
    estadoDeLiquidacion(row, deps.estadoLocal[String(row.id ?? '')] === 'REGISTRADA_POR_MI');
  /* Hay un pago esperando la segunda firma y quien mira NO lo registró: puede decidir sobre él. */
  const decidible = (row: ResourceRow) => abierta(row) && estado(row).pendiente && !estado(row).registradaPorMi;

  return [
    {
      key: 'liquidar',
      label: 'Registrar pago al comercio',
      icon: 'paid',
      primary: true,
      enabled: (row) => abierta(row) && !estado(row).hay && !deps.estadoLocal[String(row.id ?? '')],
      form: {
        title: () => 'Registrar el pago de la cobertura al comercio',
        description:
          'Anote el pago tal como figura en el comprobante. Queda pendiente hasta que otra persona lo apruebe; recién entonces la cobertura figura pagada y se abre la recuperación frente al cliente.',
        submitLabel: 'Registrar pago',
        submit: (row, payload) => registrar(row, payload, deps),
        fields: (row) => [
          { name: 'settlementReference', label: 'Referencia del pago', tooltip: 'El número de la transferencia o del comprobante bancario. Cada pago lleva la suya y no se puede repetir.', required: true, placeholder: 'Ej.: TRF-88213', span: 2 },
          { name: 'amount', label: 'Importe pagado', tooltip: 'Exactamente el importe de la cobertura, con hasta dos decimales.', type: 'number', required: true, defaultValue: String(row.amount ?? ''), hint: 'Tiene que coincidir con el importe de la cobertura.' },
          { name: 'currency', label: 'Moneda', tooltip: 'Moneda del pago según el comprobante.', required: true, defaultValue: String(row.currency ?? 'BOB'), optionsSource: 'catalog:currency' },
          { name: 'beneficiaryAccountId', label: 'Comercio que recibió el pago', tooltip: 'El comercio al que se transfirió. Debe ser el de la cobertura.', type: 'select', required: true, span: 2, defaultValue: String(row.accountId ?? ''), optionsLoader: loadB2BAccounts },
          { name: 'paidAt', label: 'Fecha y hora del pago', tooltip: 'Fecha y hora exactas según el comprobante. No puede ser posterior a hoy.', type: 'datetime', required: true, span: 2 },
          { name: 'evidenceFile', label: 'Comprobante', tooltip: 'El comprobante del pago en PDF, JPG o PNG. Queda en el expediente del comercio.', type: 'file', accept: TIPOS_DE_COMPROBANTE, optional: true, span: 2, hint: 'Adjunte uno nuevo o elija abajo uno ya subido.' },
          { name: 'evidenceFileId', label: 'O un comprobante ya subido', tooltip: 'Comprobantes que ya están en el expediente de este comercio.', type: 'select', optional: true, span: 2, emptyOption: '— Ninguno: adjunto uno nuevo —', dependsOn: 'beneficiaryAccountId', optionsLoaderFor: loadMerchantEvidenceFiles },
        ],
      },
    },
    {
      key: 'aprobar',
      label: 'Aprobar pago',
      icon: 'verified',
      tone: 'success',
      primary: true,
      /* Sólo con un pago pendiente, y nunca a quien lo registró. */
      enabled: decidible,
      form: {
        title: () => 'Aprobar el pago registrado',
        description:
          'Confirme que el pago al comercio se hizo como se registró. Al aprobar, la cobertura queda pagada y se abre la recuperación frente al cliente. Sólo puede aprobarlo alguien distinto de quien lo registró.',
        submitLabel: 'Aprobar pago',
        submit: async (row, payload) => {
          const payableId = String(row.id ?? '');
          const nota = String(payload.note ?? '').trim();
          const resultado = await conMensajesDeCobertura(() =>
            b2bService.approvePayableSettlement(payableId, nota ? { note: nota } : {}),
          );
          deps.marcar(payableId, 'DECIDIDA');
          deps.recargar();
          return resultado;
        },
        fields: [
          { name: 'note', label: 'Nota', tooltip: 'Opcional: qué se revisó antes de aprobar. Queda en el historial.', type: 'textarea', optional: true, span: 2 },
        ],
      },
    },
    {
      key: 'rechazar',
      label: 'Rechazar pago',
      icon: 'block',
      tone: 'danger',
      enabled: decidible,
      form: {
        title: () => 'Rechazar el pago registrado',
        description:
          'Úselo si el pago se registró mal (importe, comercio, comprobante). La cobertura sigue pendiente y la referencia queda libre para registrarlo de nuevo.',
        submitLabel: 'Rechazar pago',
        submit: async (row, payload) => {
          const payableId = String(row.id ?? '');
          const resultado = await conMensajesDeCobertura(() =>
            b2bService.rejectPayableSettlement(payableId, { note: String(payload.note ?? '').trim() }),
          );
          deps.marcar(payableId, undefined);
          deps.recargar();
          return resultado;
        },
        fields: [
          { name: 'note', label: 'Motivo del rechazo', tooltip: 'Qué está mal, para que quien lo registró lo corrija. Mínimo 3 caracteres.', type: 'textarea', required: true, span: 2 },
        ],
      },
    },
    {
      key: 'cancelar',
      label: 'Cancelar cobertura',
      icon: 'cancel',
      tone: 'danger',
      /* Con un pago registrado el sistema no la cancela: primero se rechaza el pago. */
      enabled: (row) => abierta(row) && !estado(row).hay,
      form: {
        title: () => 'Cancelar la cobertura',
        description:
          'Sólo para una cobertura que todavía no se pagó. Si tiene un pago esperando aprobación, primero hay que rechazarlo. La cuota podrá volver a cubrirse.',
        submitLabel: 'Cancelar cobertura',
        submit: async (row, payload) => {
          const resultado = await conMensajesDeCobertura(() =>
            b2bService.cancelPayable(String(row.id ?? ''), { reason: String(payload.reason ?? '').trim() }),
          );
          deps.recargar();
          return resultado;
        },
        fields: [
          { name: 'reason', label: 'Motivo', tooltip: 'Por qué se cancela; queda en el historial para que otro entienda la decisión. Mínimo 3 caracteres.', type: 'textarea', required: true, span: 2 },
        ],
      },
    },
  ];
}
