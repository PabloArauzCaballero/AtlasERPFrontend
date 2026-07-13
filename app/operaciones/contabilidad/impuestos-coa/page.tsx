'use client';

import { MultiActionWorkspace } from '@/components/screens/MultiActionWorkspace';
import { accountingService } from '@/services/accountingService';

export default function TaxesCoaPage() {
  return (
    <MultiActionWorkspace
      moduleLabel="Contabilidad"
      title="Impuestos y Plan de Cuentas"
      description="Versione el plan de cuentas y registre códigos tributarios con vigencia controlada."
      actions={[
        {
          id: 'coa', title: 'Plan de Cuentas (COA)', description: 'Cabecera versionada del plan de cuentas.', icon: 'account_tree', submitLabel: 'Guardar versión COA', onSubmit: accountingService.createChartOfAccounts,
          fields: [
            { name: 'code', label: 'Código', required: true, placeholder: 'COA-BO' },
            { name: 'versionNo', label: 'Versión', type: 'number', valueKind: 'number', required: true, defaultValue: 1 },
            { name: 'name', label: 'Nombre', required: true, placeholder: 'Plan de cuentas ATLAS Bolivia', span: 2 },
            { name: 'effectiveFrom', label: 'Vigente desde', type: 'date', required: true },
            { name: 'effectiveTo', label: 'Vigente hasta', type: 'date', optional: true },
          ],
        },
        {
          id: 'tax', title: 'Nuevo Código Tributario', description: 'Tasa, recuperabilidad y vigencia de aplicación.', icon: 'receipt', submitLabel: 'Guardar código', onSubmit: accountingService.createTaxCode,
          fields: [
            { name: 'code', label: 'Código', required: true, placeholder: 'IVA13_VENTA' },
            { name: 'taxType', label: 'Tipo', type: 'select', required: true, options: [
              { label: 'IVA', value: 'IVA' }, { label: 'IT', value: 'IT' }, { label: 'IUE', value: 'IUE' }, { label: 'Retención', value: 'RETENTION' }, { label: 'Otro', value: 'OTHER' },
            ] },
            { name: 'rate', label: 'Tasa (%)', type: 'number', valueKind: 'number', required: true, defaultValue: 13 },
            { name: 'recoverablePercent', label: 'Recuperable (%)', type: 'number', valueKind: 'number', required: true, defaultValue: 0 },
            { name: 'effectiveFrom', label: 'Vigente desde', type: 'date', required: true },
            { name: 'effectiveTo', label: 'Vigente hasta', type: 'date', optional: true },
          ],
        },
      ]}
    />
  );
}
