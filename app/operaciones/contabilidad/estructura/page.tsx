'use client';

import { StructuredActionForm } from '@/components/screens/StructuredActionForm';
import { accountingService } from '@/services/accountingService';
import { countryOptions, currencyOptions, timezoneOptions } from '@/lib/catalogs';

export default function FinancialStructurePage() {
  return (
    <StructuredActionForm
      moduleLabel="Contabilidad"
      title="Crear entidad legal"
      description="Configure la entidad jurídica que encabezará libros, períodos, impuestos y documentos contables."
      submitLabel="Guardar entidad"
      submitIcon="save"
      onSubmit={accountingService.createLegalEntity}
      sections={[
        {
          title: 'Identificación institucional', icon: 'corporate_fare', description: 'Datos legales y tributarios de la entidad.', fields: [
            { name: 'code', label: 'Código interno', required: true, placeholder: 'ATLAS-BO' },
            { name: 'legalName', label: 'Razón social', required: true, placeholder: 'Razón social registrada', span: 2 },
            { name: 'taxId', label: 'NIT', optional: true, placeholder: 'NIT oficial' },
            { name: 'countryCode', label: 'País', type: 'select', required: true, defaultValue: 'BO', options: countryOptions },
            { name: 'baseCurrency', label: 'Moneda base', type: 'select', required: true, defaultValue: 'BOB', options: currencyOptions },
          ],
        },
        {
          title: 'Parámetros operativos', icon: 'settings', description: 'Zona horaria y controles iniciales de la entidad.', fields: [
            { name: 'timezone', label: 'Zona horaria', type: 'select', required: true, defaultValue: 'America/La_Paz', options: timezoneOptions, span: 2 },
          ],
        },
      ]}
      summaryItems={[
        { label: 'Jurisdicción', value: 'Bolivia', tone: 'success' },
        { label: 'Moneda funcional', value: 'BOB', tone: 'success' },
        { label: 'Estado maestro', value: 'ACTIVO', tone: 'warning' },
      ]}
      warning="Utilice únicamente datos legales verificados. La entidad será referenciada por libros, sucursales y documentos posteriores."
    />
  );
}
