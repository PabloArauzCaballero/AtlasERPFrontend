import { toast } from '@/lib/toast';
import { b2bService } from '@/services/b2bService';
import { loadB2BAccounts, loadMerchantBranches } from '@/services/optionLoaders';
import type { JsonObject, ResourceRow } from '@/services/types';
import type { ActionField } from './StructuredActionForm';
import type { CrudExtraAction } from './CrudDirectory';

/**
 * Lo que llegó de Atlas (la app y el motor de préstamos) y el ERP no pudo aplicar sin adivinar.
 *
 * Cada préstamo de una compra en un comercio registra su compra sola. Cuando no puede —el comercio o
 * la sucursal no están ligados, la sucursal no vende a crédito, no hay contrato vigente— el evento
 * no se pierde: queda aquí, y desde su fila se reprocesa cuando alguien corrigió la causa o se
 * descarta dejando escrito por qué. Antes quedaba en una tabla que nadie leía.
 */

const MOTIVOS: Record<string, string> = {
  MISSING_MERCHANT_MAPPING: 'Comercio o sucursal sin ligar',
  MERCHANT_NOT_ELIGIBLE: 'Comercio o sucursal no habilitados',
  NO_ACTIVE_CONTRACT: 'Sin contrato o sin comisión vigente',
  AMOUNT_MISMATCH: 'Los importes no cuadran',
  CURRENCY_MISMATCH: 'Moneda distinta de bolivianos',
  UNLINKED_INSTALLMENT: 'Pago de una cuota sin compra registrada',
  CONFLICTING_DECISION: 'Decisión contraria a la ya aplicada',
};

const QUE_ES: Record<string, string> = {
  'loan.originated': 'Compra a plazos',
  'payment.reported': 'Pago avisado',
  'payment.confirmed': 'Pago confirmado',
  'payment.rejected': 'Pago rechazado',
};

const DESENLACES: Record<string, string> = {
  PURCHASE_REGISTERED: 'La compra quedó registrada con su comisión.',
  ALREADY_LINKED: 'Ese préstamo ya tenía su compra registrada; no se creó otra.',
  NOTICE_REPORTED: 'El pago avisado quedó anotado en su cuota.',
  NOTICE_CONFIRMED: 'El pago quedó confirmado en su cuota.',
  NOTICE_REJECTED: 'El aviso de pago quedó rechazado.',
  LATE_PAYMENT_REVIEW: 'La cuota ya estaba cubierta: el pago pasó a la pestaña «En revisión».',
  NO_CHANGE: 'Ya estaba aplicado; no cambió nada.',
};

export function motivoDeExcepcion(codigo: unknown): string {
  const texto = String(codigo ?? '');
  return MOTIVOS[texto] ?? (texto ? texto.replaceAll('_', ' ').toLowerCase() : '—');
}

/** Las filas de la bandeja, con el motivo y el tipo dichos en palabras. */
export async function cargarExcepcionesDeCore(): Promise<ResourceRow[]> {
  const filas = await b2bService.listCoreExceptions();
  return filas.map((fila) => ({
    ...fila,
    motivo: motivoDeExcepcion(fila.reason),
    queEs: QUE_ES[String(fila.topic ?? '')] ?? String(fila.topic ?? '—'),
    referencia: String(fila.loanCode ?? fila.coreLoanId ?? '—'),
  }));
}

const esCompra = (row: ResourceRow) => String(row.topic ?? '') === 'loan.originated';
const faltaComercio = (row: ResourceRow) => String(row.reason ?? '') === 'MISSING_MERCHANT_MAPPING';

/** Sólo se pregunta el comercio cuando el evento no lo traía: en los demás casos ya se sabe cuál es. */
function camposDeReproceso(row: ResourceRow): ActionField[] {
  if (!esCompra(row) || !faltaComercio(row)) return [];
  return [
    {
      name: 'merchantAccountId',
      label: 'Comercio',
      tooltip: 'Comercio afiliado donde se hizo la compra. Se elige aquí porque en Atlas todavía no está ligado a su ficha del ERP.',
      type: 'select',
      required: true,
      span: 2,
      optionsLoader: loadB2BAccounts,
    },
    {
      name: 'branchId',
      label: 'Sucursal',
      tooltip: 'Sucursal de ese comercio donde se hizo la compra; tiene que estar habilitada para vender a crédito.',
      type: 'select',
      required: true,
      span: 2,
      optionsLoader: loadMerchantBranches,
      hint: 'Sólo las sucursales habilitadas pueden originar.',
    },
  ];
}

export function accionesDeExcepcion(recargar: () => void): CrudExtraAction[] {
  return [
    {
      key: 'reprocesar',
      label: 'Reprocesar',
      description: 'Vuelve a aplicar lo que llegó de Atlas, ahora que la causa está corregida.',
      icon: 'replay',
      tone: 'success',
      primary: true,
      form: {
        title: (row) => `Reprocesar: ${motivoDeExcepcion(row.reason).toLowerCase()}`,
        description: (row) =>
          faltaComercio(row)
            ? 'Elija el comercio y la sucursal donde se hizo la compra. La compra se registra con su comisión y sus cuotas quedan ligadas a las de Atlas.'
            : `${String(row.detail ?? 'Corrija primero la causa.')} Si ya está corregido, reprocese: si sigue sin poder aplicarse, la fila se queda aquí con el motivo de ahora.`,
        submitLabel: 'Reprocesar',
        fields: camposDeReproceso,
        submit: async (row: ResourceRow, payload: JsonObject) => {
          const resultado = await b2bService.reprocessCoreException(String(row.id ?? ''), {
            ...(payload.merchantAccountId ? { merchantAccountId: payload.merchantAccountId } : {}),
            ...(payload.branchId ? { branchId: payload.branchId } : {}),
          });
          if (resultado.resolved) {
            toast.success('Aplicado', DESENLACES[String(resultado.outcome ?? '')] ?? 'Quedó aplicado.');
          } else {
            toast.warning(
              'Sigue sin poder aplicarse',
              `${motivoDeExcepcion(resultado.reason)}. ${String(resultado.detail ?? '')}`.trim(),
            );
          }
          recargar();
          return resultado;
        },
      },
    },
    {
      key: 'descartar-excepcion',
      label: 'Descartar',
      description: 'Cierra la fila sin aplicar nada, dejando escrito por qué.',
      icon: 'do_not_disturb_on',
      form: {
        title: () => 'Descartar sin aplicar',
        description:
          'Úselo cuando no hay nada que registrar: un préstamo de prueba, o una compra que ya se registró a mano. No se puede deshacer.',
        submitLabel: 'Descartar',
        fields: [
          {
            name: 'note',
            label: 'Motivo',
            tooltip: 'Por qué no se aplica. Queda guardado con la fila. Entre 5 y 100 caracteres.',
            type: 'textarea',
            required: true,
            span: 2,
          },
        ],
        submit: async (row: ResourceRow, payload: JsonObject) => {
          const resultado = await b2bService.dismissCoreException(String(row.id ?? ''), {
            note: String(payload.note ?? '').trim(),
          });
          recargar();
          return resultado;
        },
      },
    },
  ];
}
