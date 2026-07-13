'use client';

import { StructuredActionForm } from '@/components/screens/StructuredActionForm';
import { b2bService } from '@/services/b2bService';
import type { JsonObject } from '@/services/types';

export default function QualifyAccountPage() {
  async function qualify(payload: JsonObject) {
    const accountId = String(payload.accountId ?? '');
    const { accountId: _accountId, ...body } = payload;
    return b2bService.qualifyAccount(accountId, body);
  }

  return (
    <StructuredActionForm
      moduleLabel="CRM"
      title="Qualify Account"
      description="Formalice el fit comercial, documente la decisión y cree una oportunidad cuando corresponda."
      submitLabel="Finalizar decisión"
      submitIcon="verified"
      onSubmit={qualify}
      sections={[
        {
          title: 'Institutional Record', icon: 'history_edu', description: 'Cuenta y resultado de la evaluación.', fields: [
            { name: 'accountId', label: 'UUID de cuenta', required: true, span: 2 },
            { name: 'hasCommercialFit', label: '¿Tiene fit comercial?', type: 'select', valueKind: 'boolean', required: true, defaultValue: 'true', options: [{ label: 'Sí, calificar', value: 'true' }, { label: 'No, descalificar', value: 'false' }] },
            { name: 'disqualificationReason', label: 'Motivo de descalificación', type: 'textarea', optional: true, placeholder: 'Obligatorio si no existe fit comercial.', span: 3 },
          ],
        },
        {
          title: 'Qualification Framework', icon: 'fact_check', description: 'Oportunidad opcional asociada a la decisión positiva.', fields: [
            { name: 'createOpportunity', label: 'Crear oportunidad', type: 'select', valueKind: 'boolean', required: true, defaultValue: 'false', options: [{ label: 'No', value: 'false' }, { label: 'Sí', value: 'true' }] },
            { name: 'opportunity.name', label: 'Nombre de oportunidad', optional: true, span: 2 },
            { name: 'opportunity.opportunityType', label: 'Tipo de oportunidad', type: 'select', optional: true, options: [
              { label: 'Nuevo comercio', value: 'NEW_MERCHANT' }, { label: 'Expansión', value: 'EXPANSION' }, { label: 'Renovación', value: 'RENEWAL' },
            ] },
            { name: 'opportunity.expectedMonthlyVolume', label: 'Volumen mensual (BOB)', type: 'number', valueKind: 'number', optional: true },
            { name: 'opportunity.expectedMdrRate', label: 'MDR esperado (%)', type: 'number', valueKind: 'number', optional: true },
            { name: 'opportunity.probability', label: 'Probabilidad (%)', type: 'number', valueKind: 'number', optional: true, defaultValue: 0 },
            { name: 'opportunity.expectedCloseDate', label: 'Fecha estimada de cierre', type: 'date', optional: true },
          ],
        },
      ]}
      warning="Si selecciona crear oportunidad, complete sus datos. Si descalifica la cuenta, registre un motivo claro y verificable."
    />
  );
}
