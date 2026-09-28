'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { StructuredActionForm } from '@/components/screens/StructuredActionForm';
import { PageSkeleton } from '@/components/ui/PageSkeleton';
import { useAsyncResource } from '@/hooks/useAsyncResource';
import { b2bService } from '@/services/b2bService';
import type { JsonObject, ResourceRow } from '@/services/types';
import { loadB2BAccounts } from '@/services/optionLoaders';

const texto = (value: unknown) => (value === null || value === undefined ? undefined : String(value));
const numero = (value: unknown) => (value === null || value === undefined || value === '' ? undefined : Number(value));

/**
 * Calificar es CLASIFICAR la cuenta y dejarle los datos que el CRM usa para segmentar y priorizar
 * (Pablo, 2026-09-28): sector, categoría, rubro, qué ofrece el negocio, tamaño y volumen. Antes el
 * formulario sólo pedía «¿tiene fit?» y abría una oportunidad en el mismo paso; ahora la oportunidad
 * es el paso SIGUIENTE (calificar → oportunidad → onboarding) y se crea desde la ficha.
 *
 * Los campos llegan rellenos con lo que la cuenta ya tiene: calificar es revisar y completar, no
 * volver a escribir el alta.
 */
export function QualifyAccountScreen({ accountId }: { accountId: string }) {
  const router = useRouter();
  const load = useCallback(() => (accountId ? b2bService.getAccount(accountId) : Promise.resolve({} as ResourceRow)), [accountId]);
  const cuenta = useAsyncResource(load, Boolean(accountId));
  if (accountId && cuenta.status === 'loading') return <PageSkeleton />;
  const actual = cuenta.data ?? {};

  async function qualify(payload: JsonObject) {
    const id = String(payload.accountId ?? '');
    const { accountId: _accountId, ...body } = payload;
    return b2bService.qualifyAccount(id, body);
  }

  return (
    <StructuredActionForm
      key={String(actual.id ?? 'nueva')}
      moduleLabel="CRM"
      title="Calificar cuenta"
      description="Decide si el negocio encaja con Atlas y clasifícalo con los datos que el equipo comercial usa para priorizar. Calificada la cuenta, ya se le puede abrir una oportunidad."
      submitLabel="Guardar calificación"
      submitIcon="verified"
      onSubmit={qualify}
      onDone={() => {
        if (accountId) router.push(`/operaciones/crm/cuentas/detalle?id=${accountId}`);
      }}
      sections={[
        {
          title: 'Decisión', icon: 'verified', description: 'Si el negocio encaja con lo que ofrece Atlas.', fields: [
            { name: 'accountId', label: 'Cuenta B2B', tooltip: 'Cuenta B2B del comercio que se califica.', type: 'select', required: true, span: 2, optionsLoader: loadB2BAccounts, defaultValue: accountId || undefined },
            { name: 'hasCommercialFit', label: '¿Encaja con Atlas?', tooltip: 'Si el negocio encaja con lo que ofrecemos. Sin encaje la cuenta se descalifica y no se le abre oportunidad.', type: 'select', valueKind: 'boolean', required: true, defaultValue: 'true', options: [{ label: 'Sí, calificar', value: 'true' }, { label: 'No, descalificar', value: 'false' }] },
            { name: 'disqualificationReason', label: 'Motivo de descalificación', tooltip: 'Por qué se descarta; sirve para no volver a contactar sin motivo.', type: 'textarea', optional: true, placeholder: 'Obligatorio si no encaja. Ej.: no acepta pagos con tarjeta.', span: 3 },
          ],
        },
        {
          title: 'Clasificación del negocio', icon: 'category', description: 'Cómo se agrupa y prioriza la cuenta en la cartera. Sólo se guarda si la cuenta encaja.', fields: [
            { name: 'classification.industry', label: 'Sector', tooltip: 'Sector económico del comercio; agrupa la cartera.', optional: true, optionsSource: 'domain:crm.industry', defaultValue: texto(actual.industry) },
            { name: 'classification.category', label: 'Categoría comercial', tooltip: 'Tipo de comercio dentro de su sector; afina las reglas de comisión.', optional: true, optionsSource: 'domain:crm.merchantCategory', defaultValue: texto(actual.category) },
            { name: 'classification.businessLine', label: 'Rubro', tooltip: 'Qué vende exactamente el comercio. Ej.: Farmacia, Restaurante.', optional: true, optionsSource: 'domain:crm.businessLine', defaultValue: texto(actual.businessLine) },
            { name: 'classification.businessDescription', label: 'Qué ofrece el negocio', tooltip: 'Descripción breve de lo que vende y a quién, dentro de su segmento. Es lo primero que lee el comercial antes de abrir una oportunidad.', type: 'textarea', optional: true, span: 3, placeholder: 'Ej.: Cadena de farmacias con 12 sucursales en Santa Cruz; fuerte en dermocosmética y venta a crédito a clientes frecuentes.', hint: 'Obligatorio para calificar si la cuenta aún no lo tiene. Mínimo 10 caracteres.', defaultValue: texto(actual.businessDescription) },
            { name: 'classification.expectedMonthlyVolume', label: 'Ventas mensuales esperadas con Atlas (BOB)', tooltip: 'Cuánto se espera que venda al mes con Atlas; dimensiona la cuenta.', type: 'number', valueKind: 'number', optional: true, defaultValue: numero(actual.expectedMonthlyVolume) },
            { name: 'classification.annualRevenue', label: 'Facturación anual (BOB)', tooltip: 'Tamaño del negocio por su facturación anual aproximada.', type: 'number', valueKind: 'number', optional: true, defaultValue: numero(actual.annualRevenue) },
            { name: 'classification.employeeCount', label: 'Empleados', tooltip: 'Número aproximado de empleados; otra medida del tamaño.', type: 'number', valueKind: 'number', optional: true, defaultValue: numero(actual.employeeCount) },
            { name: 'classification.riskTier', label: 'Nivel de riesgo', tooltip: 'Riesgo comercial percibido; ordena a quién se prioriza y con qué condiciones.', optional: true, optionsSource: 'domain:crm.riskTier', defaultValue: texto(actual.riskTier) },
            { name: 'classification.websiteUrl', label: 'Sitio web', tooltip: 'Web o red social principal del negocio. Ej.: https://farmaciaejemplo.bo.', type: 'url', optional: true, defaultValue: texto(actual.websiteUrl) },
          ],
        },
      ]}
      warning="Si la cuenta no encaja, registra un motivo claro. Si encaja, deja al menos qué ofrece el negocio: sin eso no se califica."
    />
  );
}
