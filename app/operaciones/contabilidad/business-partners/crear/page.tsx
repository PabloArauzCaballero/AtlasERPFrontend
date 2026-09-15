'use client';
import { StructuredActionForm } from '@/components/screens/StructuredActionForm';
import { accountingService } from '@/services/accountingService';
export default function CreateBusinessPartnerPage() {
  return <StructuredActionForm moduleLabel="Contabilidad" title="Crear business partner" description="Inicialice una contraparte financiera con identidad legal y estado KYB controlado." submitLabel="Inicializar partner" submitIcon="person_add" onSubmit={accountingService.createBusinessPartner} sections={[
    { title: 'Partner Master Data', icon: 'handshake', fields: [
      // El código lo asigna el backend al guardar (BP-AAAA-NNNNNN).
      { name: 'partnerNo', label: 'Código de partner', assignedByBackend: true }, { name: 'partnerType', label: 'Tipo', required: true, defaultValue: 'COMPANY', optionsSource: 'domain:accounting.partnerType' },
      { name: 'legalName', label: 'Razón social / nombre legal', required: true, span: 2 }, { name: 'tradeName', label: 'Nombre comercial', optional: true },
      { name: 'taxId', label: 'NIT / documento', optional: true }, { name: 'countryCode', label: 'País', required: true, defaultValue: 'BO', optionsSource: 'catalog:country' },
      { name: 'kybStatus', label: 'Estado KYB', required: true, defaultValue: 'PENDING', optionsSource: 'domain:accounting.kybStatus' },
    ] },
  ]} />;
}
