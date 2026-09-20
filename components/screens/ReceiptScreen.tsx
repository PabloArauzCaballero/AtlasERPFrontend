'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { useAtlasMutation } from '@/hooks/useAtlasMutation';
import { useOptions } from '@/hooks/useOptions';
import { loadBankAccounts, loadBusinessPartners, loadLegalEntities } from '@/services/optionLoaders';
import { formatBob } from '@/lib/formatters';
import type { JsonObject, ResourceRow } from '@/services/types';
import { newUuid } from '@/lib/uuid';

interface Allocation { id: string; arInvoiceId: string; allocatedAmount: string }
const createAllocation = (id: string): Allocation => ({ id, arInvoiceId: '', allocatedAmount: '' });

/** Las facturas a las que se puede aplicar un cobro: emitidas o cobradas a medias. */
const ABIERTAS = ['ISSUED', 'PARTIALLY_PAID'];

interface ReceiptScreenProps {
  /** Se llama tras contabilizar: la página vuelve al listado. */
  onDone?: (() => void | Promise<void>) | undefined;
}

/**
 * Registrar un cobro.
 *
 * Pedía DIEZ datos, cuatro de ellos identificadores contables —cuenta GL del banco, cuenta GL de
 * control AR, período y libro— que no son una decisión de quien registra el cobro: salen de la
 * cuenta bancaria, de la ficha del pagador, de la fecha y de la empresa. Ahora los pone el backend
 * (`AccountingDefaultsService`) y aquí se piden seis, de los cuales uno es opcional.
 *
 * Las dos averías que tenía y que se arreglan aquí:
 *
 * 1. El panel de conciliación era decorado: decía «Pendiente de cuadre» SIEMPRE, con el recibo
 *    cuadrado o sin una sola asignación, y el botón dejaba enviar igual. El backend rechaza el
 *    descuadre con un 400 —`RECEIPT_ALLOCATION_TOTAL_MISMATCH`—, así que la pantalla prometía que
 *    algo iba a pasar y lo que pasaba era un error. Ahora la diferencia se calcula y el botón no
 *    se activa hasta que es cero.
 * 2. El desplegable de facturas ofrecía TODAS: pagadas, anuladas y de otros clientes. El backend
 *    las rechaza una por una con un 409 distinto cada vez. Ahora sólo salen las abiertas del
 *    pagador elegido, y al elegir una se propone su saldo.
 */
