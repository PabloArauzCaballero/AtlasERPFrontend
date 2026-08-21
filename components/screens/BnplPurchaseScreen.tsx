'use client';

import { useCallback, useMemo, useState } from 'react';
import { AtlasButton } from '@/components/atlas/AtlasButton';
import { FormField } from '@/components/atlas/FormField';
import { Icon } from '@/components/atlas/Icon';
import { InlineNotice } from '@/components/atlas/InlineNotice';
import { Panel } from '@/components/atlas/Panel';
import { StatusPill } from '@/components/atlas/StatusPill';
import { WorkspaceHeader } from '@/components/atlas/WorkspaceHeader';
import { useAtlasMutation } from '@/hooks/useAtlasMutation';
import { formatBob } from '@/lib/formatters';
import { b2bService } from '@/services/b2bService';
import type { JsonObject } from '@/services/types';

interface InstallmentDraft { id: string; dueDate: string; amount: string }
const initialInstallments: InstallmentDraft[] = [0, 1, 2, 3].map((index) => ({ id: `installment-${index}`, dueDate: '', amount: '' }));
const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function BnplPurchaseScreen() {
  const [purchaseAmount, setPurchaseAmount] = useState('');
  const [installments, setInstallments] = useState(initialInstallments);
  const mutation = useAtlasMutation(useCallback((body: JsonObject) => b2bService.registerPurchase(body), []));
  const amounts = useMemo(() => { const purchase = Number(purchaseAmount || 0); return { purchase, down: roundMoney(purchase * .6), financed: roundMoney(purchase * .4) }; }, [purchaseAmount]);
  const scheduleTotal = useMemo(() => roundMoney(installments.reduce((sum, item) => sum + Number(item.amount || 0), 0)), [installments]);
  const balanced = amounts.financed > 0 && Math.abs(scheduleTotal - amounts.financed) <= .01;

  function distributeFinanced() {
    const base = roundMoney(amounts.financed / installments.length);
    let assigned = 0;
    setInstallments((current) => current.map((item, index) => { const amount = index === current.length - 1 ? roundMoney(amounts.financed - assigned) : base; assigned = roundMoney(assigned + amount); return { ...item, amount: amount.toFixed(2) }; }));
  }

  function updateInstallment(id: string, key: 'dueDate' | 'amount', value: string) { setInstallments((current) => current.map((item) => item.id === id ? { ...item, [key]: value } : item)); }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const payload: JsonObject = { merchantAccountId: String(form.get('merchantAccountId') ?? ''), branchId: String(form.get('branchId') ?? ''), consumerId: String(form.get('consumerId') ?? ''), consumerExternalRef: String(form.get('consumerExternalRef') ?? '') || undefined, purchaseAmount: amounts.purchase, downPaymentAmount: amounts.down, downPaymentPaidAt: String(form.get('downPaymentPaidAt') ?? '') || undefined, downPaymentEvidenceRef: String(form.get('downPaymentEvidenceRef') ?? '') || undefined, financedAmount: amounts.financed, riskTierAtOrigination: String(form.get('riskTierAtOrigination') ?? '') || undefined, cohortId: String(form.get('cohortId') ?? '') || undefined, productCategory: String(form.get('productCategory') ?? '') || undefined, mdrReceivableDueDate: String(form.get('mdrReceivableDueDate') ?? ''), installments: installments.map((item, index) => ({ installmentNumber: index + 1, dueDate: item.dueDate, amount: Number(item.amount) })) };
    try { await mutation.execute(payload); } catch { /* shown inline */ }
  }

  return (
    <form className="space-y-5" onSubmit={submit}>
      <WorkspaceHeader breadcrumbs={[{ label: 'Portal comercio' }, { label: 'Transacciones' }]} title="Registro BNPL" description="Ingrese una compra Buy Now Pay Later con cálculo automático 60/40 y calendario de cuotas verificable." actions={<><AtlasButton variant="secondary" type="reset">Cancelar</AtlasButton><AtlasButton type="submit" icon="point_of_sale" disabled={!balanced} loading={mutation.isLoading}>Registrar compra</AtlasButton></>} />
      {mutation.error ? <InlineNotice tone="danger">{mutation.error}</InlineNotice> : null}{mutation.status === 'success' ? <InlineNotice tone="success" title="Transacción registrada">La compra, pago inicial, financiamiento y cuotas fueron persistidos por el backend.</InlineNotice> : null}
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
        <div className="space-y-4"><Panel title="Merchant & Consumer" icon="storefront"><div className="grid gap-3 md:grid-cols-2"><FormField label="UUID cuenta merchant" name="merchantAccountId" required /><FormField label="UUID sucursal" name="branchId" required /><FormField label="UUID consumidor" name="consumerId" required /><FormField label="Referencia externa consumidor" name="consumerExternalRef" /></div></Panel>
          <Panel title="Purchase Details" icon="shopping_cart_checkout"><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"><FormField label="Monto de compra (BOB)" name="purchaseAmount" type="number" min="0.01" step="0.01" required value={purchaseAmount} onChange={(event) => setPurchaseAmount(event.target.value)} /><FormField label="Pago inicial 60%" name="downPaymentAmount" value={amounts.down.toFixed(2)} readOnly /><FormField label="Financiado 40%" name="financedAmount" value={amounts.financed.toFixed(2)} readOnly /><FormField label="Vencimiento CxC MDR" name="mdrReceivableDueDate" type="date" required /><FormField label="Fecha/hora pago inicial" name="downPaymentPaidAt" placeholder="2026-07-10T15:00:00-04:00" /><FormField label="Evidencia pago inicial" name="downPaymentEvidenceRef" /><FormField label="Tier de riesgo" name="riskTierAtOrigination" /><FormField label="Cohorte" name="cohortId" /><FormField label="Categoría producto" name="productCategory" className="md:col-span-2" /></div></Panel>
          <Panel title="Payment Schedule" description="La suma debe coincidir exactamente con el 40% financiado." icon="calendar_month" action={<div className="flex gap-2"><AtlasButton type="button" variant="secondary" icon="functions" onClick={distributeFinanced}>Distribuir 40%</AtlasButton><AtlasButton type="button" variant="secondary" icon="add" onClick={() => setInstallments((current) => [...current, { id: crypto.randomUUID(), dueDate: '', amount: '' }])}>Cuota</AtlasButton></div>}><div className="space-y-2">{installments.map((item, index) => <div key={item.id} className="grid items-end gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 md:grid-cols-[70px_1fr_180px_36px]"><div><p className="text-[10px] font-bold uppercase text-slate-400">Cuota</p><p className="mt-2 text-lg font-extrabold">{index + 1}</p></div><FormField label="Fecha de vencimiento" name={`dueDate-${index}`} type="date" required value={item.dueDate} onChange={(event) => updateInstallment(item.id, 'dueDate', event.target.value)} /><FormField label="Monto BOB" name={`amount-${index}`} type="number" min="0.01" step="0.01" required value={item.amount} onChange={(event) => updateInstallment(item.id, 'amount', event.target.value)} /><button type="button" aria-label="Eliminar cuota" disabled={installments.length === 1} className="mb-0.5 grid h-9 place-items-center rounded text-red-600 hover:bg-red-50 disabled:opacity-30" onClick={() => setInstallments((current) => current.filter((entry) => entry.id !== item.id))}><Icon name="delete" className="text-[18px]" /></button></div>)}</div></Panel></div>
        <aside className="space-y-4 xl:sticky xl:top-20"><Panel title="Transaction Summary" icon="receipt_long"><Summary label="Compra" value={formatBob(amounts.purchase)} /><Summary label="Pago hoy (60%)" value={formatBob(amounts.down)} strong /><Summary label="Financiado (40%)" value={formatBob(amounts.financed)} /><div className="my-4 border-t border-slate-200" /><Summary label="Cuotas programadas" value={String(installments.length)} /><Summary label="Suma calendario" value={formatBob(scheduleTotal)} /><div className="mt-4"><StatusPill tone={balanced ? 'success' : 'danger'}>{balanced ? 'CALENDARIO CUADRADO' : 'REVISAR MONTOS'}</StatusPill></div></Panel><InlineNotice tone="info" title="Validación backend">El backend volverá a validar el 60%, el 40%, números de cuota únicos y suma exacta del calendario.</InlineNotice></aside>
      </div>
    </form>
  );
}
function Summary({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) { return <div className="flex items-center justify-between py-2 text-xs"><span className="text-slate-500">{label}</span><span className={strong ? 'text-base font-extrabold text-[#006a61]' : 'font-bold'}>{value}</span></div>; }
