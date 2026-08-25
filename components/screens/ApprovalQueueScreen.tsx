'use client';

import { useCallback, useEffect, useState } from 'react';
import { b2bService } from '@/services/b2bService';
import { AtlasButton } from '@/components/atlas/AtlasButton';
import { FormField } from '@/components/atlas/FormField';
import { Icon } from '@/components/atlas/Icon';
import { InlineNotice } from '@/components/atlas/InlineNotice';
import { MetricCard } from '@/components/atlas/MetricCard';
import { Panel } from '@/components/atlas/Panel';
import { WorkspaceHeader } from '@/components/atlas/WorkspaceHeader';
import { useAtlasMutation } from '@/hooks/useAtlasMutation';
import type { JsonObject, ResourceRow } from '@/services/types';
import { StatusPill } from '@/components/atlas/StatusPill';

export function ApprovalQueueScreen() {
  const [selectedStatus, setSelectedStatus] = useState<'APPROVED' | 'REJECTED'>('APPROVED');
  const mutation = useAtlasMutation(useCallback(({ id, body }: { id: string; body: JsonObject }) => b2bService.decideApproval(id, body), []));

  /* La cola se LEE. Antes esta pantalla admitia no tener de donde leerla y pedia un uuid tecleado. */
  const [pendientes, setPendientes] = useState<ResourceRow[]>([]);
  const [elegida, setElegida] = useState('');
  const [cargando, setCargando] = useState(true);
  const [errorLectura, setErrorLectura] = useState<string | null>(null);

  const recargar = useCallback(async () => {
    setCargando(true);
    try {
      setPendientes(await b2bService.listApprovals(true));
      setErrorLectura(null);
    } catch (fallo) {
      setErrorLectura(fallo instanceof Error ? fallo.message : 'No fue posible leer la cola.');
    } finally {
      setCargando(false);
    }
  }, []);
  useEffect(() => { void recargar(); }, [recargar]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await mutation.execute({ id: String(form.get('approvalId') ?? ''), body: { status: selectedStatus, reason: String(form.get('reason') ?? '') } });
      setElegida('');
      await recargar();
    } catch { /* controlled */ }
  }

  return (
    <div className="space-y-5">
      <WorkspaceHeader breadcrumbs={[{ label: 'CRM' }, { label: 'Aprobaciones' }]} title="Excepciones de MDR" description="Cola de decisiones para excepciones comerciales con justificación, impacto estimado y registro permanente." actions={<><AtlasButton variant="secondary" icon="filter_list">Filtros</AtlasButton><AtlasButton variant="secondary" icon="download">Exportar CSV</AtlasButton></>} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Pendientes" value={cargando ? '…' : pendientes.length} detail="Esperando decisión" icon="approval" /><MetricCard label="Impacto de margen" value="Por calcular" detail="Se evalúa por solicitud" icon="trending_down" tone="amber" /><MetricCard label="SLA de decisión" value="4 h" detail="Objetivo operativo" icon="schedule" tone="teal" /><MetricCard label="Doble control" value="Activo" detail="Toda decisión queda auditada" icon="verified_user" tone="purple" /></div>
      {errorLectura ? <InlineNotice tone="danger" title="No se pudo leer la cola">{errorLectura}</InlineNotice> : null}
      <div className="grid gap-4 grid-cols-[minmax(0,1fr)] xl:grid-cols-[minmax(0,1.4fr)_360px]">
        <Panel title="Exception Requests" icon="request_quote">
          {cargando ? <p className="py-10 text-center text-xs text-slate-500">Cargando…</p>
            : pendientes.length === 0 ? <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-6 py-16 text-center"><Icon name="check_circle" className="text-[38px] text-emerald-500" /><p className="mt-3 text-sm font-bold text-slate-700">No hay excepciones esperando</p><p className="mt-1 text-xs text-slate-500">Cuando una propuesta pida una excepción de MDR, aparecerá aquí.</p></div>
            : <div className="space-y-2">{pendientes.map((fila) => {
                const id = String(fila.id);
                return (
                  <button key={id} type="button" onClick={() => setElegida(id)} className={`w-full rounded-md border p-3 text-left ${elegida === id ? 'border-[#006a61] bg-emerald-50/40' : 'border-slate-200 hover:bg-slate-50'}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-bold">{String(fila.approvalType ?? 'Excepción')}</p>
                        <p className="mt-0.5 truncate text-[11px] text-slate-500">{String(fila.reason ?? 'Sin motivo registrado')}</p>
                      </div>
                      <StatusPill tone="warning">{String(fila.status ?? 'PENDING')}</StatusPill>
                    </div>
                  </button>
                );
              })}</div>}
        </Panel>
        <Panel title="Decisiones registradas" description="Registrar decisión sobre una aprobación existente" icon="history_edu">
          <form className="space-y-4" onSubmit={submit}><FormField kind="select" label="Solicitud" name="approvalId" required value={elegida} onChange={(evento) => setElegida(evento.target.value)} options={[{ label: pendientes.length ? '— Elija la solicitud —' : '— No hay solicitudes pendientes —', value: '' }, ...pendientes.map((fila) => ({ value: String(fila.id), label: `${String(fila.approvalType ?? '')} — ${String(fila.reason ?? '').slice(0, 50)}` }))]} hint="También puede elegirla en la lista de la izquierda." /><div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => setSelectedStatus('APPROVED')} className={`rounded-md border p-3 text-left ${selectedStatus === 'APPROVED' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200'}`}><Icon name="check_circle" className="text-emerald-600" /><p className="mt-1 text-xs font-bold">Aprobar</p></button><button type="button" onClick={() => setSelectedStatus('REJECTED')} className={`rounded-md border p-3 text-left ${selectedStatus === 'REJECTED' ? 'border-red-500 bg-red-50' : 'border-slate-200'}`}><Icon name="cancel" className="text-red-600" /><p className="mt-1 text-xs font-bold">Rechazar</p></button></div><FormField kind="textarea" label="Justificación" name="reason" required placeholder="Decisión fundamentada para auditoría..." />{mutation.error ? <InlineNotice tone="danger">{mutation.error}</InlineNotice> : null}{mutation.status === 'success' ? <InlineNotice tone="success">Decisión registrada correctamente.</InlineNotice> : null}<AtlasButton className="w-full" type="submit" icon={selectedStatus === 'APPROVED' ? 'check' : 'close'} loading={mutation.isLoading} variant={selectedStatus === 'APPROVED' ? 'success' : 'danger'}>{selectedStatus === 'APPROVED' ? 'Aprobar solicitud' : 'Rechazar solicitud'}</AtlasButton></form>
        </Panel>
      </div>
    </div>
  );
}
