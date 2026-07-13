'use client';

import { BulkImportScreen } from '@/components/screens/BulkImportScreen';
import { accountingService } from '@/services/accountingService';

const headers = ['legalEntityId','sourceSystem','sourceType','sourceId','documentType','documentNo','documentDate','postingDate','accountingPeriodId','ledgerId','currencyCode','debitGlAccountId','creditGlAccountId','amount','description'];

export default function BulkAccountingDocumentsPage() {
  return (
    <BulkImportScreen
      moduleLabel="Contabilidad"
      title="Bulk Documentos Contables"
      description="Prepare documentos balanceados de dos líneas y publíquelos como un batch transaccional de hasta 50 registros."
      templateName="atlas-accounting-documents-template.csv"
      headers={headers}
      requiredHeaders={['legalEntityId','sourceSystem','sourceType','sourceId','documentType','documentNo','documentDate','postingDate','accountingPeriodId','ledgerId','debitGlAccountId','creditGlAccountId','amount']}
      maxRows={50}
      submit={accountingService.bulkCreateDocuments}
      transformRow={(row) => {
        const amount = Number(row.amount);
        if (!Number.isFinite(amount) || amount <= 0) throw new Error('Monto inválido');
        return {
          legalEntityId: row.legalEntityId, sourceSystem: row.sourceSystem, sourceType: row.sourceType,
          sourceId: row.sourceId, documentType: row.documentType, documentNo: row.documentNo,
          documentDate: row.documentDate, postingDate: row.postingDate, accountingPeriodId: row.accountingPeriodId,
          ledgerId: row.ledgerId, currencyCode: row.currencyCode || 'BOB', approvalStatus: 'NOT_REQUIRED',
          lines: [
            { glAccountId: row.debitGlAccountId, debit: amount, credit: 0, currencyCode: row.currencyCode || 'BOB', amountLc: amount, description: row.description || undefined },
            { glAccountId: row.creditGlAccountId, debit: 0, credit: amount, currencyCode: row.currencyCode || 'BOB', amountLc: amount, description: row.description || undefined },
          ],
        };
      }}
    />
  );
}
