'use client';

import { useCallback, useState } from 'react';
import { AtlasButton } from '@/components/atlas/AtlasButton';
import { FormField } from '@/components/atlas/FormField';
import { InlineNotice } from '@/components/atlas/InlineNotice';
import { Modal } from '@/components/atlas/Modal';
import { StatusPill } from '@/components/atlas/StatusPill';
import { useAsyncResource } from '@/hooks/useAsyncResource';
import { toast } from '@/lib/toast';
import { notificationCampaignsService, type AudienceDefinition, type AudienceSegment } from '@/services/notificationCampaignsService';
import { AudienceBuilder } from './AudienceBuilder';
import { describeRule, errorMessage, formatCount, formatDateTime } from './campaignCatalog';

/**
 * Segmentos guardados: la tabla primero, «Nuevo segmento» arriba y editar o archivar desde la fila.
 *
 * Un segmento archivado no se borra: las campañas guardan su propia copia de las reglas, pero el
 * nombre sigue siendo la procedencia de lo que se envió.
 */
export function SegmentsPanel() {
  const [status, setStatus] = useState<'active' | 'archived'>('active');
  const [editing, setEditing] = useState<AudienceSegment | 'new' | null>(null);
  const list = useAsyncResource(useCallback(() => notificationCampaignsService.segments(status), [status]));
  const rows = list.data?.data ?? [];

  async function toggleArchive(segment: AudienceSegment) {
    try {
      await notificationCampaignsService.updateSegment(segment.id, { status: segment.status === 'active' ? 'archived' : 'active' });
      toast.success(segment.status === 'active' ? 'Segmento archivado' : 'Segmento restaurado', segment.name);
      await list.reload();
    } catch (failure) {
      toast.error('No se pudo cambiar el segmento', errorMessage(failure));
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <FormField kind="select" label="Mostrar" name="segmentStatus" hint="Los archivados no se ofrecen al crear campañas." className="w-56" value={status} options={[{ value: 'active', label: 'Segmentos activos' }, { value: 'archived', label: 'Segmentos archivados' }]} onChange={(event) => setStatus(event.target.value as 'active' | 'archived')} />
        <AtlasButton icon="group_add" onClick={() => setEditing('new')}>Nuevo segmento</AtlasButton>
      </div>
      {list.error ? <InlineNotice tone="danger" title="No se pudieron cargar los segmentos">{list.error}</InlineNotice> : null}
      <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
            <tr><th className="px-3 py-2 text-left">Segmento</th><th className="px-3 py-2 text-left">Condiciones</th><th className="px-3 py-2 text-right" title="Tamaño bruto del segmento. Una campaña comercial alcanza sólo a quien aceptó promociones, y ese número se ve al armarla.">Personas</th><th className="px-3 py-2 text-left">Calculado</th><th className="px-3 py-2 text-right">Acciones</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((segment) => (
              <tr key={segment.id}>
                <td className="px-3 py-2"><p className="font-bold text-slate-900">{segment.name}</p>{segment.description ? <p className="text-slate-500">{segment.description}</p> : null}</td>
                <td className="px-3 py-2 text-slate-700">{segment.definition.rules.length ? segment.definition.rules.map(describeRule).join(segment.definition.match === 'any' ? ' · o · ' : ' · y · ') : 'Todos los clientes activos'}</td>
                <td className="px-3 py-2 text-right tabular-nums">{segment.lastEstimate ? formatCount(segment.lastEstimate.total) : '—'}</td>
                <td className="px-3 py-2">{formatDateTime(segment.lastEstimatedAt)}</td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-1">
                    {segment.status === 'active' ? <AtlasButton variant="ghost" icon="edit" onClick={() => setEditing(segment)}>Editar</AtlasButton> : <StatusPill tone="neutral">Archivado</StatusPill>}
                    <AtlasButton variant="ghost" icon={segment.status === 'active' ? 'archive' : 'unarchive'} onClick={() => void toggleArchive(segment)}>{segment.status === 'active' ? 'Archivar' : 'Restaurar'}</AtlasButton>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && list.status !== 'loading' ? <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-500">{status === 'active' ? 'Sin segmentos guardados. Crea uno para reutilizarlo en varias campañas.' : 'No hay segmentos archivados.'}</td></tr> : null}
          </tbody>
        </table>
      </div>
      {editing ? (
        <SegmentEditor
          segment={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void list.reload();
          }}
        />
      ) : null}
    </div>
  );
}

function SegmentEditor({ segment, onClose, onSaved }: { segment: AudienceSegment | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(segment?.name ?? '');
  const [description, setDescription] = useState(segment?.description ?? '');
  const [definition, setDefinition] = useState<AudienceDefinition>(segment?.definition ?? { match: 'all', rules: [] });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const input = { name: name.trim(), description: description.trim() || null, definition };
      if (segment) await notificationCampaignsService.updateSegment(segment.id, input);
      else await notificationCampaignsService.createSegment(input);
      toast.success(segment ? 'Segmento actualizado' : 'Segmento guardado', input.name);
      onSaved();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      title={segment ? `Editar «${segment.name}»` : 'Nuevo segmento de audiencia'}
      description="Reglas sobre datos del cliente. El tamaño se calcula en vivo."
      icon="groups"
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <AtlasButton variant="ghost" onClick={onClose}>Cancelar</AtlasButton>
          <AtlasButton icon="save" loading={saving} disabled={name.trim().length < 3 || saving} onClick={() => void save()}>Guardar segmento</AtlasButton>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <FormField label="Nombre" name="segmentName" required hint="Único entre los activos. Ej.: Mora temprana El Alto." value={name} onChange={(event) => setName(event.target.value)} />
          <FormField label="Descripción (opcional)" name="segmentDescription" hint="Para qué se usa." value={description} onChange={(event) => setDescription(event.target.value)} />
        </div>
        <AudienceBuilder value={definition} onChange={setDefinition} purpose="marketing" />
        {error ? <InlineNotice tone="danger" title="No se pudo guardar">{error}</InlineNotice> : null}
      </div>
    </Modal>
  );
}
