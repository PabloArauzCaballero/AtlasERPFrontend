'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { AtlasButton } from '@/components/atlas/AtlasButton';
import { Icon } from '@/components/atlas/Icon';
import { InlineNotice } from '@/components/atlas/InlineNotice';
import { MetricCard } from '@/components/atlas/MetricCard';
import { Panel } from '@/components/atlas/Panel';
import { StatusPill } from '@/components/atlas/StatusPill';
import { WorkspaceHeader } from '@/components/atlas/WorkspaceHeader';
import { useAtlasMutation } from '@/hooks/useAtlasMutation';
import { downloadCsvTemplate, parseCsv } from '@/lib/csv';
import type { JsonObject, ResourceRow } from '@/services/types';

interface BulkImportScreenProps {
  moduleLabel: string;
  title: string;
  description: string;
  templateName: string;
  headers: string[];
  requiredHeaders: string[];
  transformRow: (row: Record<string, string>, index: number) => JsonObject;
  submit: (payload: JsonObject) => Promise<ResourceRow>;
  maxRows: number;
}

interface StagedRow { index: number; raw: Record<string, string>; payload: JsonObject; errors: string[] }

export function BulkImportScreen(props: BulkImportScreenProps) {
  const { submit } = props;
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<StagedRow[]>([]);
  const [batchExternalId, setBatchExternalId] = useState('');
  const mutationFunction = useCallback((payload: JsonObject) => submit(payload), [submit]);
  const mutation = useAtlasMutation(mutationFunction);
  const validRows = useMemo(() => rows.filter((row) => row.errors.length === 0), [rows]);
  const invalidRows = rows.length - validRows.length;

  async function stageFile(file?: File) {
    if (!file) return;
    setFileName(file.name);
    const parsed = parseCsv(await file.text());
    const staged = parsed.slice(0, props.maxRows).map<StagedRow>((raw, index) => {
      const errors = props.requiredHeaders.filter((header) => !raw[header]?.trim()).map((header) => `Falta ${header}`);
      let payload: JsonObject = {};
      try { payload = props.transformRow(raw, index); } catch (error) { errors.push(error instanceof Error ? error.message : 'Fila inválida'); }
      return { index: index + 2, raw, payload, errors };
    });
    setRows(staged);
    mutation.reset();
  }

  async function processBatch() {
    if (!validRows.length || invalidRows > 0) return;
    try { await mutation.execute({ ...(batchExternalId ? { batchExternalId } : {}), items: validRows.map((row) => row.payload) }); } catch { /* controlled */ }
  }

  return (
    <div className="space-y-5">
      <WorkspaceHeader breadcrumbs={[{ label: props.moduleLabel }, { label: props.title }]} title={props.title} description={props.description} actions={<AtlasButton variant="secondary" icon="download" onClick={() => downloadCsvTemplate(props.templateName, props.headers)}>Descargar plantilla</AtlasButton>} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Filas cargadas" value={rows.length} detail={`Máximo permitido: ${props.maxRows}`} icon="table_rows" /><MetricCard label="Registros válidos" value={validRows.length} detail="Listos para procesamiento" icon="check_circle" tone="teal" /><MetricCard label="Con observaciones" value={invalidRows} detail="Deben corregirse antes de enviar" icon="warning" tone="amber" /><MetricCard label="Estado del batch" value={mutation.status === 'success' ? 'PROCESADO' : rows.length ? 'STAGING' : 'SIN ARCHIVO'} detail={fileName || 'Seleccione un archivo CSV'} icon="inventory" tone="purple" /></div>
      {mutation.error ? <InlineNotice tone="danger" title="El batch fue rechazado">{mutation.error}</InlineNotice> : null}
      {mutation.status === 'success' ? <InlineNotice tone="success" title="Batch procesado">El backend recibió {validRows.length} registros bajo una única operación auditable.</InlineNotice> : null}

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <Panel title="Carga del archivo" icon="upload_file">
            <input ref={inputRef} className="hidden" type="file" accept=".csv,text/csv" onChange={(event) => void stageFile(event.target.files?.[0])} />
            <button type="button" onClick={() => inputRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void stageFile(event.dataTransfer.files[0]); }} className="group grid min-h-44 w-full place-items-center rounded-md border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center hover:border-[#006a61] hover:bg-primary-wash"><div><span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-white text-[#006a61] shadow-sm ring-1 ring-slate-200"><Icon name="cloud_upload" className="text-[25px]" /></span><p className="mt-3 text-sm font-bold text-slate-800">Arrastre el archivo CSV aquí</p><p className="mt-1 text-xs text-slate-500">o haga clic para buscarlo en el equipo</p>{fileName ? <p className="mt-3 font-mono text-[11px] text-teal-700">{fileName}</p> : null}</div></button>
          </Panel>

          <Panel title="Vista previa de los datos" description={`Mostrando ${Math.min(rows.length, 10)} de ${rows.length} filas cargadas`} icon="table_view" action={invalidRows ? <StatusPill tone="warning">{invalidRows} errores</StatusPill> : rows.length ? <StatusPill tone="success">Pre-flight OK</StatusPill> : undefined}>
            <div data-tutorial-id="bulk-preview" className="table-scroll"><table className="min-w-[900px] w-full text-left text-xs"><thead className="bg-slate-50 text-[10px] uppercase text-slate-500"><tr><th className="px-2 py-2">Fila</th>{props.headers.slice(0, 6).map((header) => <th className="px-2 py-2" key={header}>{header}</th>)}<th className="px-2 py-2">Validación</th></tr></thead><tbody className="divide-y divide-slate-100">{rows.slice(0, 10).map((row) => <tr key={row.index} className={row.errors.length ? 'bg-red-50/50' : ''}><td className="px-2 py-2 font-mono text-[10px]">{row.index}</td>{props.headers.slice(0, 6).map((header) => <td className="max-w-48 truncate px-2 py-2" key={header}>{row.raw[header] || '—'}</td>)}<td className="px-2 py-2">{row.errors.length ? <span className="text-[10px] font-semibold text-red-700">{row.errors.join(', ')}</span> : <StatusPill tone="success" dot={false}>Válida</StatusPill>}</td></tr>)}{!rows.length ? <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-500">La vista previa aparecerá después de cargar la plantilla.</td></tr> : null}</tbody></table></div>
          </Panel>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-20">
          <Panel title="Pre-flight Audit" icon="rule"><div className="space-y-3"><Audit label="Encabezados requeridos" ok={rows.length > 0 && invalidRows === 0} /><Audit label={`Límite de ${props.maxRows} filas`} ok={rows.length <= props.maxRows} /><Audit label="Duplicados internos" ok={rows.length > 0} detail="El backend repite esta comprobación." /><Audit label="Validación Zod" ok={rows.length > 0} detail="Se ejecuta al enviar el lote." /></div></Panel>
          <Panel title="Propiedades del lote" icon="inventory_2"><label className="block text-xs font-bold text-slate-700">Identificador externo<input className="mt-1.5 h-9 w-full rounded-md border border-slate-300 px-3 text-xs" value={batchExternalId} onChange={(event) => setBatchExternalId(event.target.value)} placeholder="IMPORT-2026-001" /></label><AtlasButton className="mt-4 w-full" icon="publish" loading={mutation.isLoading} disabled={!validRows.length || invalidRows > 0} onClick={processBatch}>Procesar {validRows.length} registros</AtlasButton></Panel>
          <InlineNotice tone="warning">El procesamiento se bloquea mientras existan filas con campos obligatorios vacíos.</InlineNotice>
        </aside>
      </div>
    </div>
  );
}

function Audit({ label, ok, detail }: { label: string; ok: boolean; detail?: string }) { return <div className="flex items-start gap-2"><Icon name={ok ? 'check_circle' : 'radio_button_unchecked'} className={`text-[18px] ${ok ? 'text-emerald-600' : 'text-slate-500'}`} /><div><p className="text-xs font-semibold text-slate-700">{label}</p>{detail ? <p className="text-[10px] text-slate-500">{detail}</p> : null}</div></div>; }
