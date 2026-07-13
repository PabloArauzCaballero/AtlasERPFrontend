'use client';
import { StructuredActionForm } from '@/components/screens/StructuredActionForm';
import { accountingService } from '@/services/accountingService';
import { countryOptions, kybStatusOptions, partnerTypeOptions } from '@/lib/catalogs';
export default function CreateBusinessPartnerPage() {
  return <StructuredActionForm moduleLabel="Contabilidad" title="Create Business Partner" description="Inicialice una contraparte financiera con identidad legal y estado KYB controlado." submitLabel="Inicializar partner" submitIcon="person_add" onSubmit={accountingService.createBusinessPartner} sections={[
    { title: 'Partner Master Data', icon: 'handshake', fields: [
      { name: 'partnerNo', label: 'Código de partner', required: true }, { name: 'partnerType', label: 'Tipo', type: 'select', required: true, defaultValue: 'COMPANY', options: partnerTypeOptions },
      { name: 'legalName', label: 'Razón social / nombre legal', required: true, span: 2 }, { name: 'tradeName', label: 'Nombre comercial', optional: true },
      { name: 'taxId', label: 'NIT / documento', optional: true }, { name: 'countryCode', label: 'País', type: 'select', defaultValue: 'BO', options: countryOptions },
      { name: 'kybStatus', label: 'Estado KYB', type: 'select', defaultValue: 'PENDING', options: kybStatusOptions },
    ] },
  ]} />;
}
