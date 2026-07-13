'use client';

import { useCallback, useState } from 'react';
import { b2bService } from '@/services/b2bService';
import { AtlasButton } from '@/components/atlas/AtlasButton';
import { FormField } from '@/components/atlas/FormField';
import { Icon } from '@/components/atlas/Icon';
import { InlineNotice } from '@/components/atlas/InlineNotice';
import { MetricCard } from '@/components/atlas/MetricCard';
import { Panel } from '@/components/atlas/Panel';
import { WorkspaceHeader } from '@/components/atlas/WorkspaceHeader';
import { useAtlasMutation } from '@/hooks/useAtlasMutation';
import type { JsonObject } from '@/services/types';

export function ApprovalQueueScreen() {
  const [selectedStatus, setSelectedStatus] = useState<'APPROVED' | 'REJECTED'>('APPROVED');
  const mutation = useAtlasMutation(useCallback(({ id, body }: { id: string; body: JsonObject }) => b2bService.decideApproval(id, body), []));

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try { await mutation.execute({ id: String(form.get('approvalId') ?? ''), body: { status: selectedStatus, reason: String(form.get('reason') ?? '') } }); } catch { /* controlled */ }
  }

  return (
    <div className="space-y-5">
      <WorkspaceHeader breadcrumbs={[{ label: 'CRM' }, { label: 'Aprobaciones' }]} title="MDR Exception Queue" description="Cola de decisiones para excepciones comerciales con justificación, impacto estimado y registro permanente." actions={<><AtlasButton variant="secondary" icon="filter_list">Filtros</AtlasButton><AtlasButton variant="secondary" icon="download">Exportar CSV</AtlasButton></>} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Pendientes visibles" value="—" detail="Sin endpoint GET en contrato actual" icon="approval" /><MetricCard label="Impacto de margen" value="Por calcular" detail="Se evalúa por solicitud" icon="trending_down" tone="amber" /><MetricCard label="SLA de decisión" value="4 h" detail="Objetivo operativo" icon="schedule" tone="teal" /><MetricCard label="Doble control" value="Activo" detail="Toda decisión queda auditada" icon="verified_user" tone="purple" /></div>
      <InlineNotice tone="info" title="Cola sin lectura disponible">El backend actual solo expone la decisión PATCH. La interfaz no inventa solicitudes pendientes; permite actuar sobre un UUID obtenido del flujo de propuesta.</InlineNotice>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_360px]">
        <Panel title="Exception Requests" icon="request_quote">
          <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-6 py-16 text-center"><Icon name="inbox" className="text-[42px] text-slate-300" /><p className="mt-3 text-sm font-bold text-slate-700">No existe endpoint para listar aprobaciones</p><p className="mx-auto mt-1 max-w-xl text-xs leading-5 text-slate-500">Cuando el backend exponga la consulta, este panel mostrará solicitante, propuesta, MDR solicitado, umbral, impacto de margen, antigüedad y responsable.</p></div>
        </Panel>
        <Panel title="Decision Log" description="Registrar decisión sobre una aprobación existente" icon="history_edu">
          <form className="space-y-4" onSubmit={submit}><FormField label="UUID de aprobación" name="approvalId" required /><div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => setSelectedStatus('APPROVED')} className={`rounded-md border p-3 text-left ${selectedStatus === 'APPROVED' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200'}`}><Icon name="check_circle" className="text-emerald-600" /><p className="mt-1 text-xs font-bold">Aprobar</p></button><button type="button" onClick={() => setSelectedStatus('REJECTED')} className={`rounded-md border p-3 text-left ${selectedStatus === 'REJECTED' ? 'border-red-500 bg-red-50' : 'border-slate-200'}`}><Icon name="cancel" className="text-red-600" /><p className="mt-1 text-xs font-bold">Rechazar</p></button></div><FormField kind="textarea" label="Justificación" name="reason" required placeholder="Decisión fundamentada para auditoría..." />{mutation.error ? <InlineNotice tone="danger">{mutation.error}</InlineNotice> : null}{mutation.status === 'success' ? <InlineNotice tone="success">Decisión registrada correctamente.</InlineNotice> : null}<AtlasButton className="w-full" type="submit" icon={selectedStatus === 'APPROVED' ? 'check' : 'close'} loading={mutation.isLoading} variant={selectedStatus === 'APPROVED' ? 'success' : 'danger'}>{selectedStatus === 'APPROVED' ? 'Aprobar solicitud' : 'Rechazar solicitud'}</AtlasButton></form>
        </Panel>
      </div>
    </div>
  );
}
