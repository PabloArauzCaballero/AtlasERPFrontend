'use client';
import { AccountingDocumentScreen } from '@/components/screens/AccountingDocumentScreen';
import { CrudTable } from '@/components/ui/CrudTable';
import { accountingService } from '@/services/accountingService';

export default function AccountingDocumentsPage() {
  return (
    <div className="space-y-6">
      <AccountingDocumentScreen />
      <CrudTable
        title="Documentos contables"
        description="Historial de documentos contables registrados (solo lectura; los asientos son inmutables)."
        columns={['documentNo', 'documentType', 'documentDate', 'postingDate', 'currencyCode', 'status']}
        list={accountingService.listDocuments}
      />
    </div>
  );
}
