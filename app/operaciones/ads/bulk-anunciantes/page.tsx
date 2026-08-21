'use client';

import { BulkImportScreen } from '@/components/screens/BulkImportScreen';
import { adsService } from '@/services/adsService';

const headers = ['legalName','tradeName','taxId','businessCategory','country','city','websiteUrl','primaryContactName','primaryContactEmail','billingMode','currency','creditLimitMicros'];

export default function BulkAdvertisersPage() {
  return (
    <BulkImportScreen
      moduleLabel="Ads"
      title="Carga masiva de anunciantes"
      description="Importe anunciantes con control de duplicados por país y NIT, validación de contacto y límites de crédito en micros."
      templateName="atlas-ads-advertisers-template.csv"
      headers={headers}
      requiredHeaders={['legalName','tradeName','taxId']}
      maxRows={100}
      submit={adsService.bulkCreateAdvertisers}
      transformRow={(row) => ({
        legalName: row.legalName, tradeName: row.tradeName, taxId: row.taxId,
        businessCategory: row.businessCategory || undefined, country: row.country || 'BO', city: row.city || undefined,
        websiteUrl: row.websiteUrl || undefined, primaryContactName: row.primaryContactName || undefined,
        primaryContactEmail: row.primaryContactEmail || undefined, billingMode: row.billingMode || 'POSTPAID',
        currency: row.currency || 'BOB', creditLimitMicros: row.creditLimitMicros ? Number(row.creditLimitMicros) : 0,
      })}
    />
  );
}