export function ReceiptScreen({ onDone }: ReceiptScreenProps = {}) {
  const [allocations, setAllocations] = useState<Allocation[]>([createAllocation('allocation-0')]);
  const [payerBpId, setPayerBpId] = useState('');
  const [amount, setAmount] = useState('');
  const legalEntities = useOptions(loadLegalEntities);
  const partners = useOptions(loadBusinessPartners);
  const bankAccounts = useOptions(loadBankAccounts);
  const monedas = useOptions(domainLoader('catalog:currency'));

  /*
   * Las facturas se leen enteras, no como pares etiqueta/valor.
   *
   * Hace falta el cliente para quedarse con las del pagador, el estado para descartar las cerradas
   * y el importe para proponer el saldo. `loadArInvoices` sólo daba «número — neto».
   */
  const [invoices, setInvoices] = useState<ResourceRow[]>([]);
  useEffect(() => {
    let vivo = true;
    void accountingService
      .listArInvoices()
      .then((data) => { if (vivo) setInvoices((data.items ?? data.rows ?? []) as ResourceRow[]); })
      .catch(() => { if (vivo) setInvoices([]); });
    return () => { vivo = false; };
  }, []);

  const facturasDelPagador = useMemo(
    () => invoices.filter((row) => ABIERTAS.includes(String(row.status ?? '')) && (!payerBpId || String(row.customerBpId ?? '') === payerBpId)),
    [invoices, payerBpId],
  );

  const opcionesFactura = useMemo(
    () => facturasDelPagador.map((row) => ({
      value: String(row.id ?? ''),
      label: `${String(row.invoiceNo ?? '')} — ${formatBob(Number(row.grossAmount ?? row.netAmount ?? 0))}`,
      description: String(row.status ?? '') === 'PARTIALLY_PAID'
        ? 'Cobrada a medias: escribe cuánto se aplica de lo que queda.'
        : `Vence el ${String(row.dueDate ?? '').slice(0, 10)}.`,
    })),
    [facturasDelPagador],
  );

  const mutation = useAtlasMutation(useCallback((payload: JsonObject) => accountingService.createReceipt(payload), []));

  const totalAllocated = useMemo(
    () => allocations.reduce((sum, item) => sum + Number(item.allocatedAmount || 0), 0),
    [allocations],
  );
  const montoRecibido = Number(amount || 0);
  const diferencia = Math.round((montoRecibido - totalAllocated) * 100) / 100;
  const cuadrado = montoRecibido > 0 && Math.abs(diferencia) < 0.005;

  function update(id: string, key: keyof Allocation, value: string) {
    setAllocations((current) => current.map((item) => (item.id === id ? { ...item, [key]: value } : item)));
  }

  /** Al elegir una factura emitida se propone su importe: es lo que se cobra en el 90 % de los casos. */
  function elegirFactura(id: string, arInvoiceId: string) {
    const factura = invoices.find((row) => String(row.id ?? '') === arInvoiceId);
    const propuesto = factura && String(factura.status ?? '') === 'ISSUED'
      ? String(Number(factura.grossAmount ?? factura.netAmount ?? 0))
      : '';
    setAllocations((current) => current.map((item) => (item.id === id ? { ...item, arInvoiceId, allocatedAmount: item.allocatedAmount || propuesto } : item)));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload: JsonObject = {
      legalEntityId: String(form.get('legalEntityId') ?? ''),
      payerBpId: String(form.get('payerBpId') ?? ''),
      receiptDate: String(form.get('receiptDate') ?? ''),
      amount: Number(form.get('amount') ?? 0),
      currencyCode: String(form.get('currencyCode') ?? 'BOB'),
      bankAccountId: String(form.get('bankAccountId') ?? '') || undefined,
      allocations: allocations.map(({ arInvoiceId, allocatedAmount }) => ({ arInvoiceId, allocatedAmount: Number(allocatedAmount) })),
    };
    try {
      await mutation.execute(payload);
      await onDone?.();
    } catch { /* el error se pinta arriba */ }
  }

  const acciones = (
    <>
      <AtlasButton variant="secondary" type="reset">Cancelar</AtlasButton>
      <AtlasButton type="submit" icon="check_circle" data-testid="recibo-contabilizar" disabled={!cuadrado} loading={mutation.isLoading}>Contabilizar recibo</AtlasButton>
    </>
  );

  return (
    <form className="space-y-5" onSubmit={submit}>
      <WorkspaceHeader
        breadcrumbs={[{ label: 'Contabilidad' }, { label: 'Recibos', href: '/operaciones/contabilidad/recibos' }, { label: 'Registrar recibo' }]}
        title="Registrar recibo"
        description="El dinero que entró y qué facturas cancela. La cuenta contable del banco, la del cliente, el período y el libro los pone el sistema."
        actions={acciones}
      />

      {mutation.error ? <InlineNotice tone="danger" title="No se pudo contabilizar el recibo">{mutation.error}</InlineNotice> : null}
      {mutation.status === 'success' ? <InlineNotice tone="success">Recibo registrado y aplicado correctamente.</InlineNotice> : null}

      <div className="grid items-start gap-4 grid-cols-[minmax(0,1fr)] xl:grid-cols-[minmax(0,1fr)_310px]">
        <div className="space-y-4">
          <Panel title="El cobro" icon="receipt_long">
            <div className="grid gap-3 grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
              <FormField tooltip="Empresa del grupo que recibe el dinero; de ella salen el libro contable y la numeración." kind="select" label="Empresa que cobra" name="legalEntityId" required className="xl:col-span-2" options={legalEntities} />
              <FormField tooltip="Quién pagó. Sólo se pueden aplicar facturas suyas, y de su ficha sale la cuenta por cobrar que se cancela." kind="select" label="Pagador" name="payerBpId" required className="xl:col-span-2" value={payerBpId} onChange={(event) => { setPayerBpId(event.target.value); setAllocations([createAllocation('allocation-0')]); }} options={partners} />
              <FormField tooltip="Fecha en que se recibió el dinero; de ella sale el período contable en el que entra el asiento." label="Fecha del cobro" name="receiptDate" type="date" required />
              <FormField tooltip="Importe recibido, con hasta dos decimales. Tiene que coincidir con lo que se reparte entre las facturas." label="Monto recibido" name="amount" type="number" required value={amount} onChange={(event) => setAmount(event.target.value)} />
              <FormField tooltip="Moneda del documento (ISO 4217). Ej.: BOB." key={`currencyCode:${monedas.length}`} kind="select" label="Moneda" name="currencyCode" defaultValue="BOB" required options={monedas} />
              <FormField tooltip="Cuenta bancaria donde entró el dinero; si la empresa tiene una sola principal, puede dejarse vacía." kind="select" label="Cuenta bancaria" name="bankAccountId" options={[{ label: '— La principal de la empresa —', value: '', description: 'El sistema usa la cuenta marcada como principal.' }, ...bankAccounts]} />
            </div>
          </Panel>

          <Panel
            title="Facturas que cancela"
            icon="account_tree"
            action={<AtlasButton variant="secondary" icon="add" data-testid="recibo-agregar-factura" onClick={() => setAllocations((current) => [...current, createAllocation(newUuid())])}>Agregar factura</AtlasButton>}
          >
            {!payerBpId ? (
              <InlineNotice tone="info">Elige primero el pagador: aquí sólo se ofrecen sus facturas abiertas.</InlineNotice>
            ) : !opcionesFactura.length ? (
              <InlineNotice tone="warning" title="Este pagador no tiene facturas abiertas">Sólo se puede aplicar un cobro a facturas emitidas o cobradas a medias.</InlineNotice>
            ) : null}
            <div className="space-y-2">
              {allocations.map((allocation) => (
                <div key={allocation.id} className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 grid-cols-1 md:grid-cols-[minmax(0,1fr)_180px_36px]">
                  <OptionSelect
                    name={`arInvoiceId-${allocation.id}`}
                    ariaLabel="Factura a la que se aplica"
                    compact
                    value={allocation.arInvoiceId}
                    required
                    onChange={(value) => elegirFactura(allocation.id, value)}
                    placeholder="— Elige la factura —"
                    options={opcionesFactura}
                  />
                  <input
                    className="h-9 rounded border border-slate-300 bg-white px-3 text-right text-xs"
                    type="number"
                    min="0.01"
                    step="0.01"
                    aria-label="Importe que se aplica a esta factura"
                    placeholder="Monto aplicado"
                    value={allocation.allocatedAmount}
                    required
                    onChange={(event) => update(allocation.id, 'allocatedAmount', event.target.value)}
                  />
                  <button
                    type="button"
                    disabled={allocations.length === 1}
                    aria-label="Quitar esta factura del cobro"
                    className="grid h-9 place-items-center text-red-600 disabled:opacity-30"
                    onClick={() => setAllocations((current) => current.filter((item) => item.id !== allocation.id))}
                  >
                    <Icon name="delete" className="text-[18px]" />
                  </button>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-20">
          <Panel title="Cuadre" icon="balance">
            <div className="rounded-md bg-slate-50 p-4">
              <p className="text-[10px] font-bold uppercase text-slate-500">Repartido entre facturas</p>
              <p className="mt-1 text-2xl font-bold" data-testid="recibo-total-asignado">{formatBob(totalAllocated)}</p>
            </div>
            <div className="mt-3 flex justify-between text-xs"><span className="text-slate-500">Monto recibido</span><b>{formatBob(montoRecibido)}</b></div>
            <div className="mt-1.5 flex justify-between text-xs"><span className="text-slate-500">Facturas aplicadas</span><b>{allocations.length}</b></div>
            <div className="mt-3" data-testid="recibo-estado-cuadre">
              {cuadrado ? (
                <StatusPill tone="success">Cuadrado</StatusPill>
              ) : (
                <StatusPill tone="warning">
                  {montoRecibido <= 0 ? 'Falta el monto recibido' : diferencia > 0 ? `Faltan por repartir ${formatBob(diferencia)}` : `Sobran ${formatBob(Math.abs(diferencia))}`}
                </StatusPill>
              )}
            </div>
          </Panel>
          <InlineNotice tone="info">Lo que se reparte entre las facturas tiene que sumar exactamente el monto recibido; hasta entonces el botón de contabilizar no se activa.</InlineNotice>
        </aside>
      </div>
    </form>
  );
}
