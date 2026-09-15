'use client';
import { StructuredActionForm } from '@/components/screens/StructuredActionForm';
import { accountingService } from '@/services/accountingService';
export default function CreateBusinessPartnerPage() {
  return <StructuredActionForm moduleLabel="Contabilidad" title="Crear business partner" description="Inicialice una contraparte financiera con identidad legal y estado KYB controlado." submitLabel="Inicializar partner" submitIcon="person_add" onSubmit={accountingService.createBusinessPartner} sections={[
    { title: 'Partner Master Data', icon: 'handshake', fields: [
      // El código lo asigna el backend al guardar (BP-AAAA-NNNNNN).
      { name: 'partnerNo', label: 'Código de partner', tooltip: 'Código corto del socio en el ERP; lo asigna el sistema al guardar y aparece en documentos.', assignedByBackend: true }, { name: 'partnerType', label: 'Tipo', tooltip: 'Qué es el socio para nosotros: cliente, proveedor, ambos u otro; decide qué cuentas contables usa.', required: true, defaultValue: 'COMPANY', optionsSource: 'domain:accounting.partnerType' },
      { name: 'legalName', label: 'Razón social / nombre legal', tooltip: 'Nombre legal tal como figura en el NIT o en el registro de comercio; es el que va en facturas y contratos.', required: true, span: 2 }, { name: 'tradeName', label: 'Nombre comercial', tooltip: 'Nombre con el que el negocio se presenta al público, si es distinto del legal. Ej.: «Tienda Doña Rosa».', optional: true },
      { name: 'taxId', label: 'NIT / documento', tooltip: 'NIT (o CI si es persona natural) sin puntos ni guiones. Ej.: 1023456019. Se valida contra el padrón.', optional: true }, { name: 'countryCode', label: 'País', tooltip: 'País de residencia fiscal del socio; decide qué documento tributario se le exige.', required: true, defaultValue: 'BO', optionsSource: 'catalog:country' },
      { name: 'kybStatus', label: 'Estado KYB', tooltip: 'Estado de la verificación de la empresa (KYB); sólo un socio verificado puede operar y cobrar.', required: true, defaultValue: 'PENDING', optionsSource: 'domain:accounting.kybStatus' },
    ] },
  ]} />;
}
