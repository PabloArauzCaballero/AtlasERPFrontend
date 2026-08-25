'use client';

import { useCallback, useMemo, useState } from 'react';
import { accountingService } from '@/services/accountingService';
import { AtlasButton } from '@/components/atlas/AtlasButton';
import { FormField } from '@/components/atlas/FormField';
import { Icon } from '@/components/atlas/Icon';
import { InlineNotice } from '@/components/atlas/InlineNotice';
import { Panel } from '@/components/atlas/Panel';
import { StatusPill } from '@/components/atlas/StatusPill';
import { WorkspaceHeader } from '@/components/atlas/WorkspaceHeader';
import { useAtlasMutation } from '@/hooks/useAtlasMutation';
import { useOptions } from '@/hooks/useOptions';
import { loadAccountingPeriods, loadBusinessPartners, loadCostCenters, loadGlAccounts, loadLedgers, loadLegalEntities , loadAccountingDocuments } from '@/services/optionLoaders';
import { formatBob } from '@/lib/formatters';
import type { JsonObject } from '@/services/types';

interface JournalLine {
  id: string;
  glAccountId: string;
  debit: string;
  credit: string;
  description: string;
  partnerId: string;
  costCenterId: string;
}
const createLine = (id: string, index: number): JournalLine => ({ id, glAccountId: '', debit: index === 0 ? '0' : '', credit: index === 1 ? '0' : '', description: '', partnerId: '', costCenterId: '' });

