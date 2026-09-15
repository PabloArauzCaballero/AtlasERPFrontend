'use client';
import { StructuredActionForm } from '@/components/screens/StructuredActionForm';
import { accountingService } from '@/services/accountingService';
import { loadChartsOfAccounts, loadGlAccounts, withEmpty } from '@/services/optionLoaders';
export default function CreateGlAccountPage() {
  return <StructuredActionForm moduleLabel="Contabilidad" title="Definición de la cuenta GL" description="Cree una cuenta GL dentro de una versión vigente del plan de cuentas y configure sus dimensiones obligatorias." submitLabel="Guardar cuenta" onSubmit={accountingService.createGlAccount} sections={[
    { title: 'Identification', icon: 'account_tree', fields: [
      { name: 'coaId', label: 'Plan de cuentas (COA)', tooltip: 'Plan de cuentas al que pertenece; una entidad puede tener varios.', type: 'select', required: true, span: 2, optionsLoader: loadChartsOfAccounts }, { name: 'parentAccountId', label: 'Cuenta padre', tooltip: 'Cuenta de nivel superior de la que cuelga; define la jerarquía del plan.', type: 'select', optional: true, optionsLoader: async () => withEmpty(await loadGlAccounts()) },
      { name: 'accountNo', label: 'Número de cuenta', tooltip: 'Número de cuenta según el plan. Ej.: 110201. Ordena y agrupa el balance.', required: true }, { name: 'name', label: 'Nombre', tooltip: 'Nombre de la cuenta contable. Ej.: Banco BNB cuenta corriente.', required: true, span: 2 },
      { name: 'accountType', label: 'Tipo', tooltip: 'Clase de cuenta (activo, pasivo, ingreso…); decide en qué estado financiero se presenta.', required: true, optionsSource: 'domain:accounting.glAccountType' },
      { name: 'normalBalance', label: 'Naturaleza', tooltip: 'Saldo natural de la cuenta: deudor (activos, gastos) o acreedor (pasivos, ingresos).', required: true, optionsSource: 'domain:accounting.normalBalance' },
    ] },
    { title: 'Control Flags (Dimensions)', icon: 'tune', fields: [
      ...['isControlAccount','requiresCostCenter','requiresProfitCenter','requiresPartner','requiresTaxCode'].map((name) => ({ name, label: name.replace(/([A-Z])/g, ' $1'), type: 'select' as const, valueKind: 'boolean' as const, defaultValue: 'false', options: [{ label: 'No', value: 'false' }, { label: 'Sí', value: 'true' }] })),
    ] },
  ]} />;
}
