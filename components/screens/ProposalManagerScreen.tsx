'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { b2bService } from '@/services/b2bService';
import { AtlasButton } from '@/components/atlas/AtlasButton';
import { FormField } from '@/components/atlas/FormField';
import { Icon } from '@/components/atlas/Icon';
import { OptionSelect } from '@/components/atlas/OptionSelect';
import { InlineNotice } from '@/components/atlas/InlineNotice';
import { Modal } from '@/components/atlas/Modal';
import { Panel } from '@/components/atlas/Panel';
import { WorkspaceHeader } from '@/components/atlas/WorkspaceHeader';
import { useAtlasMutation } from '@/hooks/useAtlasMutation';
import { formatBob } from '@/lib/formatters';
import { toast } from '@/lib/toast';
import type { JsonObject } from '@/services/types';
import { useOptions } from '@/hooks/useOptions';
import { domainLoader } from '@/services/domains';
import { loadOpportunities, type Option } from '@/services/optionLoaders';
import { newUuid } from '@/lib/uuid';

interface ProposalLine {
  id: string;
  termType: string;
  description: string;
  ratePercent: string;
  fixedAmount: string;
  billingTiming: string;
  minimumMonthlyAmount: string;
}

const emptyLine = (id: string): ProposalLine => ({ id, termType: 'MDR', description: '', ratePercent: '', fixedAmount: '', billingTiming: 'PER_TRANSACTION', minimumMonthlyAmount: '' });

/*
 * Las opciones de un <select> controlado de línea. Mientras el dominio no ha llegado (o si no
 * carga), el valor actual de la línea se sigue ofreciendo: sin él el select se vería vacío aunque
 * la línea ya lleve `MDR`, y lo que se envía no coincidiría con lo que se ve.
 */
function lineOptions(options: Option[], current: string): Option[] {
  return current && !options.some((option) => option.value === current) ? [...options, { value: current, label: current }] : options;
}

interface ProposalManagerScreenProps {
  /** Se llama tras guardar o enviar. */
  onDone?: (() => void | Promise<void>) | undefined;
}

