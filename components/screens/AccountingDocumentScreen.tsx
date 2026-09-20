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
import { useAtlasMutation } from '@/hooks/useAtlasMutation';
import { useOptions } from '@/hooks/useOptions';
import { loadBusinessPartners, loadCostCenters, loadGlAccounts, loadLegalEntities } from '@/services/optionLoaders';
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

const createLine = (id: string, index: number): JournalLine => ({
  id,
  glAccountId: '',
  debit: index === 0 ? '0' : '',
  credit: index === 1 ? '0' : '',
  description: '',
  partnerId: '',
  costCenterId: '',
});

interface AccountingDocumentScreenProps {
  onDone?: (() => void | Promise<void>) | undefined;
}

/**
 * Teclear un asiento.
 *
 * La cabecera pedía DOCE datos, ocho de ellos ajenos a quien teclea el asiento: «Sistema origen»,
 * «Tipo origen», «ID origen» —una referencia de integración que la propia pantalla se inventaba
 * como `MANUAL-<marca de tiempo>`—, «Período contable», «Ledger», «Aprobación», una segunda fecha
 * y un desplegable «Documento en curso» que permitía contabilizar OTRO borrador desde la pantalla
 * de crear uno. Todo eso lo sabe el sistema: el origen es este, el período lo dice la fecha, el
 * libro lo dice la empresa, y contabilizar un borrador viejo se hace desde su fila en el listado.
 *
 * Quedan cinco: empresa, tipo de asiento, moneda, fecha y las líneas.
 */
