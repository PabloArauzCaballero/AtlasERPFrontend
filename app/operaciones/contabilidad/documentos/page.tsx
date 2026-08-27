'use client';

import { useCallback, useState } from 'react';
import { TabbedPanels } from '@/components/atlas/TabbedPanels';
import { WorkspaceHeader } from '@/components/atlas/WorkspaceHeader';
import { AccountingDocumentScreen } from '@/components/screens/AccountingDocumentScreen';
import { CrudDirectory } from '@/components/screens/CrudDirectory';
import { accountingService } from '@/services/accountingService';

export default function AccountingDocumentsPage() {
  const [tab, setTab] = useState('listado');
  const [version, setVersion] = useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(() => accountingService.listDocuments(), [version]);

  return (
    <div className="space-y-5">
      <WorkspaceHeader
        breadcrumbs={[{ label: 'Contabilidad' }, { label: 'Documentos' }]}
        title="Documentos contables"
        description="Todos los asientos registrados, su estado de contabilización y el libro al que pertenecen."
      />
      <TabbedPanels
        activeId={tab}
        onChange={setTab}
        keepMounted
        tabs={[
          {
            id: 'listado',
            label: 'Documentos registrados',
            icon: 'table_view',
            content: (
              <CrudDirectory
                embedded
                moduleLabel="Contabilidad"
                title="Documentos registrados"
                description="Historial de asientos. Un documento contabilizado no se edita ni se borra: se reversa."
                load={load}
                labelKey="documentNo"
                searchPlaceholder="Buscar por número, tipo o estado…"
                emptyHint="Usa la pestaña «Crear documento» para registrar el primer asiento."
                columns={[
                  { key: 'documentNo', label: 'Documento', kind: 'mono' },
                  { key: 'documentType', label: 'Tipo' },
                  { key: 'documentDate', label: 'Fecha', kind: 'date' },
                  { key: 'postingDate', label: 'Contabilización', kind: 'date' },
                  { key: 'currencyCode', label: 'Moneda' },
                  { key: 'status', label: 'Estado', kind: 'status' },
                ]}
                filters={[{ key: 'documentType', label: 'Tipo' }, { key: 'status', label: 'Estado' }]}
                notice={{
                  tone: 'info',
                  title: 'Sin lápiz ni papelera, y es a propósito',
                  body: 'Un asiento contabilizado es inmutable: corregirlo o borrarlo rompería el cuadre del período y la trazabilidad. Lo que corresponde es contabilizar el borrador o reversarlo con un asiento contrario.',
                }}
                create={{ label: 'Crear documento', onClick: () => setTab('nuevo') }}
                extraActions={[
                  {
                    key: 'contabilizar',
                    label: 'Contabilizar',
                    icon: 'task_alt',
                    run: (row) => accountingService.postDocument(String(row.id ?? '')),
                    confirm: {
                      title: 'Contabilizar el documento',
                      message: 'El asiento pasa a firme y deja de poder editarse. Sólo podrá deshacerse con una reversión.',
                      confirmLabel: 'Sí, contabilizar',
                    },
                  },
                ]}
              />
            ),
          },
          {
            id: 'nuevo',
            label: 'Crear documento',
            icon: 'add',
            content: <AccountingDocumentScreen embedded onDone={() => setVersion((value) => value + 1)} />,
          },
        ]}
      />
    </div>
  );
}
