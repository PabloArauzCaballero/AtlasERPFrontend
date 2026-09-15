'use client';
import { StructuredActionForm } from '@/components/screens/StructuredActionForm';
import { adsService } from '@/services/adsService';
export default function CreateAdvertiserPage() {
  return <StructuredActionForm moduleLabel="Ads" title="Nuevo anunciante" description="Registre identidad fiscal, contacto, modalidad de facturación y límite de crédito del anunciante." submitLabel="Crear anunciante" submitIcon="add_business" onSubmit={adsService.createAdvertiser} sections={[
    { title: 'Identidad del anunciante', icon: 'business', fields: [
      { name: 'legalName', label: 'Razón social', tooltip: 'Nombre legal tal como figura en el NIT o en el registro de comercio; es el que va en facturas y contratos.', required: true, span: 2 }, { name: 'tradeName', label: 'Nombre comercial', tooltip: 'Nombre con el que el negocio se presenta al público, si es distinto del legal. Ej.: «Tienda Doña Rosa».', required: true },
      /*
       * Categoría, país, ciudad, modalidad y moneda salen de su dominio o catálogo: la categoría era
       * texto libre y el backend rechaza con 400 lo que no esté en `crm.merchantCategory`.
       */
      { name: 'taxId', label: 'NIT', tooltip: 'NIT (o CI si es persona natural) sin puntos ni guiones. Ej.: 1023456019. Se valida contra el padrón.', required: true }, { name: 'businessCategory', label: 'Categoría de negocio', tooltip: 'Rubro principal del negocio; agrupa la cartera y decide las reglas de comisión que le aplican.', optional: true, optionsSource: 'domain:crm.merchantCategory' },
      { name: 'country', label: 'País', tooltip: 'País donde opera y tributa el negocio; decide moneda, impuestos y formatos de documento.', required: true, defaultValue: 'BO', optionsSource: 'catalog:country' }, { name: 'city', label: 'Ciudad', tooltip: 'Ciudad de la sede principal; sirve para asignar ejecutivo y zona de cobertura.', optional: true, optionsSource: 'catalog:city' },
      { name: 'websiteUrl', label: 'Sitio web', tooltip: 'Dirección web pública del anunciante, con https://. Sirve para verificar la marca antes de aprobar creatividades.', type: 'url', optional: true, span: 2 },
    ] },
    { title: 'Facturación y contacto', icon: 'receipt_long', fields: [
      { name: 'primaryContactName', label: 'Contacto principal', tooltip: 'Persona a la que se llama ante cualquier incidencia comercial o de facturación.', optional: true }, { name: 'primaryContactEmail', label: 'Correo', tooltip: 'Correo del contacto principal; ahí llegan las notificaciones de campaña y facturación.', type: 'email', optional: true },
      // Obligatorios para que el select no ofrezca «Sin definir»: un texto vacío no es el defecto del backend, es un 400.
      { name: 'billingMode', label: 'Modalidad', tooltip: 'Cómo paga el anunciante: prepago descuenta de un saldo cargado; crédito factura a fin de período.', required: true, defaultValue: 'POSTPAID', optionsSource: 'domain:ads.billingMode' },
      { name: 'currency', label: 'Moneda', tooltip: 'Moneda en la que se factura y se consume el crédito (ISO 4217). Ej.: BOB.', required: true, defaultValue: 'BOB', optionsSource: 'catalog:currency' }, { name: 'creditLimitMicros', label: 'Límite de crédito (micros)', tooltip: 'Crédito máximo en micros que puede consumir antes de pagar. Ej.: 1000000000 = Bs 1 000.', type: 'number', valueKind: 'number', defaultValue: 0 },
    ] },
  ]} warning="El límite se expresa en micros. BOB 1,00 equivale a 1.000.000 micros." />;
}
