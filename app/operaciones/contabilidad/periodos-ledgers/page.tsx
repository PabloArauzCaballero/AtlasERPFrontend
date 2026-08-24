'use client';

import { MultiActionWorkspace } from '@/components/screens/MultiActionWorkspace';
import { accountingService } from '@/services/accountingService';
import { loadLegalEntities } from '@/services/optionLoaders';

export default function PeriodsLedgersPage() {
  return (
    <MultiActionWorkspace
      moduleLabel="Contabilidad"
      title="Períodos y libros contables"
      description="Configure períodos operativos y libros paralelos para contabilidad local, gerencial e IFRS."
      actions={[
        {
          id: 'period', title: 'Create Accounting Period', description: 'Ventana habilitada para fechas de contabilización.', icon: 'date_range', submitLabel: 'Crear período', onSubmit: accountingService.createPeriod,
          fields: [
            { name: 'fiscalYearId', label: 'UUID año fiscal', required: true, span: 2 },
            { name: 'periodNo', label: 'Número de período', type: 'number', valueKind: 'number', required: true, defaultValue: 1 },
            { name: 'startDate', label: 'Fecha inicial', type: 'date', required: true },
            { name: 'endDate', label: 'Fecha final', type: 'date', required: true, span: 2 },
          ],
        },
        {
          id: 'ledger', title: 'Create Ledger', description: 'Libro contable por base normativa o propósito gerencial.', icon: 'menu_book', submitLabel: 'Crear ledger', onSubmit: accountingService.createLedger,
          fields: [
            { name: 'legalEntityId', label: 'Entidad legal', type: 'select', required: true, span: 2, optionsLoader: loadLegalEntities },
            { name: 'code', label: 'Código', required: true, placeholder: 'LOCAL-BO' },
            { name: 'name', label: 'Nombre', required: true, placeholder: 'Libro local Bolivia' },
            { name: 'accountingBasis', label: 'Base contable', type: 'select', required: true, defaultValue: 'LOCAL_BO', options: [
              { label: 'Local Bolivia', value: 'LOCAL_BO' }, { label: 'Gerencial', value: 'MANAGEMENT' }, { label: 'IFRS', value: 'IFRS' },
            ], span: 2 },
            { name: 'isDefault', label: 'Libro predeterminado', type: 'select', valueKind: 'boolean', defaultValue: 'false', options: [{ label: 'No', value: 'false' }, { label: 'Sí', value: 'true' }], span: 2 },
          ],
        },
      ]}
    />
  );
}
