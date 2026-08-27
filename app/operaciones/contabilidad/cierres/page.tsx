'use client';

import { useCallback, useState } from 'react';
import { TabbedPanels } from '@/components/atlas/TabbedPanels';
import { WorkspaceHeader } from '@/components/atlas/WorkspaceHeader';
import { CrudDirectory } from '@/components/screens/CrudDirectory';
import { InlineActionForm } from '@/components/screens/InlineActionForm';
import { accountingService } from '@/services/accountingService';
import { loadAccountingPeriods, loadLegalEntities } from '@/services/optionLoaders';

export default function PeriodClosingPage() {
  const [version, setVersion] = useState(0);
  const bump = () => setVersion((value) => value + 1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(() => accountingService.listAccountingPeriods(), [version]);

  return (
    <div className="space-y-5">
      <WorkspaceHeader
        breadcrumbs={[{ label: 'Contabilidad' }, { label: 'Cierres' }]}
        title="Cierre de períodos"
        description="Qué períodos están abiertos, cuáles cerrados, y las dos operaciones que cambian ese estado."
      />
      <TabbedPanels
        tabs={[
          {
            id: 'periodos',
            label: 'Estado de los períodos',
            icon: 'table_view',
            content: (
              <CrudDirectory
                embedded
                moduleLabel="Contabilidad"
                title="Períodos contables"
                description="El estado de cada período: abierto acepta contabilizaciones, cerrado las bloquea."
                load={load}
                labelKey="periodNo"
                searchPlaceholder="Buscar por número o estado…"
                columns={[
                  { key: 'periodNo', label: 'Período', kind: 'mono' },
                  { key: 'startDate', label: 'Desde', kind: 'date' },
                  { key: 'endDate', label: 'Hasta', kind: 'date' },
                  { key: 'status', label: 'Estado', kind: 'status' },
                ]}
                filters={[{ key: 'status', label: 'Estado' }]}
                notice={{
                  tone: 'info',
                  title: 'El cierre no es un borrado',
                  body: 'Cerrar un período no elimina nada: bloquea nuevas contabilizaciones con esa fecha. Por eso aquí no hay papelera, sino las dos acciones de las otras pestañas.',
                }}
              />
            ),
          },
          {
            id: 'cerrar',
            label: 'Cerrar período',
            icon: 'lock',
            content: (
              <InlineActionForm
                title="Cerrar período"
                description="Bloquea nuevas contabilizaciones en el período elegido."
                icon="lock"
                submitLabel="Cerrar período"
                submitIcon="lock_person"
                successMessage="El período quedó cerrado."
                onDone={bump}
                onSubmit={accountingService.closePeriod}
                fields={[
                  { name: 'legalEntityId', label: 'Entidad legal', type: 'select', required: true, span: 2, optionsLoader: loadLegalEntities },
                  { name: 'periodId', label: 'Período contable', type: 'select', required: true, span: 2, optionsLoader: loadAccountingPeriods },
                  { name: 'closeType', label: 'Tipo de cierre', type: 'select', required: true, span: 2, options: [{ label: 'Mensual', value: 'MONTHLY' }, { label: 'Anual', value: 'ANNUAL' }] },
                ]}
              />
            ),
          },
          {
            id: 'reabrir',
            label: 'Reapertura controlada',
            icon: 'lock_open',
            content: (
              <InlineActionForm
                title="Reapertura controlada"
                description="Rehabilita temporalmente un período cerrado. Exige motivo documentado y queda en auditoría."
                icon="lock_open"
                submitLabel="Reabrir período"
                successMessage="El período volvió a quedar abierto."
                onDone={bump}
                onSubmit={accountingService.reopenPeriod}
                fields={[
                  { name: 'legalEntityId', label: 'Entidad legal', type: 'select', required: true, span: 2, optionsLoader: loadLegalEntities },
                  { name: 'periodId', label: 'Período contable', type: 'select', required: true, span: 2, optionsLoader: loadAccountingPeriods },
                  { name: 'reason', label: 'Motivo documentado', type: 'textarea', required: true, span: 3 },
                ]}
              />
            ),
          },
        ]}
      />
    </div>
  );
}
