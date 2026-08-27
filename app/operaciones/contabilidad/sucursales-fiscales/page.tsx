'use client';

import { useCallback, useState } from 'react';
import { TabbedPanels } from '@/components/atlas/TabbedPanels';
import { WorkspaceHeader } from '@/components/atlas/WorkspaceHeader';
import { CrudDirectory } from '@/components/screens/CrudDirectory';
import { accountingService } from '@/services/accountingService';
import { loadLegalEntities } from '@/services/optionLoaders';

const soloAlta = {
  tone: 'warning' as const,
  title: 'Alta sí, modificación todavía no',
  body: 'El backend expone listar y crear para este maestro, pero aún no PATCH ni DELETE. Si un dato está mal, da de alta el correcto y deja de usar el anterior.',
};

export default function BranchesFiscalYearsPage() {
  const [version, setVersion] = useState(0);
  const bump = () => setVersion((value) => value + 1);
  /* eslint-disable react-hooks/exhaustive-deps */
  const loadBranches = useCallback(() => accountingService.listBranches(), [version]);
  const loadFiscalYears = useCallback(() => accountingService.listFiscalYears(), [version]);
  /* eslint-enable react-hooks/exhaustive-deps */

  return (
    <div className="space-y-5">
      <WorkspaceHeader
        breadcrumbs={[{ label: 'Contabilidad' }, { label: 'Sucursales y fiscales' }]}
        title="Sucursales contables y años fiscales"
        description="Unidades que emiten documentos y períodos anuales que agrupan los períodos contables."
      />
      <TabbedPanels
        tabs={[
          {
            id: 'sucursales',
            label: 'Sucursales contables',
            icon: 'account_balance',
            content: (
              <CrudDirectory
                embedded
                moduleLabel="Contabilidad"
                title="Sucursales contables"
                description="Unidad operativa que emite y contabiliza documentos."
                load={loadBranches}
                labelKey="name"
                searchPlaceholder="Buscar por código, nombre o ciudad…"
                columns={[
                  { key: 'code', label: 'Código', kind: 'mono' },
                  { key: 'name', label: 'Nombre' },
                  { key: 'city', label: 'Ciudad' },
                  { key: 'status', label: 'Estado', kind: 'status' },
                ]}
                filters={[{ key: 'city', label: 'Ciudad' }, { key: 'status', label: 'Estado' }]}
                notice={soloAlta}
                create={{
                  label: 'Crear sucursal',
                  title: 'Nueva sucursal contable',
                  fields: [
                    { name: 'legalEntityId', label: 'Entidad legal', type: 'select', required: true, span: 2, optionsLoader: loadLegalEntities },
                    { name: 'code', label: 'Código', required: true, placeholder: 'SCZ-CENTRAL' },
                    { name: 'name', label: 'Nombre', required: true, placeholder: 'Oficina central' },
                    { name: 'city', label: 'Ciudad', optional: true, placeholder: 'Santa Cruz de la Sierra', span: 2 },
                  ],
                  submit: async (payload) => { const created = await accountingService.createBranch(payload); bump(); return created; },
                }}
              />
            ),
          },
          {
            id: 'anios',
            label: 'Años fiscales',
            icon: 'calendar_month',
            content: (
              <CrudDirectory
                embedded
                moduleLabel="Contabilidad"
                title="Años fiscales"
                description="Período anual que agrupa los períodos contables de una entidad."
                load={loadFiscalYears}
                labelKey="yearLabel"
                searchPlaceholder="Buscar por etiqueta o estado…"
                columns={[
                  { key: 'yearLabel', label: 'Ejercicio', kind: 'mono' },
                  { key: 'startDate', label: 'Inicio', kind: 'date' },
                  { key: 'endDate', label: 'Fin', kind: 'date' },
                  { key: 'status', label: 'Estado', kind: 'status' },
                ]}
                filters={[{ key: 'status', label: 'Estado' }]}
                notice={soloAlta}
                create={{
                  label: 'Crear año fiscal',
                  title: 'Nuevo año fiscal',
                  fields: [
                    { name: 'legalEntityId', label: 'Entidad legal', type: 'select', required: true, span: 2, optionsLoader: loadLegalEntities },
                    { name: 'yearLabel', label: 'Etiqueta', required: true, defaultValue: '2026' },
                    { name: 'startDate', label: 'Fecha inicial', type: 'date', required: true, defaultValue: '2026-01-01' },
                    { name: 'endDate', label: 'Fecha final', type: 'date', required: true, defaultValue: '2026-12-31', span: 2 },
                  ],
                  submit: async (payload) => { const created = await accountingService.createFiscalYear(payload); bump(); return created; },
                }}
              />
            ),
          },
        ]}
      />
    </div>
  );
}