export function ProposalManagerScreen({ onDone }: ProposalManagerScreenProps = {}) {
  const router = useRouter();
  /* Las oportunidades se ELIGEN: el backend las expone y nadie se sabe un uuid. */
  const oportunidades = useOptions(loadOpportunities);
  /* Tipo de término y momento de cobro son dominios cerrados del backend: se piden, no se copian. */
  const tiposDeTermino = useOptions(domainLoader('domain:crm.termType'));
  const momentosDeCobro = useOptions(domainLoader('domain:crm.billingTiming'));
  const [lines, setLines] = useState<ProposalLine[]>([emptyLine('line-0')]);
  const [proposalId, setProposalId] = useState('');
  const [contextoAbierto, setContextoAbierto] = useState(false);
  /* El correlativo se asigna al guardar; aquí sólo se enseña, y sólo cuando ya existe. */
  const [proposalNumber, setProposalNumber] = useState('');
  const createMutation = useAtlasMutation(useCallback((payload: JsonObject) => b2bService.createProposal(payload), []));
  const sendMutation = useAtlasMutation(useCallback((id: string) => b2bService.sendProposal(id), []));
  const estimated = useMemo(() => lines.reduce((sum, line) => sum + Number(line.fixedAmount || 0) + Number(line.minimumMonthlyAmount || 0), 0), [lines]);

  function updateLine(id: string, key: keyof ProposalLine, value: string) {
    setLines((current) => current.map((line) => line.id === id ? { ...line, [key]: value } : line));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload: JsonObject = {
      opportunityId: String(form.get('opportunityId') ?? ''),
      // Sin `proposalNumber`: el backend asigna el correlativo si no llega.
      validUntil: String(form.get('validUntil') ?? '') || undefined,
      totalEstimatedMonthlyRevenue: Number(form.get('totalEstimatedMonthlyRevenue') ?? 0),
      pricingExceptionReason: String(form.get('pricingExceptionReason') ?? '') || undefined,
      lines: lines.map((line) => ({
        termType: line.termType, description: line.description,
        ...(line.ratePercent ? { ratePercent: Number(line.ratePercent) } : {}),
        ...(line.fixedAmount ? { fixedAmount: Number(line.fixedAmount) } : {}),
        currency: 'BOB', billingTiming: line.billingTiming,
        ...(line.minimumMonthlyAmount ? { minimumMonthlyAmount: Number(line.minimumMonthlyAmount) } : {}),
      })),
    };
    try {
      const created = await createMutation.execute(payload);
      if (created.id) setProposalId(String(created.id));
      if (created.proposalNumber) setProposalNumber(String(created.proposalNumber));
      await onDone?.();
    } catch { /* controlled */ }
  }

  async function sendProposal() {
    if (!proposalId) return;
    try {
      await sendMutation.execute(proposalId);
      await onDone?.();
      // Enviada ya no se toca: lo siguiente se hace desde su fila en la cartera.
      toast.success('Propuesta enviada', 'Queda en la cartera; cuando el cliente acepte, márcala desde su fila.');
      router.push('/operaciones/crm/propuestas');
    } catch { /* controlled */ }
  }

  // El contexto ya no ocupa un panel fijo: es una consulta puntual, y vive donde el resto de la ayuda.
  const contexto = <AtlasButton variant="secondary" icon="info" className="w-9 px-0" aria-label="Contexto del cliente" title="Contexto del cliente" onClick={() => setContextoAbierto(true)} />;
  const guardar = <AtlasButton type="submit" icon="save" loading={createMutation.isLoading} disabled={Boolean(proposalId)}>{proposalId ? 'Guardada' : 'Guardar propuesta'}</AtlasButton>;
  // «Enviar» sólo se enciende con la propuesta guardada; sin el título, el botón gris no decía por qué.
  const enviar = <AtlasButton icon="send" type="button" disabled={!proposalId} loading={sendMutation.isLoading} onClick={sendProposal} title={proposalId ? undefined : 'Primero guarda la propuesta'}>Enviar al cliente</AtlasButton>;

  return (
    <form className="space-y-5" onSubmit={submit}>
      <WorkspaceHeader breadcrumbs={[{ label: 'CRM' }, { label: 'Propuestas', href: '/operaciones/crm/propuestas' }, { label: 'Nueva propuesta' }]} title="Nueva propuesta comercial" description="Estructure términos comerciales, excepciones de pricing y evidencia de aprobación antes del envío al cliente." actions={<>{contexto}{guardar}{enviar}</>} />
      {createMutation.error || sendMutation.error ? <InlineNotice tone="danger">{createMutation.error ?? sendMutation.error}</InlineNotice> : null}
      {createMutation.status === 'success' ? <InlineNotice tone="success" title="Propuesta creada">Ya está en la cartera de propuestas como borrador. El siguiente paso es «Enviar al cliente».</InlineNotice> : null}

      <div className="space-y-4">
          <Panel title="Identificación de la propuesta" icon="description">
            {/*
              * Ni el número de propuesta ni su identificador se pintan al crear: eran dos cajas vacías
              * con el aviso de que ya se llenarían solas. El número aparece cuando existe; el
              * identificador interno no se enseña nunca, que a quien vende no le dice nada.
              */}
            <div className="grid gap-3 grid-cols-1 md:grid-cols-2 xl:grid-cols-4"><FormField tooltip="Oportunidad de la que nace la propuesta." kind="select" label="Oportunidad" name="opportunityId" required className="xl:col-span-2" options={[{ label: oportunidades.length ? '— Elija la oportunidad —' : '— No hay oportunidades registradas —', value: '' }, ...oportunidades]} /><FormField tooltip="Fecha hasta la que el cliente puede aceptar la propuesta." label="Válida hasta" name="validUntil" type="date" /><FormField tooltip="Ingreso mensual estimado en bolivianos si se acepta." label="Ingreso mensual estimado" name="totalEstimatedMonthlyRevenue" type="number" min="0" step="0.01" defaultValue="0" />{proposalNumber ? <FormField tooltip="Número con el que queda registrada la propuesta." name="" label="Número de propuesta" value={proposalNumber} readOnly tabIndex={-1} /> : null}</div>
          </Panel>

          <Panel
            title="Términos comerciales"
            description="Cada línea debe incluir porcentaje o monto fijo."
            icon="table_chart"
            action={
              <div className="flex flex-wrap items-center justify-end gap-2">
                <ResumenTarjeta icon="fact_check" tone={proposalId ? 'amber' : 'slate'} label="Estado" value={proposalId ? 'Borrador' : 'Sin guardar'} />
                <ResumenTarjeta icon="format_list_numbered" label="Términos" value={lines.length} />
                <ResumenTarjeta icon="payments" label="Base estimada" value={formatBob(estimated)} />
                {/* Sólo el icono: la fila de tarjetas ya dice de qué va la cabecera, y el rótulo la parta en dos líneas. */}
                <AtlasButton variant="secondary" icon="add" className="h-10 w-10 px-0" aria-label="Agregar término" title="Agregar término" onClick={() => setLines((current) => [...current, emptyLine(newUuid())])} />
              </div>
            }
          >
            <div className="table-scroll">
              <table className="min-w-[980px] w-full text-left text-xs"><thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500"><tr><th className="px-2 py-2">Tipo</th><th className="px-2 py-2">Descripción</th><th className="px-2 py-2">Tasa %</th><th className="px-2 py-2">Monto fijo</th><th className="px-2 py-2">Facturación</th><th className="px-2 py-2">Mínimo mensual</th><th /></tr></thead><tbody className="divide-y divide-slate-100">{lines.map((line) => <tr key={line.id}>
                <td className="p-2"><OptionSelect name={`termType-${line.id}`} ariaLabel="Tipo de término" compact value={line.termType} onChange={(value) => updateLine(line.id, 'termType', value)} options={lineOptions(tiposDeTermino, line.termType)} /></td>
                <td className="p-2"><input className="h-9 w-full rounded border border-slate-300 px-2" value={line.description} onChange={(event) => updateLine(line.id, 'description', event.target.value)} placeholder="Descripción contractual" minLength={3} maxLength={240} title="Escriba al menos 3 caracteres." required /></td>
                <td className="p-2"><input className="h-9 w-24 rounded border border-slate-300 px-2 text-right" type="number" min="0" max="100" step="0.01" title="Entre 0 y 100." value={line.ratePercent} onChange={(event) => updateLine(line.id, 'ratePercent', event.target.value)} /></td>
                <td className="p-2"><input className="h-9 w-28 rounded border border-slate-300 px-2 text-right" type="number" min="0" step="0.01" title="0 o más." value={line.fixedAmount} onChange={(event) => updateLine(line.id, 'fixedAmount', event.target.value)} /></td>
                <td className="p-2"><OptionSelect name={`billingTiming-${line.id}`} ariaLabel="Momento de cobro" compact value={line.billingTiming} onChange={(value) => updateLine(line.id, 'billingTiming', value)} options={lineOptions(momentosDeCobro, line.billingTiming)} /></td>
                <td className="p-2"><input className="h-9 w-28 rounded border border-slate-300 px-2 text-right" type="number" min="0" step="0.01" title="0 o más." value={line.minimumMonthlyAmount} onChange={(event) => updateLine(line.id, 'minimumMonthlyAmount', event.target.value)} /></td>
                <td className="p-2"><button type="button" aria-label="Eliminar línea" className="grid h-8 w-8 place-items-center rounded text-red-600 hover:bg-red-50" disabled={lines.length === 1} onClick={() => setLines((current) => current.filter((item) => item.id !== line.id))}><Icon name="delete" className="text-[18px]" /></button></td>
              </tr>)}</tbody></table>
            </div>
          </Panel>
          <Panel title="Excepción de tarifa" icon="warning"><FormField tooltip="Por qué se sale de la tarifa estándar; lo lee quien aprueba." kind="textarea" label="Justificación de excepción" name="pricingExceptionReason" minLength={5} maxLength={1000} hint="Déjela vacía si no hay excepción; si la escribe, al menos 5 caracteres." placeholder="Explique cualquier condición fuera de la política comercial estándar." /></Panel>
          <div className="flex justify-end"><AtlasButton type="submit" icon="save" loading={createMutation.isLoading}>Guardar propuesta</AtlasButton></div>
      </div>

      <Modal open={contextoAbierto} title="Contexto del cliente" description="Con qué reglas se guarda y se envía esta propuesta." icon="analytics" width="md" onClose={() => setContextoAbierto(false)}>
        <div className="space-y-3 text-xs">
          <Context label="Moneda" value="BOB" />
          <Context label="Trazabilidad" value="Habilitada" />
          <Context label="Envío" value={proposalId ? 'Disponible' : 'Pendiente'} />
          <Context label="Aprobación" value="Según excepción" />
        </div>
        <div className="mt-4"><InlineNotice tone="warning" title="Revisión comercial">Las excepciones de pricing pueden generar una aprobación pendiente antes del envío.</InlineNotice></div>
      </Modal>
    </form>
  );
}

