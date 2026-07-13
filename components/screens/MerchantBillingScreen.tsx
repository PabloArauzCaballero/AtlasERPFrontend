'use client';

import { useCallback, useMemo, useState } from 'react';
import { portalService } from '@/services/portalService';
import { b2bService } from '@/services/b2bService';
import { useAsyncResource } from '@/hooks/useAsyncResource';
import { useOptions } from '@/hooks/useOptions';
import { FormField } from '@/components/atlas/FormField';
import { InlineNotice } from '@/components/atlas/InlineNotice';
import { MetricCard } from '@/components/atlas/MetricCard';
import { Panel } from '@/components/atlas/Panel';
import { StatusPill } from '@/components/atlas/StatusPill';
import { WorkspaceHeader } from '@/components/atlas/WorkspaceHeader';
import { formatBob, formatDate } from '@/lib/formatters';
import type { ResourceRow } from '@/services/types';

export function MerchantBillingScreen() {
  const accountOptions = useOptions(useCallback(async () => {
    const result = await b2bService.listAccounts({ page: 1, limit: 100 });
    const rows = (result.items ?? result.rows ?? []) as ResourceRow[];
    return rows.map((row) => ({ value: String(row.id), label: String(row.tradeName ?? row.legalName ?? 'Comercio') }));
  }, []));

  const [merchantAccountId, setMerchantAccountId] = useState('');
  const billing = useAsyncResource(
    useCallback(() => (merchantAccountId ? portalService.getBilling(merchantAccountId) : Promise.resolve({} as ResourceRow)), [merchantAccountId]),
    Boolean(merchantAccountId),
  );
  const data = (billing.data ?? {}) as ResourceRow;
  const summary = (data.summary ?? {}) as ResourceRow;
  const invoices = useMemo(() => (data.invoices ?? []) as ResourceRow[], [data.invoices]);
  const receivables = useMemo(() => (data.receivables ?? []) as ResourceRow[], [data.receivables]);

  return (
    <div className="space-y-5">
      <WorkspaceHeader
        breadcrumbs={[{ label: 'Portal comercio' }, { label: 'Consumo y facturación' }]}
        title="Consumo y facturación"
        description="Resumen del plan contratado, facturas emitidas y saldos pendientes del comercio."
      />

      <Panel compact>
        <FormField
          kind="select"
          label="Comercio"
          name="merchantAccountId"
          className="max-w-md"
          value={merchantAccountId}
          onChange={(e) => setMerchantAccountId(e.target.value)}
          options={[{ label: '— Seleccione un comercio —', value: '' }, ...accountOptions]}
        />
      </Panel>

      {billing.error ? <InlineNotice tone="danger" title="No se pudo cargar la facturación">{billing.error}</InlineNotice> : null}
      {!merchantAccountId ? <InlineNotice tone="info" title="Seleccione un comercio">Elija un comercio para ver su consumo y facturación.</InlineNotice> : null}

      {merchantAccountId && !billing.error ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Plan actual" value={String(summary.planName ?? 'Sin plan')} detail={summary.monthlyPlanPrice ? `${formatBob(Number(summary.monthlyPlanPrice))}/mes` : 'Sin costo mensual'} icon="workspace_premium" />
            <MetricCard label="Facturas emitidas" value={String(summary.invoiceCount ?? 0)} detail="Total histórico" icon="receipt_long" tone="teal" />
            <MetricCard label="Facturado" value={formatBob(Number(summary.invoicedTotal ?? 0))} detail="Monto acumulado" icon="payments" tone="purple" />
            <MetricCard label="Saldo pendiente" value={formatBob(Number(summary.openTotal ?? 0))} detail={`${String(summary.openReceivableCount ?? 0)} cobros abiertos`} icon="account_balance_wallet" tone="amber" />
          </div>

          <Panel title="Facturas del comercio" icon="receipt_long">
            {invoices.length ? (
              <div className="overflow-hidden rounded-lg border border-slate-200"><table className="w-full text-left text-xs"><thead className="bg-slate-50 text-[10px] uppercase text-slate-500"><tr><th className="p-2.5">Número</th><th className="p-2.5">Fecha</th><th className="p-2.5">Vencimiento</th><th className="p-2.5 text-right">Total</th><th className="p-2.5">Estado</th></tr></thead><tbody className="divide-y divide-slate-100">{invoices.map((invoice) => <tr key={String(invoice.id)}><td className="p-2.5 font-mono text-[11px]">{String(invoice.invoiceNumber ?? '—')}</td><td className="p-2.5">{formatDate(typeof invoice.invoiceDate === 'string' ? invoice.invoiceDate : undefined)}</td><td className="p-2.5">{formatDate(typeof invoice.dueDate === 'string' ? invoice.dueDate : undefined)}</td><td className="p-2.5 text-right font-semibold">{formatBob(Number(invoice.totalAmount ?? 0))}</td><td className="p-2.5"><StatusPill tone={String(invoice.status).includes('PAID') ? 'success' : String(invoice.status).includes('DRAFT') ? 'neutral' : 'warning'}>{String(invoice.status ?? '—')}</StatusPill></td></tr>)}</tbody></table></div>
            ) : <p className="py-6 text-center text-xs text-slate-500">Este comercio aún no tiene facturas emitidas.</p>}
          </Panel>

          <Panel title="Cuentas por cobrar" icon="account_balance_wallet">
            {receivables.length ? (
              <div className="overflow-hidden rounded-lg border border-slate-200"><table className="w-full text-left text-xs"><thead className="bg-slate-50 text-[10px] uppercase text-slate-500"><tr><th className="p-2.5">Origen</th><th className="p-2.5">Emitido</th><th className="p-2.5">Vencimiento</th><th className="p-2.5 text-right">Original</th><th className="p-2.5 text-right">Saldo</th><th className="p-2.5">Estado</th></tr></thead><tbody className="divide-y divide-slate-100">{receivables.map((receivable) => <tr key={String(receivable.id)}><td className="p-2.5">{String(receivable.sourceType ?? '—')}</td><td className="p-2.5">{formatDate(typeof receivable.issuedAt === 'string' ? receivable.issuedAt : undefined)}</td><td className="p-2.5">{formatDate(typeof receivable.dueDate === 'string' ? receivable.dueDate : undefined)}</td><td className="p-2.5 text-right">{formatBob(Number(receivable.amountOriginal ?? 0))}</td><td className="p-2.5 text-right font-semibold">{formatBob(Number(receivable.amountOpen ?? 0))}</td><td className="p-2.5"><StatusPill tone={Number(receivable.amountOpen ?? 0) > 0 ? 'warning' : 'success'}>{String(receivable.status ?? '—')}</StatusPill></td></tr>)}</tbody></table></div>
            ) : <p className="py-6 text-center text-xs text-slate-500">Sin cuentas por cobrar registradas.</p>}
          </Panel>
        </>
      ) : null}
    </div>
  );
}
