'use client';
import { StructuredActionForm } from '@/components/screens/StructuredActionForm';
import { accountingService } from '@/services/accountingService';
import { loadChartsOfAccounts, loadGlAccounts, withEmpty } from '@/services/optionLoaders';
export default function CreateGlAccountPage() {
  return <StructuredActionForm moduleLabel="Contabilidad" title="Account Definition" description="Cree una cuenta GL dentro de una versión vigente del plan de cuentas y configure sus dimensiones obligatorias." submitLabel="Guardar cuenta" onSubmit={accountingService.createGlAccount} sections={[
    { title: 'Identification', icon: 'account_tree', fields: [
      { name: 'coaId', label: 'Plan de cuentas (COA)', type: 'select', required: true, span: 2, optionsLoader: loadChartsOfAccounts }, { name: 'parentAccountId', label: 'Cuenta padre', type: 'select', optional: true, optionsLoader: async () => withEmpty(await loadGlAccounts()) },
      { name: 'accountNo', label: 'Número de cuenta', required: true }, { name: 'name', label: 'Nombre', required: true, span: 2 },
      { name: 'accountType', label: 'Tipo', type: 'select', required: true, options: ['ASSET','LIABILITY','EQUITY','REVENUE','EXPENSE','CONTRA_ASSET'].map((value) => ({ label: value, value })) },
      { name: 'normalBalance', label: 'Naturaleza', type: 'select', required: true, options: [{ label: 'Débito', value: 'D' }, { label: 'Crédito', value: 'C' }] },
    ] },
    { title: 'Control Flags (Dimensions)', icon: 'tune', fields: [
      ...['isControlAccount','requiresCostCenter','requiresProfitCenter','requiresPartner','requiresTaxCode'].map((name) => ({ name, label: name.replace(/([A-Z])/g, ' $1'), type: 'select' as const, valueKind: 'boolean' as const, defaultValue: 'false', options: [{ label: 'No', value: 'false' }, { label: 'Sí', value: 'true' }] })),
    ] },
  ]} />;
}