export function AccountingDocumentScreen() {
  /* Los documentos se ELIGEN: el backend los expone y nadie recuerda un uuid. */
  const documentos = useOptions(loadAccountingDocuments);
  const [lines, setLines] = useState<JournalLine[]>([createLine('journal-0', 0), createLine('journal-1', 1)]);
  const [documentId, setDocumentId] = useState('');
  const createMutation = useAtlasMutation(useCallback((payload: JsonObject) => accountingService.createDocument(payload), []));
  const postMutation = useAtlasMutation(useCallback((id: string) => accountingService.postDocument(id), []));
  const totals = useMemo(() => lines.reduce((result, line) => ({ debit: result.debit + Number(line.debit || 0), credit: result.credit + Number(line.credit || 0) }), { debit: 0, credit: 0 }), [lines]);
  const balanced = Math.abs(totals.debit - totals.credit) < 0.001 && totals.debit > 0;
  const legalEntities = useOptions(loadLegalEntities);
  const periods = useOptions(loadAccountingPeriods);
  const ledgers = useOptions(loadLedgers);
  const glAccounts = useOptions(loadGlAccounts);
  const partners = useOptions(loadBusinessPartners);
  const costCenters = useOptions(loadCostCenters);

  function updateLine(id: string, key: keyof JournalLine, value: string) { setLines((current) => current.map((line) => line.id === id ? { ...line, [key]: value } : line)); }

  async function createDocument(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const currencyCode = String(form.get('currencyCode') ?? 'BOB');
    const payload: JsonObject = {
      legalEntityId: String(form.get('legalEntityId') ?? ''), sourceSystem: String(form.get('sourceSystem') ?? ''),
      sourceType: String(form.get('sourceType') ?? ''), sourceId: String(form.get('sourceId') ?? ''),
      documentType: String(form.get('documentType') ?? ''), documentNo: String(form.get('documentNo') ?? ''),
      documentDate: String(form.get('documentDate') ?? ''), postingDate: String(form.get('postingDate') ?? ''),
      accountingPeriodId: String(form.get('accountingPeriodId') ?? ''), ledgerId: String(form.get('ledgerId') ?? ''),
      currencyCode, approvalStatus: String(form.get('approvalStatus') ?? 'NOT_REQUIRED'),
      lines: lines.map((line) => ({
        glAccountId: line.glAccountId, debit: Number(line.debit || 0), credit: Number(line.credit || 0),
        currencyCode, amountLc: Number(line.debit || line.credit || 0),
        ...(line.partnerId ? { partnerId: line.partnerId } : {}), ...(line.costCenterId ? { costCenterId: line.costCenterId } : {}),
        ...(line.description ? { description: line.description } : {}),
      })),
    };
    try { const created = await createMutation.execute(payload); if (created.id) setDocumentId(String(created.id)); } catch { /* controlled */ }
  }

  async function postDocument() { if (!documentId) return; try { await postMutation.execute(documentId); } catch { /* controlled */ } }

  return (
    <form className="space-y-5" onSubmit={createDocument}>
      <WorkspaceHeader breadcrumbs={[{ label: 'Contabilidad' }, { label: 'Documentos' }]} title="Crear Documento Contable" description="Prepare un asiento balanceado, valide dimensiones y contabilícelo en el ledger correspondiente." actions={<><AtlasButton variant="secondary" icon="close" type="reset">Cancelar</AtlasButton><AtlasButton variant="secondary" icon="rule" disabled={!balanced}>Validar cuadre</AtlasButton><AtlasButton type="submit" icon="save" loading={createMutation.isLoading}>Guardar borrador</AtlasButton></>} />
      {(createMutation.error || postMutation.error) ? <InlineNotice tone="danger">{createMutation.error ?? postMutation.error}</InlineNotice> : null}
      {postMutation.status === 'success' ? <InlineNotice tone="success" title="Documento contabilizado">El documento fue posteado y ya no debe modificarse directamente.</InlineNotice> : null}

      <div className="grid items-start gap-4 grid-cols-[minmax(0,1fr)] xl:grid-cols-[minmax(0,1fr)_310px]">
        <div className="space-y-4">
          <Panel title="Datos de Cabecera" icon="description"><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"><FormField kind="select" label="Entidad legal" name="legalEntityId" required className="xl:col-span-2" options={legalEntities} /><FormField label="Sistema origen" name="sourceSystem" required defaultValue="ATLAS_ERP" /><FormField label="Tipo origen" name="sourceType" required defaultValue="MANUAL" /><FormField label="ID origen" name="sourceId" required /><FormField label="Tipo documento" name="documentType" required defaultValue="JOURNAL" /><FormField label="Número documento" name="documentNo" required /><FormField label="Moneda" name="currencyCode" required defaultValue="BOB" /><FormField label="Fecha documento" name="documentDate" type="date" required /><FormField label="Fecha contabilización" name="postingDate" type="date" required /><FormField kind="select" label="Período contable" name="accountingPeriodId" required options={periods} /><FormField kind="select" label="Ledger" name="ledgerId" required options={ledgers} /><FormField kind="select" label="Aprobación" name="approvalStatus" options={[{ label: 'No requerida', value: 'NOT_REQUIRED' }, { label: 'Pendiente', value: 'PENDING' }, { label: 'Aprobada', value: 'APPROVED' }]} /></div></Panel>
          <Panel title={`Líneas de Asiento (${lines.length})`} icon="list_alt" action={<AtlasButton variant="secondary" icon="add_box" onClick={() => setLines((current) => [...current, createLine(crypto.randomUUID(), current.length)])}>Agregar línea</AtlasButton>}>
            <div data-tutorial-id="document-lines" className="table-scroll"><table className="min-w-[1080px] w-full text-left text-xs"><thead className="bg-slate-50 text-[10px] uppercase text-slate-500"><tr><th className="p-2">Cuenta GL</th><th className="p-2 text-right">Debe</th><th className="p-2 text-right">Haber</th><th className="p-2">Descripción</th><th className="p-2">Partner</th><th className="p-2">Centro costo</th><th /></tr></thead><tbody className="divide-y divide-slate-100">{lines.map((line) => <tr key={line.id}><td className="p-2"><select required className="h-9 w-72 rounded border border-slate-300 px-2 text-[11px]" value={line.glAccountId} onChange={(event) => updateLine(line.id, 'glAccountId', event.target.value)}><option value="">— Cuenta GL —</option>{glAccounts.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></td><td className="p-2"><input className="h-9 w-28 rounded border border-slate-300 px-2 text-right" type="number" min="0" step="0.01" value={line.debit} onChange={(event) => updateLine(line.id, 'debit', event.target.value)} /></td><td className="p-2"><input className="h-9 w-28 rounded border border-slate-300 px-2 text-right" type="number" min="0" step="0.01" value={line.credit} onChange={(event) => updateLine(line.id, 'credit', event.target.value)} /></td><td className="p-2"><input className="h-9 w-52 rounded border border-slate-300 px-2" value={line.description} onChange={(event) => updateLine(line.id, 'description', event.target.value)} /></td><td className="p-2"><select className="h-9 w-48 rounded border border-slate-300 px-2 text-[10px]" value={line.partnerId} onChange={(event) => updateLine(line.id, 'partnerId', event.target.value)}><option value="">— Ninguno —</option>{partners.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></td><td className="p-2"><select className="h-9 w-48 rounded border border-slate-300 px-2 text-[10px]" value={line.costCenterId} onChange={(event) => updateLine(line.id, 'costCenterId', event.target.value)}><option value="">{costCenters.length ? '— Ninguno —' : '— No hay datos registrados —'}</option>{costCenters.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></td><td className="p-2"><button type="button" disabled={lines.length <= 2} className="grid h-8 w-8 place-items-center text-red-600 disabled:opacity-30" onClick={() => setLines((current) => current.filter((entry) => entry.id !== line.id))}><Icon name="delete" className="text-[18px]" /></button></td></tr>)}</tbody><tfoot data-tutorial-id="document-totals" className="border-t-2 border-slate-200 bg-slate-50 font-bold"><tr><td className="p-3">Totales</td><td className="p-3 text-right">{formatBob(totals.debit)}</td><td className="p-3 text-right">{formatBob(totals.credit)}</td><td colSpan={4} className="p-3 text-right"><StatusPill tone={balanced ? 'success' : 'danger'}>{balanced ? 'CUADRADO' : `DIFERENCIA ${formatBob(Math.abs(totals.debit - totals.credit))}`}</StatusPill></td></tr></tfoot></table></div>
          </Panel>
        </div>
        <aside className="space-y-4 xl:sticky xl:top-20"><Panel title="Posting Control" icon="fact_check"><div className="space-y-3 text-xs"><Control label="Documento balanceado" ok={balanced} /><Control label="Mínimo dos líneas" ok={lines.length >= 2} /><Control label="Borrador persistido" ok={Boolean(documentId)} /></div><FormField label="Documento en curso" name="documentId" value={documentId} readOnly className="mt-4" hint="Lo asigna el sistema al guardar el borrador." /><AtlasButton className="mt-4 w-full" variant="success" icon="verified" disabled={!documentId || !balanced} loading={postMutation.isLoading} onClick={postDocument}>Contabilizar</AtlasButton></Panel><InlineNotice tone="warning">Contabilizar es una transición de estado. Las correcciones posteriores deben realizarse mediante reversión, no edición directa.</InlineNotice></aside>
      </div>
    </form>
  );
}
function Control({ label, ok }: { label: string; ok: boolean }) { return <div className="flex items-center justify-between"><span className="text-slate-600">{label}</span><Icon name={ok ? 'check_circle' : 'cancel'} className={`text-[18px] ${ok ? 'text-emerald-600' : 'text-red-500'}`} /></div>; }
