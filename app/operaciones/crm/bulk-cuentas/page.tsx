'use client';

import { BulkImportScreen } from '@/components/screens/BulkImportScreen';
import { b2bService } from '@/services/b2bService';

const headers = ['legalName','tradeName','taxId','accountType','industry','category','businessLine','businessDescription','tags','websiteUrl','countryCode','city','address','employeeCount','foundedYear','annualRevenue','expectedMonthlyVolume','contactFullName','contactEmail','contactPhone'];

export default function BulkAccountsPage() {
  return (
    <BulkImportScreen
      moduleLabel="CRM"
      title="Carga masiva de cuentas B2B"
      description="Carga masiva de cuentas con staging, vista previa y validación previa a la operación transaccional."
      templateName="atlas-cuentas-b2b-template.csv"
      headers={headers}
      requiredHeaders={['legalName','tradeName','accountType','category','businessLine','contactFullName']}
      maxRows={100}
      submit={b2bService.bulkCreateAccounts}
      transformRow={(row) => ({
        legalName: row.legalName, tradeName: row.tradeName, taxId: row.taxId || undefined,
        accountType: row.accountType || 'MERCHANT', industry: row.industry || undefined,
        category: row.category, businessLine: row.businessLine,
        businessDescription: row.businessDescription || undefined,
        tags: row.tags ? row.tags.split('|').map((tag) => tag.trim()).filter(Boolean) : [],
        websiteUrl: row.websiteUrl || undefined, countryCode: row.countryCode || 'BO',
        city: row.city || undefined, address: row.address || undefined,
        employeeCount: row.employeeCount ? Number(row.employeeCount) : undefined,
        foundedYear: row.foundedYear ? Number(row.foundedYear) : undefined,
        annualRevenue: row.annualRevenue ? Number(row.annualRevenue) : undefined,
        expectedMonthlyVolume: row.expectedMonthlyVolume ? Number(row.expectedMonthlyVolume) : undefined,
        primaryContact: { fullName: row.contactFullName, email: row.contactEmail || undefined, phone: row.contactPhone || undefined },
      })}
    />
  );
}
