'use client';
import { StructuredActionForm } from '@/components/screens/StructuredActionForm';
import { adsService } from '@/services/adsService';
export default function CreateAdvertiserPage() {
  return <StructuredActionForm moduleLabel="Ads" title="Nuevo anunciante" description="Registre identidad fiscal, contacto, modalidad de facturación y límite de crédito del anunciante." submitLabel="Crear anunciante" submitIcon="add_business" onSubmit={adsService.createAdvertiser} sections={[
    { title: 'Advertiser Identity', icon: 'business', fields: [
      { name: 'legalName', label: 'Razón social', required: true, span: 2 }, { name: 'tradeName', label: 'Nombre comercial', required: true },
      { name: 'taxId', label: 'NIT', required: true }, { name: 'businessCategory', label: 'Categoría de negocio', optional: true },
      { name: 'country', label: 'País', required: true, defaultValue: 'BO' }, { name: 'city', label: 'Ciudad', optional: true },
      { name: 'websiteUrl', label: 'Sitio web', type: 'url', optional: true, span: 2 },
    ] },
    { title: 'Billing & Contact', icon: 'receipt_long', fields: [
      { name: 'primaryContactName', label: 'Contacto principal', optional: true }, { name: 'primaryContactEmail', label: 'Correo', type: 'email', optional: true },
      { name: 'billingMode', label: 'Modalidad', type: 'select', defaultValue: 'POSTPAID', options: [{ label: 'Postpago', value: 'POSTPAID' }, { label: 'Prepago', value: 'PREPAID' }] },
      { name: 'currency', label: 'Moneda', defaultValue: 'BOB' }, { name: 'creditLimitMicros', label: 'Límite de crédito (micros)', type: 'number', valueKind: 'number', defaultValue: 0 },
    ] },
  ]} warning="El límite se expresa en micros. BOB 1,00 equivale a 1.000.000 micros." />;
}
