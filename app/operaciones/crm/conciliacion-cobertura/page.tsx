'use client';
import { MultiActionWorkspace } from '@/components/screens/MultiActionWorkspace';
import { b2bService } from '@/services/b2bService';
import type { JsonObject } from '@/services/types';
export default function CoverageReconciliationPage() {
  async function markPaid(payload: JsonObject) { const id = String(payload.payableId ?? ''); const { payableId: _id, ...body } = payload; return b2bService.markPayablePaid(id, body); }
  async function recovery(payload: JsonObject) { const id = String(payload.recoveryId ?? ''); const { recoveryId: _id, ...body } = payload; return b2bService.applyRecoveryPayment(id, body); }
  return <MultiActionWorkspace moduleLabel="CRM" title="Cobertura y Conciliación" description="Programe coberturas, confirme pagos, aplique recuperaciones y ejecute conciliaciones por período." actions={[
    { id: 'coverage', title: 'Programación de Cobertura', description: 'Genera payable por incumplimiento de una cuota.', icon: 'shield', submitLabel: 'Programar cobertura', onSubmit: b2bService.createPayable, fields: [{ name: 'installmentId', label: 'UUID cuota', required: true, span: 2 }, { name: 'scheduledPaymentDate', label: 'Fecha programada', type: 'date', required: true }, { name: 'reason', label: 'Motivo', defaultValue: 'CUSTOMER_INSTALLMENT_DEFAULT_COVERAGE' }] },
    { id: 'paid', title: 'Confirmar Pago', description: 'Marca una cobertura payable como pagada.', icon: 'paid', submitLabel: 'Marcar pagado', onSubmit: markPaid, fields: [{ name: 'payableId', label: 'UUID payable', required: true, span: 2 }, { name: 'paidAt', label: 'Fecha/hora pago', required: true, span: 2 }] },
    { id: 'recovery', title: 'Aplicar Recuperación', description: 'Aplica pago del consumidor a una recuperación.', icon: 'currency_exchange', submitLabel: 'Aplicar pago', onSubmit: recovery, fields: [{ name: 'recoveryId', label: 'UUID recuperación', required: true, span: 2 }, { name: 'amount', label: 'Monto', type: 'number', valueKind: 'number', required: true, span: 2 }] },
    { id: 'run', title: 'Reconciliation Logs', description: 'Ejecuta conciliación para un rango de fechas.', icon: 'sync_alt', submitLabel: 'Ejecutar conciliación', submitIcon: 'play_arrow', onSubmit: b2bService.createReconciliationRun, fields: [{ name: 'periodStart', label: 'Desde', type: 'date', required: true }, { name: 'periodEnd', label: 'Hasta', type: 'date', required: true }] },
  ]} />;
}
