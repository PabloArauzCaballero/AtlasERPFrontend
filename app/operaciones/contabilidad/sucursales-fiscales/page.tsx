'use client';

import { MultiActionWorkspace } from '@/components/screens/MultiActionWorkspace';
import { accountingService } from '@/services/accountingService';
import { loadLegalEntities } from '@/services/optionLoaders';

export default function BranchesFiscalYearsPage() {
  return (
    <MultiActionWorkspace
      moduleLabel="Contabilidad"
      title="Sucursales y años fiscales"
      description="Defina sucursales contables y años fiscales vinculados a una entidad legal previamente registrada."
      actions={[
        {
          id: 'branch', title: 'Create Accounting Branch', description: 'Unidad operativa que emitirá y contabilizará documentos.', icon: 'account_balance', submitLabel: 'Crear sucursal', onSubmit: accountingService.createBranch,
          fields: [
            { name: 'legalEntityId', label: 'Entidad legal', type: 'select', required: true, span: 2, optionsLoader: loadLegalEntities },
            { name: 'code', label: 'Código', required: true, placeholder: 'SCZ-CENTRAL' },
            { name: 'name', label: 'Nombre', required: true, placeholder: 'Oficina central' },
            { name: 'city', label: 'Ciudad', optional: true, placeholder: 'Santa Cruz de la Sierra', span: 2 },
          ],
        },
        {
          id: 'fiscal-year', title: 'Create Fiscal Year', description: 'Período anual que agrupa los períodos contables.', icon: 'calendar_month', submitLabel: 'Crear año fiscal', onSubmit: accountingService.createFiscalYear,
          fields: [
            { name: 'legalEntityId', label: 'Entidad legal', type: 'select', required: true, span: 2, optionsLoader: loadLegalEntities },
            { name: 'yearLabel', label: 'Etiqueta', required: true, defaultValue: '2026' },
            { name: 'startDate', label: 'Fecha inicial', type: 'date', required: true, defaultValue: '2026-01-01' },
            { name: 'endDate', label: 'Fecha final', type: 'date', required: true, defaultValue: '2026-12-31', span: 2 },
          ],
        },
      ]}
    />
  );
}
