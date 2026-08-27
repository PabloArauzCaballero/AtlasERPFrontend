'use client';

import { useCallback, useState } from 'react';
import { TabbedPanels } from '@/components/atlas/TabbedPanels';
import { WorkspaceHeader } from '@/components/atlas/WorkspaceHeader';
import { CrudDirectory } from '@/components/screens/CrudDirectory';
import { accountingService } from '@/services/accountingService';
import { loadFiscalYears, loadLegalEntities } from '@/services/optionLoaders';

const soloAlta = {
  tone: 'warning' as const,
  title: 'Alta sí, modificación todavía no',
  body: 'El backend expone listar y crear, pero aún no PATCH ni DELETE. Un período se abre y se cierra desde «Cierres»; un ledger mal configurado se sustituye por otro.',
};

export default function PeriodsLedgersPage() {
  const [version, setVersion] = useState(0);
  const bump = () => setVersion((value) => value + 1);
  /* eslint-disable react-hooks/exhaustive-deps */
  const loadPeriods = useCallback(() => accountingService.listAccountingPeriods(), [version]);
  const loadLedgers = useCallback(() => accountingService.listLedgers(), [version]);
  /* eslint-enable react-hooks/exhaustive-deps */

  return (
    <div className="space-y-5">
      <WorkspaceHeader
        breadcrumbs={[{ label: 'Contabilidad' }, { label: 'Períodos y ledgers' }]}
        title="Períodos y libros contables"
        description="Ventanas habilitadas para contabilizar y libros paralelos para contabilidad local, gerencial e IFRS."
      />
      <TabbedPanels
        tabs={[
          {
            id: 'periodos',
            label: 'Períodos contables',
            icon: 'date_range',
            content: (
              <CrudDirectory
                embedded
                moduleLabel="Contabilidad"
                title="Períodos contables"
                description="Cada ventana en la que se pueden fechar contabilizaciones."
                load={loadPeriods}
                labelKey="periodNo"
                searchPlaceholder="Buscar por número o estado…"
                columns={[
                  { key: 'periodNo', label: 'Período', kind: 'mono' },
                  { key: 'startDate', label: 'Desde', kind: 'date' },
                  { key: 'endDate', label: 'Hasta', kind: 'date' },
                  { key: 'status', label: 'Estado', kind: 'status' },
                ]}
                filters={[{ key: 'status', label: 'Estado' }]}
                notice={soloAlta}
                create={{
                  label: 'Crear período',
                  title: 'Nuevo período contable',
                  fields: [
                    { name: 'fiscalYearId', label: 'Año fiscal', type: 'select', required: true, span: 2, optionsLoader: loadFiscalYears },
                    { name: 'periodNo', label: 'Número de período', type: 'number', valueKind: 'number', required: true, defaultValue: 1 },
                    { name: 'startDate', label: 'Fecha inicial', type: 'date', required: true },
                    { name: 'endDate', label: 'Fecha final', type: 'date', required: true, span: 2 },
                  ],
                  submit: async (payload) => { const created = await accountingService.createPeriod(payload); bump(); return created; },
                }}
              />
            ),
          },
          {
            id: 'ledgers',
            label: 'Libros (ledgers)',
            icon: 'menu_book',
            content: (
              <CrudDirectory
                embedded
                moduleLabel="Contabilidad"
                title="Libros contables"
                description="Libro por base normativa o propósito gerencial."
                load={loadLedgers}
                labelKey="name"
                searchPlaceholder="Buscar por código, nombre o base contable…"
                columns={[
                  { key: 'code', label: 'Código', kind: 'mono' },
                  { key: 'name', label: 'Nombre' },
                  { key: 'accountingBasis', label: 'Base contable' },
                  { key: 'isDefault', label: 'Predeterminado', kind: 'bool' },
                  { key: 'status', label: 'Estado', kind: 'status' },
                ]}
                filters={[{ key: 'accountingBasis', label: 'Base contable' }, { key: 'status', label: 'Estado' }]}
                notice={soloAlta}
                create={{
                  label: 'Crear ledger',
                  title: 'Nuevo libro mayor',
                  fields: [
                    { name: 'legalEntityId', label: 'Entidad legal', type: 'select', required: true, span: 2, optionsLoader: loadLegalEntities },
                    { name: 'code', label: 'Código', required: true, placeholder: 'LOCAL-BO' },
                    { name: 'name', label: 'Nombre', required: true, placeholder: 'Libro local Bolivia' },
                    { name: 'accountingBasis', label: 'Base contable', type: 'select', required: true, defaultValue: 'LOCAL_BO', span: 2, options: [
                      { label: 'Local Bolivia', value: 'LOCAL_BO' }, { label: 'Gerencial', value: 'MANAGEMENT' }, { label: 'IFRS', value: 'IFRS' },
                    ] },
                    { name: 'isDefault', label: 'Libro predeterminado', type: 'select', valueKind: 'boolean', defaultValue: 'false', span: 2, options: [{ label: 'No', value: 'false' }, { label: 'Sí', value: 'true' }] },
                  ],
                  submit: async (payload) => { const created = await accountingService.createLedger(payload); bump(); return created; },
                }}
              />
            ),
          },
        ]}
      />
    </div>
  );
}
