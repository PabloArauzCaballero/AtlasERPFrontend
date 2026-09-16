'use client';

import { useCallback, useMemo, useState } from 'react';
import { domainLoader } from '@/services/domains';
import { accountingService } from '@/services/accountingService';
import { AtlasButton } from '@/components/atlas/AtlasButton';
import { FormField } from '@/components/atlas/FormField';
import { Icon } from '@/components/atlas/Icon';
import { OptionSelect } from '@/components/atlas/OptionSelect';
import { InlineNotice } from '@/components/atlas/InlineNotice';
import { Panel } from '@/components/atlas/Panel';
import { StatusPill } from '@/components/atlas/StatusPill';
import { WorkspaceHeader } from '@/components/atlas/WorkspaceHeader';
import { BotonFormularioPapel } from '@/components/atlas/BotonFormularioPapel';
import { formularioRecibo } from '@/lib/formulariosPapel/operaciones';
import { useAtlasMutation } from '@/hooks/useAtlasMutation';
import { useOptions } from '@/hooks/useOptions';
import { loadAccountingPeriods, loadArInvoices, loadBankAccounts, loadBusinessPartners, loadGlAccounts, loadLedgers, loadLegalEntities } from '@/services/optionLoaders';
import { formatBob } from '@/lib/formatters';
import type { JsonObject } from '@/services/types';
import { newUuid } from '@/lib/uuid';

interface Allocation { id: string; arInvoiceId: string; allocatedAmount: string }
const createAllocation = (id: string): Allocation => ({ id, arInvoiceId: '', allocatedAmount: '' });

interface ReceiptScreenProps {
  /** Se llama tras contabilizar: la página vuelve al listado. */
  onDone?: (() => void | Promise<void>) | undefined;
}

