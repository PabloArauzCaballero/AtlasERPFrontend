'use client';

import { ReceiptScreen } from '@/components/screens/ReceiptScreen';
import { CrudTable } from '@/components/ui/CrudTable';
import { accountingService } from '@/services/accountingService';
export default function ReceiptsPage() { return <div className="space-y-6"><ReceiptScreen /><CrudTable title="Recibos registrados" description="Cada fila representa un cobro recibido y aplicado." columns={['receiptNo','receiptDate','amount','currencyCode','status']} editable={['receiptNo','receiptDate','status']} list={accountingService.listReceipts} update={accountingService.updateReceipt} remove={accountingService.deleteReceipt} /></div>; }
