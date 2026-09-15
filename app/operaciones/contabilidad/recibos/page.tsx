'use client';

import { useCallback } from 'react';
import { CrudDirectory } from '@/components/screens/CrudDirectory';
import { accountingService } from '@/services/accountingService';

/**
 * Recibos: el listado es la pantalla, y el alta —con sus asignaciones a facturas— va a su propia
 * página. Antes era una pestaña «Registrar recibo»: un verbo en la barra de secciones.
 */
export default function ReceiptsPage() {
  const load = useCallback(() => accountingService.listReceipts(), []);

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
      filters={[{ key: 'status', label: 'Estado' }, { key: 'currencyCode', label: 'Moneda' }]}
      create={{ label: 'Registrar recibo', href: '/operaciones/contabilidad/recibos/crear' }}
      edit={{
        description: 'El monto y las asignaciones no se editan aquí: eso descuadraría el asiento ya contabilizado.',
        fields: [
          { name: 'receiptNo', label: 'Número de recibo', required: true },
          { name: 'receiptDate', label: 'Fecha del recibo', type: 'date', required: true },
          { name: 'status', label: 'Estado', type: 'select', required: true, options: ['DRAFT', 'POSTED', 'APPLIED', 'CANCELLED'].map((value) => ({ label: value, value })) },
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
