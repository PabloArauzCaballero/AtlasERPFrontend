'use client';

import { useCallback } from 'react';
import { CrudDirectory } from '@/components/screens/CrudDirectory';
import { useOptions } from '@/hooks/useOptions';
import { accountingService } from '@/services/accountingService';
import { domainLoader } from '@/services/domains';

/**
 * Recibos: el listado es la pantalla, y el alta —con sus asignaciones a facturas— va a su propia
 * página. Antes era una pestaña «Registrar recibo»: un verbo en la barra de secciones.
 */
export default function ReceiptsPage() {
  const load = useCallback(() => accountingService.listReceipts(), []);
  const estadosRecibo = useOptions(domainLoader('domain:accounting.receiptStatus'));

  return (
    <CrudDirectory
      moduleLabel="Contabilidad"
      title="Recibos"
      description="Cobros recibidos y aplicados a facturas por cobrar. Cada fila es un cobro; el alta contabiliza el asiento."
      load={load}
      labelKey="receiptNo"
      searchPlaceholder="Buscar por número de recibo o estado…"
      emptyHint="Usa el botón «Registrar recibo» para contabilizar el primero."
      columns={[
        { key: 'receiptNo', label: 'Recibo', kind: 'mono' },
        { key: 'receiptDate', label: 'Fecha', kind: 'date' },
        { key: 'amount', label: 'Monto', kind: 'money', align: 'right' },
        { key: 'currencyCode', label: 'Moneda' },
        { key: 'status', label: 'Estado', kind: 'status' },
      ]}
      filters={[{ key: 'status', label: 'Estado', options: estadosRecibo }, { key: 'currencyCode', label: 'Moneda' }]}
      create={{ label: 'Registrar recibo', href: '/operaciones/contabilidad/recibos/crear' }}
      edit={{
        description: 'El monto y las asignaciones no se editan aquí: eso descuadraría el asiento ya contabilizado.',
        fields: [
          // El número es el correlativo del sistema (REC-…, por entidad legal): se enseña, no se edita.
          { name: 'receiptNo', label: 'Número de recibo', assignedByBackend: true, hint: 'Asignado por el sistema; no se cambia.' },
          { name: 'receiptDate', label: 'Fecha del recibo', type: 'date', required: true },
          // La lista local tenía APPLIED y CANCELLED, que el backend no acepta, y le faltaban RECORDED y VOID.
          { name: 'status', label: 'Estado', required: true, optionsSource: 'domain:accounting.receiptStatus' },
        ],
        submit: (id, payload) => accountingService.updateReceipt(id, payload),
      }}
      remove={{
        submit: (id) => accountingService.deleteReceipt(id),
        warning: 'Si el recibo ya estaba aplicado, las facturas vuelven a quedar abiertas.',
      }}
    />
  );
}
