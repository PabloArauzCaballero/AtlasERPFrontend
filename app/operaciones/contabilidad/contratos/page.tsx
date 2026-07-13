'use client';
import { MultiActionWorkspace } from '@/components/screens/MultiActionWorkspace';
import { CrudTable } from '@/components/ui/CrudTable';
import { accountingService } from '@/services/accountingService';
import { loadBusinessPartners, loadContracts, loadLegalEntities } from '@/services/optionLoaders';
export default function AccountingContractsPage() {
  return <div className="space-y-6"><MultiActionWorkspace moduleLabel="Contabilidad" title="Contratos Contables" description="Registre cabeceras contractuales y términos versionados para facturación, proveedores, préstamos, intercompany o comercios." actions={[
    { id: 'header', title: 'Base Contract Definition', description: 'Identificación, contrapartes, vigencia y moneda.', icon: 'description', submitLabel: 'Post Contract', onSubmit: accountingService.createContract, fields: [
      { name: 'contractNo', label: 'Número contrato', required: true }, { name: 'contractType', label: 'Tipo', type: 'select', required: true, options: ['CUSTOMER_BILLING','SUPPLIER','LOAN','INTERCOMPANY','MERCHANT'].map((value) => ({ label: value, value })) },
      { name: 'legalEntityId', label: 'Entidad legal', type: 'select', required: true, span: 2, optionsLoader: loadLegalEntities }, { name: 'counterpartyBpId', label: 'Contraparte (Business Partner)', type: 'select', required: true, span: 2, optionsLoader: loadBusinessPartners },
      { name: 'startDate', label: 'Fecha inicial', type: 'date', required: true }, { name: 'endDate', label: 'Fecha final', type: 'date', optional: true }, { name: 'currencyCode', label: 'Moneda', defaultValue: 'BOB', required: true, span: 2 },
    ] },
    { id: 'term', title: 'Contractual Terms', description: 'Término estructurado con vigencia independiente.', icon: 'data_object', submitLabel: 'Agregar término', onSubmit: async (payload) => accountingService.createContractTerm({ ...payload, termValueJson: { value: payload.termValue }, termValue: undefined }), fields: [
      { name: 'contractId', label: 'Contrato', type: 'select', required: true, span: 2, optionsLoader: loadContracts }, { name: 'termCode', label: 'Código término', required: true }, { name: 'termValue', label: 'Valor contractual', required: true },
      { name: 'effectiveFrom', label: 'Vigente desde', type: 'date', required: true }, { name: 'effectiveTo', label: 'Vigente hasta', type: 'date', optional: true },
    ] },
  ]} /><CrudTable title="Contratos registrados" description="Historial de contratos contables. Puede editar campos básicos o eliminar." columns={['contractNo', 'contractType', 'counterpartyBpId', 'startDate', 'endDate', 'currencyCode', 'status']} editable={['contractNo', 'contractType', 'startDate', 'endDate', 'status']} list={accountingService.listContracts} update={accountingService.updateContract} remove={accountingService.deleteContract} /></div>;
}