/**
 * El resumen vivo de la propuesta, en la cabecera de los términos.
 *
 * Estaba en un carril a la derecha, que en una pantalla estrecha caa debajo de todo y en una ancha
 * robaba 340 px al único sitio donde de verdad se trabaja: la tabla de términos. Aquí cambia a la
 * vista de quien escribe la línea, que es cuando el número importa.
 */
function ResumenTarjeta({ icon, label, value, tone = 'navy' }: { icon: string; label: string; value: React.ReactNode; tone?: keyof typeof tonoDelChip }) {
  return (
    <article className="group flex items-center gap-2.5 rounded-xl border border-slate-200/90 bg-white/80 px-3 py-2 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_24px_-18px_rgba(15,23,42,0.28)] backdrop-blur-[2px] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_4px_10px_rgba(15,23,42,0.06),0_18px_36px_-20px_rgba(15,23,42,0.35)]">
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl transition-transform duration-200 ease-out group-hover:scale-110 ${tonoDelChip[tone]}`}><Icon name={icon} className="text-[18px]" /></span>
      <div className="min-w-0">
        <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">{label}</p>
        <div className="truncate text-sm font-bold tabular-nums tracking-tight text-slate-900">{value}</div>
      </div>
    </article>
  );
}

/* Dos paradas del mismo tono: basta para que el chip tenga volumen. */
const tonoDelChip = {
  navy: 'bg-gradient-to-br from-[#e2f1ef] to-[#cde5e2] text-[#00544d]',
  slate: 'bg-gradient-to-br from-slate-100 to-slate-200 text-slate-700',
  amber: 'bg-gradient-to-br from-amber-50 to-amber-100 text-amber-700',
};

function Context({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between border-b border-slate-100 pb-2 last:border-0"><span className="text-slate-500">{label}</span><b>{value}</b></div>; }
