'use client';

import { useCallback, useState } from 'react';
import { CrudDirectory } from '@/components/screens/CrudDirectory';
import { InlineActionForm } from '@/components/screens/InlineActionForm';
import { b2bService } from '@/services/b2bService';
import { loadContracts2, loadInternalUsers, loadProposals } from '@/services/optionLoaders';
import type { JsonObject } from '@/services/types';

export default function CommercialContractsPage() {
  const [recargar, setRecargar] = useState(0);

  const load = useCallback(
    () => b2bService.listContracts(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [recargar],
  );

  async function firmar(payload: JsonObject) {
    const contractId = String(payload.contractId ?? '');
    const { contractId: _contractId, ...body } = payload;
    return b2bService.signAndActivateContract(contractId, body);
  }

  return (
    <CrudDirectory
      moduleLabel="CRM"
      title="Contratos comerciales"
      description="Todos los contratos generados desde propuestas aceptadas, con su vigencia, ciclo de facturación y estado de firma."
      load={load}
      searchPlaceholder="Buscar por número de contrato o estado…"
      emptyHint="Genera el primer contrato desde una propuesta aceptada con el botón «Generar contrato»."
      labelKey="contractNumber"
      columns={[
        { key: 'contractNumber', label: 'Número', kind: 'mono' },
        { key: 'startDate', label: 'Inicio', kind: 'date' },
        { key: 'endDate', label: 'Fin', kind: 'date' },
        { key: 'billingCycle', label: 'Ciclo' },
        { key: 'settlementPolicy', label: 'Liquidación' },
        { key: 'signedAt', label: 'Firmado', kind: 'date' },
        { key: 'status', label: 'Estado', kind: 'status' },
      ]}
      filters={[
        { key: 'status', label: 'Estado' },
        { key: 'billingCycle', label: 'Ciclo' },
      ]}
      notice={{
        tone: 'info',
        title: 'Un contrato comercial no se edita ni se borra',
        body: 'Nace de una propuesta aceptada y su vigencia es la prueba de lo pactado. Para cambiarlo se genera uno nuevo desde otra propuesta; para dejar de aplicarlo se firma y se cierra su vigencia.',
      }}
      create={{
        label: 'Generar contrato',
        title: 'Generar contrato desde propuesta',
        description: 'Cabecera contractual heredada de una propuesta ya aceptada.',
        fields: [
          { name: 'proposalId', label: 'Propuesta aceptada', type: 'select', required: true, span: 2, optionsLoader: loadProposals },
          { name: 'contractNumber', label: 'Número de contrato', required: true, placeholder: 'CTR-2026-001' },
          { name: 'startDate', label: 'Fecha inicial', type: 'date', required: true },
          { name: 'endDate', label: 'Fecha final', type: 'date', optional: true },
          { name: 'billingCycle', label: 'Ciclo de facturación', required: true, defaultValue: 'MONTHLY' },
          { name: 'settlementPolicy', label: 'Política de liquidación', required: true, defaultValue: 'PER_CONTRACT' },
          { name: 'documentUrl', label: 'URL del documento', type: 'url', optional: true, span: 2 },
        ],
        submit: (payload: JsonObject) => b2bService.createContractFromProposal(payload),
      }}
    >
      <InlineActionForm
        title="Firma y activación"
        description="Confirmación institucional del contrato: quién lo aprueba y cuándo se firmó."
        icon="draw"
        submitLabel="Firmar y activar"
        submitIcon="verified"
        successMessage="El contrato quedó firmado y activo."
        onDone={() => setRecargar((value) => value + 1)}
        onSubmit={firmar}
        fields={[
          { name: 'contractId', label: 'Contrato', type: 'select', required: true, span: 2, optionsLoader: loadContracts2 },
          { name: 'approvedByUserId', label: 'Aprobador', type: 'select', required: true, span: 2, optionsLoader: loadInternalUsers },
          { name: 'signedAt', label: 'Fecha y hora de firma', optional: true, placeholder: '2026-07-10T20:00:00-04:00', span: 2 },
        ]}
      />
    </CrudDirectory>
  );
}
