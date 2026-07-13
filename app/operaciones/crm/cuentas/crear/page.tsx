'use client';

import { StructuredActionForm } from '@/components/screens/StructuredActionForm';
import { b2bService } from '@/services/b2bService';
import { industryOptions, riskTierOptions } from '@/lib/catalogs';

const optionalSelect = <T extends { label: string; value: string }>(options: T[]) => [
  { label: '— Sin especificar —', value: '' },
  ...options,
];

export default function CreateB2BAccountPage() {
  return (
    <StructuredActionForm
      moduleLabel="CRM"
      title="Registrar cuenta comercial B2B"
      description="Registre la identidad corporativa, clasificación comercial, volumen esperado y contacto principal de la nueva cuenta B2B."
      submitLabel="Crear cuenta B2B"
      submitIcon="domain_add"
      onSubmit={b2bService.createAccount}
      sections={[
        {
          title: 'Account Details', icon: 'domain', description: 'Identificación legal y segmentación comercial.', fields: [
            { name: 'legalName', label: 'Razón social', required: true, placeholder: 'Empresa Ejemplo S.R.L.', span: 2 },
            { name: 'tradeName', label: 'Nombre comercial', required: true, placeholder: 'Marca Ejemplo' },
            { name: 'taxId', label: 'NIT', optional: true, placeholder: 'Número de identificación tributaria' },
            { name: 'accountType', label: 'Tipo de cuenta', type: 'select', required: true, defaultValue: 'MERCHANT', options: [
              { label: 'Comercio', value: 'MERCHANT' }, { label: 'Empresa', value: 'ENTERPRISE' }, { label: 'Socio', value: 'PARTNER' },
            ] },
            { name: 'industry', label: 'Industria', type: 'select', optional: true, options: optionalSelect(industryOptions) },
            { name: 'category', label: 'Categoría comercial', required: true, placeholder: 'Retail, Servicios, Manufactura' },
            { name: 'businessLine', label: 'Rubro / actividad principal', required: true, placeholder: 'Electrodomésticos, educación, logística' },
            { name: 'businessDescription', label: 'Descripción del negocio', type: 'textarea', optional: true, placeholder: 'Actividad, propuesta de valor y mercado objetivo...', span: 3 },
            { name: 'tags', label: 'Tags de clasificación', valueKind: 'stringList', optional: true, placeholder: 'mayorista, omnicanal, pyme', hint: 'Separe los tags con comas.' },
            { name: 'websiteUrl', label: 'Sitio web', type: 'url', optional: true, placeholder: 'https://empresa.com' },
            { name: 'countryCode', label: 'País (ISO)', required: true, defaultValue: 'BO' },
            { name: 'city', label: 'Ciudad', optional: true },
            { name: 'address', label: 'Dirección comercial', optional: true, span: 2 },
            { name: 'employeeCount', label: 'Cantidad de empleados', type: 'number', valueKind: 'number', optional: true },
            { name: 'foundedYear', label: 'Año de fundación', type: 'number', valueKind: 'number', optional: true },
            { name: 'annualRevenue', label: 'Facturación anual (BOB)', type: 'number', valueKind: 'number', optional: true },
            { name: 'ownerUserId', label: 'UUID del responsable', optional: true, placeholder: 'Usuario propietario' },
            { name: 'territoryId', label: 'UUID del territorio', optional: true, placeholder: 'Territorio comercial' },
            { name: 'riskTier', label: 'Nivel de riesgo inicial', type: 'select', optional: true, options: optionalSelect(riskTierOptions) },
            { name: 'expectedMonthlyVolume', label: 'Volumen mensual esperado (BOB)', type: 'number', valueKind: 'number', optional: true, placeholder: '150000' },
            { name: 'notes', label: 'Notas comerciales', type: 'textarea', optional: true, placeholder: 'Contexto, referencias y observaciones...', span: 3 },
          ],
        },
        {
          title: 'Primary Contact Details', icon: 'contact_page', description: 'Persona responsable para coordinación comercial y contractual.', fields: [
            { name: 'primaryContact.fullName', label: 'Nombre completo', required: true, placeholder: 'Nombre y apellido', span: 2 },
            { name: 'primaryContact.roleTitle', label: 'Cargo', optional: true, placeholder: 'Gerente comercial' },
            { name: 'primaryContact.email', label: 'Correo corporativo', type: 'email', optional: true, placeholder: 'contacto@empresa.com' },
            { name: 'primaryContact.phone', label: 'Teléfono', optional: true, placeholder: '+591 7...' },
            { name: 'primaryContact.decisionRole', label: 'Rol en la decisión', optional: true, placeholder: 'Decisor / Influenciador' },
          ],
        },
      ]}
      summaryTitle="Control de alta comercial"
      summaryItems={[
        { label: 'Estado inicial', value: 'LEAD', tone: 'warning' },
        { label: 'Validación KYB', value: 'Posterior', tone: 'neutral' },
        { label: 'Moneda operativa', value: 'BOB', tone: 'success' },
      ]}
    />
  );
}
