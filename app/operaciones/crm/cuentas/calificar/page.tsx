'use client';

import { StructuredActionForm } from '@/components/screens/StructuredActionForm';
import { b2bService } from '@/services/b2bService';
import type { JsonObject } from '@/services/types';
import { loadB2BAccounts } from '@/services/optionLoaders';

export default function QualifyAccountPage() {
  async function qualify(payload: JsonObject) {
    const accountId = String(payload.accountId ?? '');
    const { accountId: _accountId, ...body } = payload;
    return b2bService.qualifyAccount(accountId, body);
  }

  return (
    <StructuredActionForm
      moduleLabel="CRM"
      title="Calificar cuenta"
      description="Formalice el fit comercial, documente la decisión y cree una oportunidad cuando corresponda."
      submitLabel="Finalizar decisión"
      submitIcon="verified"
      onSubmit={qualify}
      sections={[
        {
          title: 'Institutional Record', icon: 'history_edu', description: 'Cuenta y resultado de la evaluación.', fields: [
            { name: 'accountId', label: 'Cuenta B2B', tooltip: 'Cuenta B2B del comercio sobre la que se trabaja.', type: 'select', required: true, span: 2, optionsLoader: loadB2BAccounts },
            { name: 'hasCommercialFit', label: '¿Tiene fit comercial?', tooltip: 'Si el negocio encaja con lo que ofrecemos; sin fit no se abre oportunidad.', type: 'select', valueKind: 'boolean', required: true, defaultValue: 'true', options: [{ label: 'Sí, calificar', value: 'true' }, { label: 'No, descalificar', value: 'false' }] },
            { name: 'disqualificationReason', label: 'Motivo de descalificación', tooltip: 'Por qué se descarta; sirve para no volver a contactar sin motivo.', type: 'textarea', optional: true, placeholder: 'Obligatorio si no existe fit comercial.', span: 3 },
          ],
        },
        {
          title: 'Qualification Framework', icon: 'fact_check', description: 'Oportunidad opcional asociada a la decisión positiva.', fields: [
            { name: 'createOpportunity', label: 'Crear oportunidad', tooltip: 'Si al calificar se abre ya una oportunidad comercial.', type: 'select', valueKind: 'boolean', required: true, defaultValue: 'false', options: [{ label: 'No', value: 'false' }, { label: 'Sí', value: 'true' }] },
            { name: 'opportunity.name', label: 'Nombre de oportunidad', tooltip: 'Nombre de la oportunidad. Ej.: Afiliación cadena Hipermaxi.', optional: true, span: 2 },
            /* Del backend: la lista local ofrecía EXPANSION, que el esquema rechaza, y le faltaban
               UPSELL, CROSS_SELL y REACTIVATION. */
            { name: 'opportunity.opportunityType', label: 'Tipo de oportunidad', tooltip: 'Qué se vende: afiliación nueva, ampliación, renovación…', type: 'select', optional: true, optionsSource: 'domain:crm.opportunityType' },
            { name: 'opportunity.expectedMonthlyVolume', label: 'Volumen mensual (BOB)', tooltip: 'Ventas mensuales estimadas en bolivianos; dimensiona la oportunidad.', type: 'number', valueKind: 'number', optional: true },
            { name: 'opportunity.expectedMdrRate', label: 'MDR esperado (%)', tooltip: 'Comisión (MDR) en porcentaje que se espera pactar. Ej.: 3.5.', type: 'number', valueKind: 'number', optional: true },
            { name: 'opportunity.probability', label: 'Probabilidad (%)', tooltip: 'Probabilidad de cierre en porcentaje; pondera el pronóstico. Ej.: 60.', type: 'number', valueKind: 'number', optional: true, defaultValue: 0 },
            { name: 'opportunity.expectedCloseDate', label: 'Fecha estimada de cierre', tooltip: 'Fecha estimada de firma; ordena el pipeline.', type: 'date', optional: true },
          ],
        },
      ]}
      warning="Si selecciona crear oportunidad, complete sus datos. Si descalifica la cuenta, registre un motivo claro y verificable."
    />
  );
}