export function AccountingDocumentScreen({ onDone }: AccountingDocumentScreenProps = {}) {
  const [lines, setLines] = useState<JournalLine[]>([createLine('journal-0', 0), createLine('journal-1', 1)]);
  const [documentId, setDocumentId] = useState('');
  /* El número del documento lo asigna el backend (DOC-…); tras guardar se enseña el que asignó. */
  const [numeroAsignado, setNumeroAsignado] = useState('');

  const createMutation = useAtlasMutation(useCallback((payload: JsonObject) => accountingService.createDocument(payload), []));
  const postMutation = useAtlasMutation(useCallback((id: string) => accountingService.postDocument(id), []));

  const legalEntities = useOptions(loadLegalEntities);
  const glAccounts = useOptions(loadGlAccounts);
  const partners = useOptions(loadBusinessPartners);
  const costCenters = useOptions(loadCostCenters);
  const tiposDocumento = useOptions(domainLoader('domain:accounting.documentType'));
  const monedas = useOptions(domainLoader('catalog:currency'));

  const totals = useMemo(
    () => lines.reduce((result, line) => ({ debit: result.debit + Number(line.debit || 0), credit: result.credit + Number(line.credit || 0) }), { debit: 0, credit: 0 }),
    [lines],
  );
  const balanced = Math.abs(totals.debit - totals.credit) < 0.001 && totals.debit > 0;

  function updateLine(id: string, key: keyof JournalLine, value: string) {
    setLines((current) => current.map((line) => (line.id === id ? { ...line, [key]: value } : line)));
  }

  async function createDocument(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const currencyCode = String(form.get('currencyCode') ?? 'BOB');
    const fecha = String(form.get('documentDate') ?? '');
    const payload: JsonObject = {
      legalEntityId: String(form.get('legalEntityId') ?? ''),
      documentType: String(form.get('documentType') ?? ''),
      documentDate: fecha,
      /*
       * La fecha de contabilización es la misma: en un asiento tecleado a mano no hay dos. El
       * backend la deduciría igual si no viajara, pero va explícita para que el documento diga
       * con qué fecha entró al libro sin tener que saberse la regla.
       */
      postingDate: fecha,
      currencyCode,
      lines: lines.map((line) => ({
        glAccountId: line.glAccountId,
        debit: Number(line.debit || 0),
        credit: Number(line.credit || 0),
        currencyCode,
        amountLc: Number(line.debit || line.credit || 0),
        ...(line.partnerId ? { partnerId: line.partnerId } : {}),
        ...(line.costCenterId ? { costCenterId: line.costCenterId } : {}),
        ...(line.description ? { description: line.description } : {}),
      })),
    };
    try {
      const created = await createMutation.execute(payload);
      if (created.id) setDocumentId(String(created.id));
      setNumeroAsignado(created.documentNo ? String(created.documentNo) : '');
      await onDone?.();
    } catch { /* el error se pinta arriba */ }
  }

  async function postDocument() {
    if (!documentId) return;
    try {
      await postMutation.execute(documentId);
      await onDone?.();
    } catch { /* el error se pinta arriba */ }
  }

  const acciones = (
    <>
      <AtlasButton variant="secondary" icon="close" type="reset">Cancelar</AtlasButton>
      <AtlasButton type="submit" icon="save" data-testid="documento-guardar" loading={createMutation.isLoading}>Guardar borrador</AtlasButton>
    </>
  );

  return (
    <form className="space-y-5" onSubmit={createDocument}>
      <WorkspaceHeader
        breadcrumbs={[{ label: 'Contabilidad' }, { label: 'Documentos', href: '/operaciones/contabilidad/documentos' }, { label: 'Crear documento' }]}
        title="Crear documento contable"
        description="Un asiento cuadrado: lo que se carga al debe tiene que sumar lo mismo que lo del haber. Se guarda como borrador y se contabiliza después."
        actions={acciones}
      />

      {createMutation.error || postMutation.error ? <InlineNotice tone="danger" title="No se pudo completar la operación">{createMutation.error ?? postMutation.error}</InlineNotice> : null}
      {postMutation.status === 'success' ? <InlineNotice tone="success" title="Documento contabilizado">El asiento quedó en firme. A partir de aquí sólo se corrige con una reversión.</InlineNotice> : null}

      <div className="grid items-start gap-4 grid-cols-[minmax(0,1fr)] xl:grid-cols-[minmax(0,1fr)_310px]">
        <div className="space-y-4">
          <Panel data-tutorial-id="document-header" title="Cabecera" icon="description">
            <div className="grid gap-3 grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
              <FormField tooltip="Empresa del grupo a cuyo libro entra el asiento; de ella salen la numeración y el libro contable." kind="select" label="Empresa" name="legalEntityId" required className="xl:col-span-2" options={legalEntities} />
              {/* Los selects se remontan cuando llegan sus opciones: un select no controlado sólo aplica su defaultValue al montar. */}
              <FormField tooltip="Clase de asiento: uno normal, un ajuste, una reclasificación…; decide las validaciones que se le aplican." key={`documentType:${tiposDocumento.length}`} kind="select" label="Tipo de asiento" name="documentType" required defaultValue="JOURNAL" options={tiposDocumento} />
              <FormField tooltip="Moneda del asiento (ISO 4217). Ej.: BOB." key={`currencyCode:${monedas.length}`} kind="select" label="Moneda" name="currencyCode" required defaultValue="BOB" options={monedas} />
              <FormField tooltip="Fecha con la que entra al libro; tiene que caer en un período abierto, y ese período lo busca el sistema." label="Fecha del asiento" name="documentDate" type="date" required />
              {numeroAsignado ? <FormField tooltip="Número con el que quedó registrado el asiento; lo asigna el sistema al guardar." name="" label="Número del asiento" value={numeroAsignado} readOnly tabIndex={-1} /> : null}
            </div>
          </Panel>

          <Panel
            title={`Líneas del asiento (${lines.length})`}
            icon="list_alt"
            action={<AtlasButton variant="secondary" icon="add_box" onClick={() => setLines((current) => [...current, createLine(newUuid(), current.length)])}>Agregar línea</AtlasButton>}
          >
            <div data-tutorial-id="document-lines" className="table-scroll">
              <table className="min-w-[1080px] w-full text-left text-xs">
                <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
                  <tr>
                    <th className="p-2">Cuenta contable</th>
                    <th className="p-2 text-right">Debe</th>
                    <th className="p-2 text-right">Haber</th>
                    <th className="p-2">Descripción</th>
                    <th className="p-2">Socio</th>
                    <th className="p-2">Centro de costo</th>
                    <th />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lines.map((line) => (
                    <tr key={line.id}>
                      <td className="p-2">
                        <OptionSelect name={`glAccountId-${line.id}`} ariaLabel="Cuenta contable de la línea" compact className="w-72" required value={line.glAccountId} onChange={(value) => updateLine(line.id, 'glAccountId', value)} placeholder="— Cuenta contable —" options={glAccounts} />
                      </td>
                      <td className="p-2"><input className="h-9 w-28 rounded border border-slate-300 px-2 text-right" aria-label="Importe al debe" type="number" min="0" step="0.01" value={line.debit} onChange={(event) => updateLine(line.id, 'debit', event.target.value)} /></td>
                      <td className="p-2"><input className="h-9 w-28 rounded border border-slate-300 px-2 text-right" aria-label="Importe al haber" type="number" min="0" step="0.01" value={line.credit} onChange={(event) => updateLine(line.id, 'credit', event.target.value)} /></td>
                      <td className="p-2"><input className="h-9 w-52 rounded border border-slate-300 px-2" aria-label="Descripción de la línea" value={line.description} onChange={(event) => updateLine(line.id, 'description', event.target.value)} /></td>
                      <td className="p-2">
                        <OptionSelect name={`partnerId-${line.id}`} ariaLabel="Socio de negocio de la línea" compact className="w-48" value={line.partnerId} onChange={(value) => updateLine(line.id, 'partnerId', value)} options={[{ value: '', label: '— Ninguno —', description: 'La línea no se atribuye a ningún socio de negocio.' }, ...partners]} />
                      </td>
                      <td className="p-2">
                        <OptionSelect name={`costCenterId-${line.id}`} ariaLabel="Centro de costo de la línea" compact className="w-48" value={line.costCenterId} onChange={(value) => updateLine(line.id, 'costCenterId', value)} options={costCenters.length ? [{ value: '', label: '— Ninguno —', description: 'La línea no se imputa a ningún centro de costo.' }, ...costCenters] : []} />
                      </td>
                      <td className="p-2">
                        <button type="button" disabled={lines.length <= 2} aria-label="Quitar esta línea" className="grid h-8 w-8 place-items-center text-red-600 disabled:opacity-30" onClick={() => setLines((current) => current.filter((entry) => entry.id !== line.id))}>
                          <Icon name="delete" className="text-[18px]" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot data-tutorial-id="document-totals" className="border-t-2 border-slate-200 bg-slate-50 font-bold">
                  <tr>
                    <td className="p-3">Totales</td>
                    <td className="p-3 text-right">{formatBob(totals.debit)}</td>
                    <td className="p-3 text-right">{formatBob(totals.credit)}</td>
                    <td colSpan={4} className="p-3 text-right">
                      <StatusPill tone={balanced ? 'success' : 'danger'}>{balanced ? 'CUADRADO' : `DIFERENCIA ${formatBob(Math.abs(totals.debit - totals.credit))}`}</StatusPill>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Panel>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-20">
          <Panel title="Antes de contabilizar" icon="fact_check">
            <div className="space-y-3 text-xs">
              <Control label="El asiento cuadra" ok={balanced} />
              <Control label="Tiene al menos dos líneas" ok={lines.length >= 2} />
              <Control label="El borrador está guardado" ok={Boolean(documentId)} />
            </div>
            <AtlasButton className="mt-4 w-full" variant="success" icon="verified" data-testid="documento-contabilizar" disabled={!documentId || !balanced} loading={postMutation.isLoading} onClick={postDocument}>Contabilizar</AtlasButton>
            <p className="mt-2 text-[11px] text-slate-500">Se contabiliza el borrador que acabas de guardar. Para contabilizar otro, búscalo en el listado de documentos.</p>
          </Panel>
          <InlineNotice tone="warning">Contabilizar deja el asiento en firme. Lo que venga después se corrige con una reversión, no editando.</InlineNotice>
        </aside>
      </div>
    </form>
  );
}

function Control({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-600">{label}</span>
      <Icon name={ok ? 'check_circle' : 'cancel'} className={`text-[18px] ${ok ? 'text-emerald-600' : 'text-red-500'}`} />
    </div>
  );
}
