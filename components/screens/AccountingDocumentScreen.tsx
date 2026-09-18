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
import { loadAccountingPeriods, loadBusinessPartners, loadCostCenters, loadGlAccounts, loadLedgers, loadLegalEntities , loadAccountingDocuments } from '@/services/optionLoaders';
import { formatBob } from '@/lib/formatters';
import type { JsonObject } from '@/services/types';
import { newUuid } from '@/lib/uuid';

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

interface AccountingDocumentScreenProps {
  onDone?: (() => void | Promise<void>) | undefined;
}

export function AccountingDocumentScreen({ onDone }: AccountingDocumentScreenProps = {}) {
  /* Los documentos se ELIGEN: el backend los expone y nadie recuerda un uuid. */
  const documentos = useOptions(loadAccountingDocuments);
  const [lines, setLines] = useState<JournalLine[]>([createLine('journal-0', 0), createLine('journal-1', 1)]);
  const [documentId, setDocumentId] = useState('');
  const createMutation = useAtlasMutation(useCallback((payload: JsonObject) => accountingService.createDocument(payload), []));
  const postMutation = useAtlasMutation(useCallback((id: string) => accountingService.postDocument(id), []));
  const totals = useMemo(() => lines.reduce((result, line) => ({ debit: result.debit + Number(line.debit || 0), credit: result.credit + Number(line.credit || 0) }), { debit: 0, credit: 0 }), [lines]);
  const balanced = Math.abs(totals.debit - totals.credit) < 0.001 && totals.debit > 0;
  /* `useOptions` carga UNA vez al montar, así que el borrador que se acaba de crear no está en esa
     lista. Sin añadirlo a mano, guardar un borrador vaciaría el select —el valor no casa con ninguna
     opción— y «Contabilizar» quedaría inalcanzable justo en el momento para el que existe. La
     opción vacía mantiene coherente el otro extremo: sin documento elegido, el select lo dice en
     vez de mostrar el primero de la lista mientras el botón sigue apagado. */
  const opcionesDocumento = useMemo(() => [
    { label: '— Ninguno —', value: '' },
    ...(documentId && !documentos.some((option) => option.value === documentId)
      ? [{ label: `${documentId.slice(0, 8)}… — borrador recién guardado`, value: documentId }]
      : []),
    ...documentos,
  ], [documentos, documentId]);
  const legalEntities = useOptions(loadLegalEntities);
  const periods = useOptions(loadAccountingPeriods);
  const ledgers = useOptions(loadLedgers);
  const glAccounts = useOptions(loadGlAccounts);
  const partners = useOptions(loadBusinessPartners);
  const costCenters = useOptions(loadCostCenters);
  /* Dominios cerrados del backend: antes eran textos libres y el alta fallaba si no se escribía el
     código exacto (ATLAS_ERP, MANUAL, JOURNAL…). */
  const sistemasOrigen = useOptions(domainLoader('domain:accounting.documentSourceSystem'));
  const tiposOrigen = useOptions(domainLoader('domain:accounting.documentSourceType'));
  const tiposDocumento = useOptions(domainLoader('domain:accounting.documentType'));
  const aprobaciones = useOptions(domainLoader('domain:accounting.documentApprovalStatus'));
  const monedas = useOptions(domainLoader('catalog:currency'));
  /* El número del documento lo asigna el backend (DOC-…); tras guardar se enseña el que asignó. */
  const [numeroAsignado, setNumeroAsignado] = useState('');
  /* «ID origen» es la referencia del documento en su sistema de origen, y junto con sistema y tipo
     no se puede repetir. En un asiento manual no hay tal sistema, así que se propone una referencia
     única y editable. Se genera tras montar —no al renderizar en el servidor— para no desalinear la
     hidratación, y se renueva tras cada guardado para que el siguiente borrador no choque. */
  const [sourceIdSugerido, setSourceIdSugerido] = useState('');
  useEffect(() => { setSourceIdSugerido(`MANUAL-${Date.now()}`); }, []);

  function updateLine(id: string, key: keyof JournalLine, value: string) { setLines((current) => current.map((line) => line.id === id ? { ...line, [key]: value } : line)); }

  async function createDocument(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const currencyCode = String(form.get('currencyCode') ?? 'BOB');
    const payload: JsonObject = {
      legalEntityId: String(form.get('legalEntityId') ?? ''), sourceSystem: String(form.get('sourceSystem') ?? ''),
      sourceType: String(form.get('sourceType') ?? ''), sourceId: String(form.get('sourceId') ?? ''),
      documentType: String(form.get('documentType') ?? ''),
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
    try {
      const created = await createMutation.execute(payload);
      if (created.id) setDocumentId(String(created.id));
      setNumeroAsignado(created.documentNo ? String(created.documentNo) : '');
      setSourceIdSugerido(`MANUAL-${Date.now()}`);
      await onDone?.();
    } catch { /* controlled */ }
  }

  async function postDocument() { if (!documentId) return; try { await postMutation.execute(documentId); await onDone?.(); } catch { /* controlled */ } }

  const acciones = <><AtlasButton variant="secondary" icon="close" type="reset">Cancelar</AtlasButton><AtlasButton variant="secondary" icon="rule" disabled={!balanced}>Validar cuadre</AtlasButton><AtlasButton type="submit" icon="save" loading={createMutation.isLoading}>Guardar borrador</AtlasButton></>;

  return (
    <form className="space-y-5" onSubmit={createDocument}>
      <WorkspaceHeader breadcrumbs={[{ label: 'Contabilidad' }, { label: 'Documentos', href: '/operaciones/contabilidad/documentos' }, { label: 'Crear documento' }]} title="Crear documento contable" description="Prepare un asiento balanceado, valide dimensiones y contabilícelo en el ledger correspondiente." actions={acciones} />
      {(createMutation.error || postMutation.error) ? <InlineNotice tone="danger">{createMutation.error ?? postMutation.error}</InlineNotice> : null}
      {postMutation.status === 'success' ? <InlineNotice tone="success" title="Documento contabilizado">El documento fue posteado y ya no debe modificarse directamente.</InlineNotice> : null}

      <div className="grid items-start gap-4 grid-cols-[minmax(0,1fr)] xl:grid-cols-[minmax(0,1fr)_310px]">
        <div className="space-y-4">
          <Panel data-tutorial-id="document-header" title="Datos de Cabecera" icon="description"><div className="grid gap-3 grid-cols-1 md:grid-cols-2 xl:grid-cols-4"><FormField tooltip="Empresa del grupo que emite o recibe el documento; decide libro, moneda y numeración." kind="select" label="Entidad legal" name="legalEntityId" required className="xl:col-span-2" options={legalEntities} />{/* Los selects se remontan cuando llegan sus opciones: un <select> no controlado sólo aplica su defaultValue al montar. */}<FormField tooltip="Sistema del que viene el documento; un asiento manual es ATLAS_ERP." key={`sourceSystem:${sistemasOrigen.length}`} kind="select" label="Sistema origen" name="sourceSystem" required defaultValue="ATLAS_ERP" options={sistemasOrigen} /><FormField tooltip="Cómo nació el documento: manual, importado o generado por otro módulo." key={`sourceType:${tiposOrigen.length}`} kind="select" label="Tipo origen" name="sourceType" required defaultValue="MANUAL" options={tiposOrigen} /><FormField tooltip="Referencia del documento en su sistema de origen." key={`sourceId:${sourceIdSugerido}`} label="ID origen" name="sourceId" required defaultValue={sourceIdSugerido} hint="Referencia del documento en su sistema de origen. En un asiento manual basta la propuesta." /><FormField tooltip="Clase de documento contable; decide numeración y validaciones." key={`documentType:${tiposDocumento.length}`} kind="select" label="Tipo documento" name="documentType" required defaultValue="JOURNAL" options={tiposDocumento} />{numeroAsignado ? <FormField tooltip="Número con el que quedó registrado el asiento." name="" label="Número documento" value={numeroAsignado} readOnly tabIndex={-1} /> : null}<FormField tooltip="Moneda del documento (ISO 4217). Ej.: BOB." key={`currencyCode:${monedas.length}`} kind="select" label="Moneda" name="currencyCode" required defaultValue="BOB" options={monedas} /><FormField tooltip="Fecha que lleva el documento." label="Fecha documento" name="documentDate" type="date" required /><FormField tooltip="Fecha con la que se registra en el libro; debe caer en un período abierto." label="Fecha contabilización" name="postingDate" type="date" required /><FormField tooltip="Período abierto en el que se registra; uno cerrado rechaza el asiento." kind="select" label="Período contable" name="accountingPeriodId" required options={periods} /><FormField tooltip="Libro contable en el que se registra." kind="select" label="Ledger" name="ledgerId" required options={ledgers} /><FormField tooltip="Si el documento requiere aprobación antes de contabilizarse." key={`approvalStatus:${aprobaciones.length}`} kind="select" label="Aprobación" name="approvalStatus" defaultValue="NOT_REQUIRED" options={aprobaciones} /></div></Panel>
          <Panel title={`Líneas de Asiento (${lines.length})`} icon="list_alt" action={<AtlasButton variant="secondary" icon="add_box" onClick={() => setLines((current) => [...current, createLine(newUuid(), current.length)])}>Agregar línea</AtlasButton>}>
            <div data-tutorial-id="document-lines" className="table-scroll"><table className="min-w-[1080px] w-full text-left text-xs"><thead className="bg-slate-50 text-[10px] uppercase text-slate-500"><tr><th className="p-2">Cuenta GL</th><th className="p-2 text-right">Debe</th><th className="p-2 text-right">Haber</th><th className="p-2">Descripción</th><th className="p-2">Partner</th><th className="p-2">Centro costo</th><th /></tr></thead><tbody className="divide-y divide-slate-100">{lines.map((line) => <tr key={line.id}><td className="p-2"><OptionSelect name={`glAccountId-${line.id}`} ariaLabel="Cuenta GL de la línea" compact className="w-72" required value={line.glAccountId} onChange={(value) => updateLine(line.id, 'glAccountId', value)} placeholder="— Cuenta GL —" options={glAccounts} /></td><td className="p-2"><input className="h-9 w-28 rounded border border-slate-300 px-2 text-right" type="number" min="0" step="0.01" value={line.debit} onChange={(event) => updateLine(line.id, 'debit', event.target.value)} /></td><td className="p-2"><input className="h-9 w-28 rounded border border-slate-300 px-2 text-right" type="number" min="0" step="0.01" value={line.credit} onChange={(event) => updateLine(line.id, 'credit', event.target.value)} /></td><td className="p-2"><input className="h-9 w-52 rounded border border-slate-300 px-2" value={line.description} onChange={(event) => updateLine(line.id, 'description', event.target.value)} /></td><td className="p-2"><OptionSelect name={`partnerId-${line.id}`} ariaLabel="Socio de negocio de la línea" compact className="w-48" value={line.partnerId} onChange={(value) => updateLine(line.id, 'partnerId', value)} options={[{ value: '', label: '— Ninguno —', description: 'La línea no se atribuye a ningún socio de negocio.' }, ...partners]} /></td><td className="p-2"><OptionSelect name={`costCenterId-${line.id}`} ariaLabel="Centro de costo de la línea" compact className="w-48" value={line.costCenterId} onChange={(value) => updateLine(line.id, 'costCenterId', value)} options={costCenters.length ? [{ value: '', label: '— Ninguno —', description: 'La línea no se imputa a ningún centro de costo.' }, ...costCenters] : []} /></td><td className="p-2"><button type="button" disabled={lines.length <= 2} className="grid h-8 w-8 place-items-center text-red-600 disabled:opacity-30" onClick={() => setLines((current) => current.filter((entry) => entry.id !== line.id))}><Icon name="delete" className="text-[18px]" /></button></td></tr>)}</tbody><tfoot data-tutorial-id="document-totals" className="border-t-2 border-slate-200 bg-slate-50 font-bold"><tr><td className="p-3">Totales</td><td className="p-3 text-right">{formatBob(totals.debit)}</td><td className="p-3 text-right">{formatBob(totals.credit)}</td><td colSpan={4} className="p-3 text-right"><StatusPill tone={balanced ? 'success' : 'danger'}>{balanced ? 'CUADRADO' : `DIFERENCIA ${formatBob(Math.abs(totals.debit - totals.credit))}`}</StatusPill></td></tr></tfoot></table></div>
          </Panel>
        </div>
        <aside className="space-y-4 xl:sticky xl:top-20"><Panel data-tutorial-id="document-totals" title="Posting Control" icon="fact_check"><div className="space-y-3 text-xs"><Control label="Documento balanceado" ok={balanced} /><Control label="Mínimo dos líneas" ok={lines.length >= 2} /><Control label="Borrador persistido" ok={Boolean(documentId)} /></div><FormField tooltip="Documento en curso sobre el que se trabaja; el recién guardado queda seleccionado." kind="select" label="Documento en curso" name="documentId" value={documentId} onChange={(event) => setDocumentId(event.target.value)} options={opcionesDocumento} className="mt-4" hint="Elija un documento o guarde un borrador: el recién guardado queda seleccionado." /><AtlasButton className="mt-4 w-full" variant="success" icon="verified" disabled={!documentId || !balanced} loading={postMutation.isLoading} onClick={postDocument}>Contabilizar</AtlasButton></Panel><InlineNotice tone="warning">Contabilizar es una transición de estado. Las correcciones posteriores deben realizarse mediante reversión, no edición directa.</InlineNotice></aside>
      </div>
    </form>
  );
}
function Control({ label, ok }: { label: string; ok: boolean }) { return <div className="flex items-center justify-between"><span className="text-slate-600">{label}</span><Icon name={ok ? 'check_circle' : 'cancel'} className={`text-[18px] ${ok ? 'text-emerald-600' : 'text-red-500'}`} /></div>; }
