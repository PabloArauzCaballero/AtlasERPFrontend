'use client';

import { useCallback, useState } from 'react';
import { CrudDirectory } from '@/components/screens/CrudDirectory';
import { InlineActionForm } from '@/components/screens/InlineActionForm';
import { MdrRulesPanel } from '@/components/screens/MdrRulesPanel';
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
          { name: 'proposalId', label: 'Propuesta aceptada', tooltip: 'Propuesta aceptada por el cliente de la que nace el contrato.', type: 'select', required: true, span: 2, optionsLoader: loadProposals },
          // El correlativo lo asigna el backend al generar el contrato.
          { name: 'contractNumber', label: 'Número de contrato', tooltip: 'Número del contrato; lo asigna el sistema al guardar.', assignedByBackend: true },
          { name: 'startDate', label: 'Fecha inicial', tooltip: 'Fecha en que entra en vigor.', type: 'date', required: true },
          { name: 'endDate', label: 'Fecha final', tooltip: 'Fecha en que termina; vacío = indefinido.', type: 'date', optional: true },
          { name: 'billingCycle', label: 'Ciclo de facturación', tooltip: 'Cada cuánto se factura al comercio: mensual, trimestral, por transacción…', required: true, defaultValue: 'MONTHLY', optionsSource: 'domain:crm.contractBillingCycle' },
          { name: 'settlementPolicy', label: 'Política de liquidación', tooltip: 'Cómo se liquida lo cobrado: por contrato, por sucursal o por cuenta.', required: true, defaultValue: 'PER_CONTRACT', optionsSource: 'domain:crm.contractSettlementPolicy' },
          { name: 'documentUrl', label: 'URL del documento', tooltip: 'Enlace al contrato firmado en el repositorio de documentos, con https://.', type: 'url', optional: true, span: 2 },
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
          { name: 'contractId', label: 'Contrato', tooltip: 'Contrato al que se añade el término.', type: 'select', required: true, span: 2, optionsLoader: loadContracts2 },
          { name: 'approvedByUserId', label: 'Aprobador', tooltip: 'Usuario interno que aprobó el contrato.', type: 'select', required: true, span: 2, optionsLoader: loadInternalUsers },
          /* Selector de fecha y hora: el control entrega la hora local y se envía como ISO, en vez de
             pedir que se teclee un ISO con su zona horaria. */
          { name: 'signedAt', label: 'Fecha y hora de firma', tooltip: 'Fecha y hora de la firma; desde ahí corre la vigencia.', type: 'datetime', optional: true, span: 2 },
        ]}
      />
      {/* La comisión cuelga de la versión del contrato: se administra junto al contrato, no en el
          onboarding, donde obligaba a elegir el contrato otra vez en un desplegable. */}
      <MdrRulesPanel />
    </CrudDirectory>
  );
}
