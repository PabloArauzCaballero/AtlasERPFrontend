'use client';
import { StructuredActionForm } from '@/components/screens/StructuredActionForm';
import { adsService } from '@/services/adsService';
export default function CreateAdvertiserPage() {
  return <StructuredActionForm moduleLabel="Ads" title="Nuevo anunciante" description="Registre identidad fiscal, contacto, modalidad de facturación y límite de crédito del anunciante." submitLabel="Crear anunciante" submitIcon="add_business" onSubmit={adsService.createAdvertiser} sections={[
    { title: 'Identidad del anunciante', icon: 'business', fields: [
      { name: 'legalName', label: 'Razón social', required: true, span: 2 }, { name: 'tradeName', label: 'Nombre comercial', required: true },
      /*
       * Categoría, país, ciudad, modalidad y moneda salen de su dominio o catálogo: la categoría era
       * texto libre y el backend rechaza con 400 lo que no esté en `crm.merchantCategory`.
       */
      { name: 'taxId', label: 'NIT', required: true }, { name: 'businessCategory', label: 'Categoría de negocio', optional: true, optionsSource: 'domain:crm.merchantCategory' },
      { name: 'country', label: 'País', required: true, defaultValue: 'BO', optionsSource: 'catalog:country' }, { name: 'city', label: 'Ciudad', optional: true, optionsSource: 'catalog:city' },
      { name: 'websiteUrl', label: 'Sitio web', type: 'url', optional: true, span: 2 },
    ] },
    { title: 'Facturación y contacto', icon: 'receipt_long', fields: [
      { name: 'primaryContactName', label: 'Contacto principal', optional: true }, { name: 'primaryContactEmail', label: 'Correo', type: 'email', optional: true },
      // Obligatorios para que el select no ofrezca «Sin definir»: un texto vacío no es el defecto del backend, es un 400.
      { name: 'billingMode', label: 'Modalidad', required: true, defaultValue: 'POSTPAID', optionsSource: 'domain:ads.billingMode' },
      { name: 'currency', label: 'Moneda', required: true, defaultValue: 'BOB', optionsSource: 'catalog:currency' }, { name: 'creditLimitMicros', label: 'Límite de crédito (micros)', type: 'number', valueKind: 'number', defaultValue: 0 },
    ] },
  ]} warning="El límite se expresa en micros. BOB 1,00 equivale a 1.000.000 micros." />;
}
