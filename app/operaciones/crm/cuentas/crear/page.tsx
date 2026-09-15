'use client';

import { useRouter } from 'next/navigation';
import { StructuredActionForm } from '@/components/screens/StructuredActionForm';
import { b2bService } from '@/services/b2bService';
import { loadInternalUsers } from '@/services/optionLoaders';

/** Etiqueta de la opción vacía de los selects opcionales de esta alta. */
const SIN_ESPECIFICAR = '— Sin especificar —';

const optionalSelect = <T extends { label: string; value: string }>(options: T[]) => [
  { label: SIN_ESPECIFICAR, value: '' },
  ...options,
];

export default function CreateB2BAccountPage() {
  const router = useRouter();
  return (
    <StructuredActionForm
      moduleLabel="CRM"
      title="Registrar una empresa nueva"
      description="Da de alta una empresa en el directorio comercial. Con los datos marcados con asterisco basta para crearla; el resto se puede completar después. La empresa entra como «lead» (posible cliente) y avanza desde su ficha."
      submitLabel="Crear empresa"
      submitIcon="domain_add"
      onSubmit={async (payload) => {
        const creada = await b2bService.createAccount(payload);
        // Al guardar se abre la ficha: es donde se califica y se abre la oportunidad (el paso siguiente).
        if (creada?.id) router.push(`/operaciones/crm/cuentas/detalle?id=${encodeURIComponent(String(creada.id))}`);
        return creada;
      }}
      sections={[
        {
          title: 'Datos de la empresa', icon: 'domain', description: 'Quién es la empresa y a qué se dedica.', fields: [
            { name: 'legalName', label: 'Razón social', required: true, placeholder: 'Empresa Ejemplo S.R.L.', span: 2 },
            { name: 'tradeName', label: 'Nombre comercial', required: true, placeholder: 'Marca Ejemplo' },
            { name: 'taxId', label: 'NIT', optional: true, placeholder: 'Número de identificación tributaria' },
            /* Los valores válidos los publica el backend. La lista local ofrecía ENTERPRISE, que el
               esquema rechaza, y no tenía DISTRIBUTOR ni FINANCIAL_ALLY. */
            { name: 'accountType', label: 'Tipo de cuenta', type: 'select', required: true, defaultValue: 'MERCHANT', optionsSource: 'domain:crm.accountType' },
            { name: 'industry', label: 'Industria', type: 'select', optional: true, optionsSource: 'domain:crm.industry', emptyOption: SIN_ESPECIFICAR },
            { name: 'category', label: 'Categoría comercial', type: 'select', required: true, optionsSource: 'domain:crm.merchantCategory', hint: 'Catálogo cerrado: es lo que agrupa la cartera por tipo de comercio.' },
            { name: 'businessLine', label: 'Rubro / actividad principal', type: 'select', required: true, optionsSource: 'domain:crm.businessLine', hint: 'Qué vende exactamente el comercio.' },
            { name: 'businessDescription', label: 'Descripción del negocio', type: 'textarea', optional: true, placeholder: 'Actividad, propuesta de valor y mercado objetivo...', span: 3 },
            { name: 'tags', label: 'Tags de clasificación', type: 'chips', valueKind: 'stringList', optional: true, placeholder: 'mayorista, omnicanal, pyme', hint: 'Escribe cada tag y pulsa Enter.' },
            { name: 'websiteUrl', label: 'Sitio web', type: 'url', optional: true, placeholder: 'https://empresa.com' },
            /* País y ciudad en un árbol con banderas: elegir la ciudad fija el país, y nunca quedan incoherentes. */
            { name: 'countryCode', label: 'País y ciudad', type: 'countryCity', cityFieldName: 'city', required: true, defaultValue: 'BO', hint: 'Elige la ciudad dentro de su país. Si no está, escríbela en «Otra ciudad».' },
            { name: 'address', label: 'Casa matriz', type: 'address', cityFieldName: 'city', countryFieldName: 'countryCode', optional: true, span: 2, placeholder: 'Calle, número, zona...', hint: 'Pulsa el pin (o Enter) para verla en Google Maps.' },
            { name: 'employeeCount', label: 'Cantidad de empleados', type: 'number', valueKind: 'number', optional: true },
            { name: 'foundedYear', label: 'Año de fundación', type: 'number', valueKind: 'number', optional: true },
            { name: 'annualRevenue', label: 'Facturación anual (BOB)', type: 'number', valueKind: 'number', optional: true },
            /* Nadie sabe de memoria un UUID: el responsable se ELIGE de la lista de usuarios internos. */
            { name: 'ownerUserId', label: 'Ejecutivo responsable', type: 'select', optional: true, optionsLoader: async () => optionalSelect(await loadInternalUsers()) },
            { name: 'riskTier', label: 'Nivel de riesgo inicial', type: 'select', optional: true, optionsSource: 'domain:crm.riskTier', emptyOption: SIN_ESPECIFICAR },
            { name: 'expectedMonthlyVolume', label: 'Volumen mensual esperado (BOB)', type: 'number', valueKind: 'number', optional: true, placeholder: '150000' },
            { name: 'notes', label: 'Notas comerciales', type: 'textarea', optional: true, placeholder: 'Contexto, referencias y observaciones...', span: 3 },
          ],
        },
        {
          title: 'Persona de contacto', icon: 'contact_page', description: 'Con quién se coordina en la empresa.', fields: [
            { name: 'primaryContact.fullName', label: 'Nombre completo', required: true, placeholder: 'Nombre y apellido', span: 2 },
            { name: 'primaryContact.roleTitle', label: 'Cargo', type: 'select', optional: true, optionsSource: 'domain:crm.contactRoleTitle', emptyOption: SIN_ESPECIFICAR, hint: 'Qué puesto ocupa en la empresa.' },
            { name: 'primaryContact.email', label: 'Correo', type: 'email', optional: true, placeholder: 'contacto@empresa.com' },
            { name: 'primaryContact.phone', label: 'Teléfono', optional: true, placeholder: '+591 7...' },
            { name: 'primaryContact.decisionRole', label: 'Peso en la decisión', type: 'select', optional: true, optionsSource: 'domain:crm.decisionRole', emptyOption: SIN_ESPECIFICAR, hint: 'Si decide la compra o solo influye. Ayuda a saber a quién convencer.' },
          ],
        },
      ]}
      summaryTitle="Qué pasa al crearla"
      summaryItems={[
        { label: 'Entra como', value: 'Posible cliente', tone: 'warning' },
        { label: 'Verificación legal', value: 'Queda pendiente', tone: 'neutral' },
        { label: 'Moneda', value: 'Bolivianos (BOB)', tone: 'success' },
      ]}
    />
  );
}
