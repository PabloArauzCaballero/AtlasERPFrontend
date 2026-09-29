import type { CrudExtraAction } from '@/components/screens/CrudDirectory';
import { accountingService } from '@/services/accountingService';
import type { ResourceRow } from '@/services/types';

/**
 * Recibos y facturas por cobrar que ya dejaron rastro contable: qué se puede hacer con ellos.
 *
 * Hasta el 2026-09-29 la papelera borraba cualquiera: el asiento seguía en el mayor, las facturas
 * se quedaban pagadas sin el recibo que las pagó y el aviso decía lo contrario («las facturas
 * vuelven a quedar abiertas»). El sistema ya no lo permite (409 con el motivo) y esta pantalla no
 * lo ofrece: sólo se borra un borrador sin asiento; lo demás se corrige reversando su asiento.
 */

/** Sin asiento y en borrador: lo único que el sistema deja borrar. */
export function sinRastroContable(row: ResourceRow): boolean {
  return !row.accountingDocumentId && String(row.status ?? '') === 'DRAFT';
}

/** Por qué la papelera de esta fila está deshabilitada; `null` si se puede borrar. */
export function motivoParaNoBorrar(row: ResourceRow, que: 'recibo' | 'factura'): string | null {
  if (sinRastroContable(row)) return null;
  const correccion = que === 'factura'
    ? 'Se corrige reversando su asiento o, si tiene documento fiscal, anulándola en «Facturación electrónica».'
    : 'Se corrige reversando su asiento.';
  return row.accountingDocumentId
    ? `Ya está contabilizado: su asiento está en el libro y no se borra. ${correccion}`
    : `Sólo se borra un borrador; éste ya no lo es. ${correccion}`;
}

/**
 * «Reversar su asiento»: el mismo reverso que en «Documentos contables», sin salir de la fila.
 *
 * Lo que NO hace se dice en el propio formulario: reversar el asiento de un recibo no devuelve las
 * facturas a pendiente ni cambia el estado del recibo. Eso se ajusta a mano, con su lápiz.
 */
export function accionReversarAsiento(que: 'recibo' | 'factura'): CrudExtraAction {
  const efecto = que === 'recibo'
    ? 'Anota en el libro un asiento inverso al del cobro. No cambia el estado del recibo ni devuelve a pendiente las facturas que saldó: eso se ajusta con el lápiz de cada una.'
    : 'Anota en el libro un asiento inverso al de la factura. No cambia su estado ni la anula ante Impuestos: eso se hace aparte.';
  return {
    key: 'reversar',
    label: 'Reversar su asiento',
    description: `Deshace en el libro el asiento de este ${que} con otro asiento inverso.`,
    icon: 'undo',
    tone: 'danger',
    enabled: (row) => Boolean(row.accountingDocumentId),
    form: {
      title: (row) => `Reversar el asiento de ${String(row.receiptNo ?? row.invoiceNo ?? `este ${que}`)}`,
      description: efecto,
      fields: [
        { name: 'reversalDate', label: 'Fecha de reversión', tooltip: 'Fecha con la que se contabiliza la reversión; tiene que caer en un período abierto.', type: 'date', required: true, span: 3 },
        { name: 'reason', label: 'Motivo', tooltip: 'Por qué se deshace el asiento; queda junto al reverso para que otro entienda qué pasó.', required: true, span: 3, placeholder: 'Cobro registrado dos veces' },
      ],
      submit: (row, payload) => accountingService.reverseDocument(String(row.accountingDocumentId ?? ''), payload),
      submitLabel: 'Reversar',
    },
  };
}
