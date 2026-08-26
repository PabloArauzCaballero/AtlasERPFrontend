'use client';

import { MultiActionWorkspace } from '@/components/screens/MultiActionWorkspace';
import { RecordsPanel } from '@/components/screens/RecordsPanel';
import { b2bService } from '@/services/b2bService';
import type { JsonObject } from '@/services/types';
import { loadContracts2, loadInternalUsers, loadProposals } from '@/services/optionLoaders';

export default function CommercialContractsPage() {
  async function sign(payload: JsonObject) {
    const contractId = String(payload.contractId ?? '');
    const { contractId: _contractId, ...body } = payload;
    return b2bService.signAndActivateContract(contractId, body);
  }
  return (
    <div className="space-y-5">
      <RecordsPanel title="Contratos comerciales" load={b2bService.listContracts} emptyHint="Genera el primer contrato desde una propuesta aceptada, abajo." />
    <MultiActionWorkspace
      moduleLabel="CRM"
      title="Generar contrato comercial"
      description="Genere el contrato desde una propuesta aceptada y complete la firma y activación con responsables identificados."
      sideTitle="Flujo contractual"
      actions={[
        {
          id: 'create', title: 'Datos del contrato', description: 'Cabecera contractual heredada de una propuesta.', icon: 'description', submitLabel: 'Generar contrato', onSubmit: b2bService.createContractFromProposal,
          fields: [
            { name: 'proposalId', label: 'Propuesta aceptada', type: 'select', required: true, span: 2, optionsLoader: loadProposals },
            { name: 'contractNumber', label: 'Número de contrato', required: true, placeholder: 'CTR-2026-001' },
            { name: 'startDate', label: 'Fecha inicial', type: 'date', required: true },
            { name: 'endDate', label: 'Fecha final', type: 'date', optional: true },
            { name: 'billingCycle', label: 'Ciclo de facturación', required: true, defaultValue: 'MONTHLY' },
            { name: 'settlementPolicy', label: 'Política de liquidación', required: true, defaultValue: 'PER_CONTRACT' },
            { name: 'documentUrl', label: 'URL de documento', type: 'url', optional: true, span: 2 },
          ],
        },
        {
          id: 'sign', title: 'Firma y activación', description: 'Confirmación institucional y activación del contrato.', icon: 'draw', submitLabel: 'Firmar y activar', submitIcon: 'verified', onSubmit: sign,
          fields: [
            { name: 'contractId', label: 'Contrato', type: 'select', required: true, span: 2, optionsLoader: loadContracts2 },
            { name: 'approvedByUserId', label: 'Aprobador', type: 'select', required: true, span: 2, optionsLoader: loadInternalUsers },
            { name: 'signedAt', label: 'Fecha y hora de firma', type: 'text', optional: true, placeholder: '2026-07-10T20:00:00-04:00', span: 2 },
          ],
        },
      ]}
      sideItems={[
        { label: 'Propuesta aceptada', detail: 'Debe existir una propuesta válida y autorizada.', icon: 'request_quote' },
        { label: 'Contrato generado', detail: 'Se fijan vigencia, ciclo y política de liquidación.', icon: 'description' },
        { label: 'Firma y activación', detail: 'Se registra aprobador y marca temporal.', icon: 'verified' },
      ]}
    />
    </div>
  );
}
