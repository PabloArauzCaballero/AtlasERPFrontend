'use client';

import { useCallback, useState } from 'react';
import { TabbedPanels } from '@/components/atlas/TabbedPanels';
import { WorkspaceHeader } from '@/components/atlas/WorkspaceHeader';
import { CrudDirectory } from '@/components/screens/CrudDirectory';
import { ReceiptScreen } from '@/components/screens/ReceiptScreen';
import { accountingService } from '@/services/accountingService';

export default function ReceiptsPage() {
  const [tab, setTab] = useState('listado');
  const [version, setVersion] = useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(() => accountingService.listReceipts(), [version]);

  return (
    <div className="space-y-5">
      <WorkspaceHeader
        breadcrumbs={[{ label: 'Contabilidad' }, { label: 'Recibos' }]}
        title="Recibos"
        description="Cobros recibidos y aplicados a facturas por cobrar. La tabla es el estado real; el alta contabiliza el asiento."
      />
      <TabbedPanels
        activeId={tab}
        onChange={setTab}
        keepMounted
        tabs={[
          {
            id: 'listado',
            label: 'Recibos registrados',
            icon: 'table_view',
            content: (
              <CrudDirectory
                embedded
                moduleLabel="Contabilidad"
                title="Recibos registrados"
                description="Cada fila es un cobro recibido y aplicado."
                load={load}
                labelKey="receiptNo"
                searchPlaceholder="Buscar por número de recibo o estado…"
                emptyHint="Usa la pestaña «Registrar recibo» para contabilizar el primero."
                columns={[
                  { key: 'receiptNo', label: 'Recibo', kind: 'mono' },
                  { key: 'receiptDate', label: 'Fecha', kind: 'date' },
                  { key: 'amount', label: 'Monto', kind: 'money', align: 'right' },
                  { key: 'currencyCode', label: 'Moneda' },
                  { key: 'status', label: 'Estado', kind: 'status' },
                ]}
                filters={[{ key: 'status', label: 'Estado' }, { key: 'currencyCode', label: 'Moneda' }]}
                create={{ label: 'Registrar recibo', onClick: () => setTab('nuevo') }}
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
            ),
          },
          {
            id: 'nuevo',
            label: 'Registrar recibo',
            icon: 'add',
            content: <ReceiptScreen embedded onDone={() => { setVersion((value) => value + 1); setTab('listado'); }} />,
          },
        ]}
      />
    </div>
  );
}