export function ReceiptScreen({ onDone }: ReceiptScreenProps = {}) {
  const [allocations, setAllocations] = useState<Allocation[]>([createAllocation('allocation-0')]);
  const legalEntities = useOptions(loadLegalEntities);
  const partners = useOptions(loadBusinessPartners);
  const glAccounts = useOptions(loadGlAccounts);
  const periods = useOptions(loadAccountingPeriods);
  const ledgers = useOptions(loadLedgers);
  const bankAccounts = useOptions(loadBankAccounts);
  const arInvoices = useOptions(loadArInvoices);
  const monedas = useOptions(domainLoader('catalog:currency'));
  const mutation = useAtlasMutation(useCallback((payload: JsonObject) => accountingService.createReceipt(payload), []));
  const totalAllocated = useMemo(() => allocations.reduce((sum, item) => sum + Number(item.allocatedAmount || 0), 0), [allocations]);
  function update(id: string, key: keyof Allocation, value: string) { setAllocations((current) => current.map((item) => item.id === id ? { ...item, [key]: value } : item)); }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const payload: JsonObject = { legalEntityId: String(form.get('legalEntityId') ?? ''), payerBpId: String(form.get('payerBpId') ?? ''), receiptDate: String(form.get('receiptDate') ?? ''), amount: Number(form.get('amount') ?? 0), currencyCode: String(form.get('currencyCode') ?? 'BOB'), bankAccountId: String(form.get('bankAccountId') ?? '') || undefined, bankGlAccountId: String(form.get('bankGlAccountId') ?? ''), arControlGlAccountId: String(form.get('arControlGlAccountId') ?? ''), accountingPeriodId: String(form.get('accountingPeriodId') ?? ''), ledgerId: String(form.get('ledgerId') ?? ''), allocations: allocations.map(({ arInvoiceId, allocatedAmount }) => ({ arInvoiceId, allocatedAmount: Number(allocatedAmount) })) };
    try { await mutation.execute(payload); await onDone?.(); } catch { /* controlled */ }
  }
  const acciones = <><BotonFormularioPapel data-testid="papel-recibo" formulario={formularioRecibo} /><AtlasButton variant="secondary" type="reset">Cancelar</AtlasButton><AtlasButton type="submit" icon="check_circle" loading={mutation.isLoading}>Contabilizar recibo</AtlasButton></>;
  return <form className="space-y-5" onSubmit={submit}><WorkspaceHeader breadcrumbs={[{ label: 'Contabilidad' }, { label: 'Recibos', href: '/operaciones/contabilidad/recibos' }, { label: 'Registrar recibo' }]} title="Registrar recibo contable" description="Registre el ingreso de fondos y aplíquelo a facturas AR abiertas con cuadre obligatorio." actions={acciones} />{mutation.error ? <InlineNotice tone="danger">{mutation.error}</InlineNotice> : null}{mutation.status === 'success' ? <InlineNotice tone="success">Recibo registrado y aplicado correctamente.</InlineNotice> : null}<div className="grid items-start gap-4 grid-cols-[minmax(0,1fr)] xl:grid-cols-[minmax(0,1fr)_310px]"><div className="space-y-4"><Panel title="Detalles del documento" icon="receipt_long"><div className="grid gap-3 grid-cols-1 md:grid-cols-2 xl:grid-cols-4"><FormField tooltip="Empresa del grupo que emite o recibe el documento; decide libro, moneda y numeración." kind="select" label="Entidad legal" name="legalEntityId" required className="xl:col-span-2" options={legalEntities} /><FormField tooltip="Socio que paga el recibo." kind="select" label="Pagador (Business Partner)" name="payerBpId" required className="xl:col-span-2" options={partners} /><FormField tooltip="Fecha en que se recibió el dinero." label="Fecha recibo" name="receiptDate" type="date" required /><FormField tooltip="Importe recibido, con hasta dos decimales." label="Monto" name="amount" type="number" required /><FormField tooltip="Moneda del documento (ISO 4217). Ej.: BOB." key={`currencyCode:${monedas.length}`} kind="select" label="Moneda" name="currencyCode" defaultValue="BOB" required options={monedas} /><FormField tooltip="Cuenta bancaria donde entró el dinero." kind="select" label="Cuenta bancaria" name="bankAccountId" options={[{ label: '— Ninguna —', value: '' }, ...bankAccounts]} /><FormField tooltip="Cuenta contable del banco que recibe." kind="select" label="Cuenta GL banco" name="bankGlAccountId" required options={glAccounts} /><FormField tooltip="Cuenta de control de cuentas por cobrar que se descarga." kind="select" label="Cuenta GL control AR" name="arControlGlAccountId" required options={glAccounts} /><FormField tooltip="Período abierto en el que se registra; uno cerrado rechaza el asiento." kind="select" label="Período contable" name="accountingPeriodId" required options={periods} /><FormField tooltip="Libro contable en el que se registra." kind="select" label="Ledger" name="ledgerId" required options={ledgers} /></div></Panel><Panel title="Asignación de Facturas (AR)" icon="account_tree" action={<AtlasButton variant="secondary" icon="add" onClick={() => setAllocations((current) => [...current, createAllocation(newUuid())])}>Agregar factura</AtlasButton>}><div className="space-y-2">{allocations.map((allocation) => <div key={allocation.id} className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 grid-cols-1 md:grid-cols-[minmax(0,1fr)_180px_36px]"><OptionSelect name={`arInvoiceId-${allocation.id}`} ariaLabel="Factura AR a la que se aplica" compact value={allocation.arInvoiceId} required onChange={(value) => update(allocation.id, 'arInvoiceId', value)} placeholder="— Factura AR —" options={arInvoices} /><input className="h-9 rounded border border-slate-300 bg-white px-3 text-right text-xs" type="number" min="0.01" step="0.01" placeholder="Monto aplicado" value={allocation.allocatedAmount} required onChange={(event) => update(allocation.id, 'allocatedAmount', event.target.value)} /><button type="button" disabled={allocations.length === 1} className="grid h-9 place-items-center text-red-600 disabled:opacity-30" onClick={() => setAllocations((current) => current.filter((item) => item.id !== allocation.id))}><Icon name="delete" className="text-[18px]" /></button></div>)}</div></Panel></div><aside className="space-y-4 xl:sticky xl:top-20"><Panel title="Conciliación" icon="balance"><div className="rounded-md bg-slate-50 p-4"><p className="text-[10px] font-bold uppercase text-slate-500">Total asignado</p><p className="mt-1 text-2xl font-bold">{formatBob(totalAllocated)}</p></div><div className="mt-3 flex justify-between text-xs"><span className="text-slate-500">Facturas aplicadas</span><b>{allocations.length}</b></div><div className="mt-3"><StatusPill tone="warning">Pendiente de cuadre</StatusPill></div></Panel><InlineNotice tone="info">La suma de asignaciones debe coincidir exactamente con el monto total del recibo.</InlineNotice></aside></div></form>;
}
