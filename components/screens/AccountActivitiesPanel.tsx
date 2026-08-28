'use client';

import { useCallback, useState } from 'react';
import { ActionFormModal } from '@/components/screens/ActionFormModal';
import { b2bService } from '@/services/b2bService';
import { useAsyncResource } from '@/hooks/useAsyncResource';
import { useOptions } from '@/hooks/useOptions';
import { loadInternalUsers } from '@/services/optionLoaders';
import { AtlasButton } from '@/components/atlas/AtlasButton';
import { FormField } from '@/components/atlas/FormField';
import { Icon } from '@/components/atlas/Icon';
import { InlineNotice } from '@/components/atlas/InlineNotice';
import { Panel } from '@/components/atlas/Panel';
import { StatusPill } from '@/components/atlas/StatusPill';
import { formatDate } from '@/lib/formatters';
import type { JsonObject, ResourceRow } from '@/services/types';

const activityTypeOptions = [
  { label: 'Nota', value: 'NOTE' },
  { label: 'Llamada', value: 'CALL' },
  { label: 'Reunión', value: 'MEETING' },
  { label: 'Correo', value: 'EMAIL' },
  { label: 'WhatsApp', value: 'WHATSAPP' },
  { label: 'Visita', value: 'VISIT' },
  { label: 'Tarea / recordatorio', value: 'TASK' },
  { label: 'Otro', value: 'OTHER' },
];

const typeIcon: Record<string, string> = {
  NOTE: 'sticky_note_2', CALL: 'call', MEETING: 'groups', EMAIL: 'mail',
  WHATSAPP: 'chat', VISIT: 'place', TASK: 'task_alt', OTHER: 'bolt',
};

const emptyForm = { activityType: 'NOTE', subject: '', description: '', ownerUserId: '', dueAt: '' };

export function AccountActivitiesPanel({ accountId, opportunityId }: { accountId: string; opportunityId?: string }) {
  const load = useCallback(
    () => b2bService.listActivities(opportunityId ? { accountId, opportunityId } : { accountId }),
    [accountId, opportunityId],
  );
  const resource = useAsyncResource(load, Boolean(accountId));
  const activities = (resource.data ?? []) as ResourceRow[];
  const internalUsers = useOptions(loadInternalUsers);

  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [reprogramando, setReprogramando] = useState<ResourceRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const setField = (key: keyof typeof emptyForm) => (value: string) => setForm((c) => ({ ...c, [key]: value }));

  async function addActivity() {
    setSaving(true);
    setError(null);
    try {
      const body: JsonObject = {
        accountId,
        ownerUserId: form.ownerUserId.trim(),
        activityType: form.activityType,
        subject: form.subject.trim(),
        ...(opportunityId ? { opportunityId } : {}),
        ...(form.description.trim() ? { description: form.description.trim() } : {}),
        ...(form.dueAt ? { dueAt: new Date(form.dueAt).toISOString() } : {}),
      };
      await b2bService.createActivity(body);
      setForm((c) => ({ ...emptyForm, ownerUserId: c.ownerUserId, activityType: c.activityType }));
      await resource.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar la actividad.');
    } finally {
      setSaving(false);
    }
  }

  async function complete(id: unknown) {
    try { await b2bService.completeActivity(String(id)); await resource.reload(); }
    catch (err) { setError(err instanceof Error ? err.message : 'No se pudo completar.'); }
  }
  /**
   * Reprogramar una tarea.
   *
   * `PATCH /b2b/activities/:id` existía con su método en el servicio y el panel sólo sabía crear,
   * completar y borrar: una tarea con fecha equivocada había que borrarla y volver a escribirla,
   * perdiendo su historia. Se corrige lo que de verdad cambia —cuándo vence— y no el asunto: cambiar
   * el asunto de una actividad ya registrada reescribe lo que se dijo que pasó.
   */
  async function reprogramar(activity: ResourceRow, payload: JsonObject) {
    await b2bService.updateActivity(String(activity.id), { dueAt: new Date(String(payload.dueAt)).toISOString() });
    setReprogramando(null);
    await resource.reload();
  }

  async function remove(id: unknown) {
    try { await b2bService.deleteActivity(String(id)); await resource.reload(); }
    catch (err) { setError(err instanceof Error ? err.message : 'No se pudo eliminar.'); }
  }

  const canSave = form.subject.trim() && form.ownerUserId.trim();

  return (
    <Panel title="Actividad y tareas" description="Notas, llamadas, reuniones y tareas/recordatorios de la cuenta (timeline)." icon="history_edu">
      <div className="mb-4 space-y-3 rounded-md border border-slate-200 bg-slate-50 p-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField kind="select" label="Tipo" name="activityType" value={form.activityType} onChange={(e) => setField('activityType')(e.target.value)} options={activityTypeOptions} />
          <FormField label="Vencimiento (para tareas)" name="dueAt" type="datetime-local" value={form.dueAt} onChange={(e) => setField('dueAt')(e.target.value)} />
        </div>
        <FormField label="Asunto" name="subject" required value={form.subject} onChange={(e) => setField('subject')(e.target.value)} placeholder="Llamada de seguimiento, propuesta enviada..." />
        <FormField kind="textarea" label="Detalle" name="description" value={form.description} onChange={(e) => setField('description')(e.target.value)} placeholder="Notas de la interacción..." />
        <FormField kind="select" label="Responsable" name="ownerUserId" required value={form.ownerUserId} onChange={(e) => setField('ownerUserId')(e.target.value)} options={[{ label: '— Seleccione responsable —', value: '' }, ...internalUsers]} hint="Usuario comercial responsable de la actividad." />
        {error ? <InlineNotice tone="danger" title="Error">{error}</InlineNotice> : null}
        <AtlasButton icon="add" loading={saving} disabled={!canSave} onClick={addActivity}>Registrar actividad</AtlasButton>
      </div>

      {resource.error && !activities.length ? <InlineNotice tone="warning" title="No se pudo cargar el timeline">{resource.error}</InlineNotice> : null}
      {activities.length ? (
        <ol className="space-y-3">
          {activities.map((activity) => {
            const type = String(activity.activityType ?? 'NOTE');
            const isTask = Boolean(activity.dueAt);
            const done = Boolean(activity.completedAt);
            return (
              <li key={String(activity.id)} className="flex gap-3">
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary-wash text-primary"><Icon name={typeIcon[type] ?? 'bolt'} className="text-[16px]" /></span>
                <div className="min-w-0 flex-1 rounded-md border border-slate-200 p-2.5">
                  <div className="flex items-center gap-2">
                    <b className="truncate text-xs text-slate-800">{String(activity.subject ?? '—')}</b>
                    {isTask ? <StatusPill tone={done ? 'success' : 'warning'} dot={false}>{done ? 'Completada' : 'Pendiente'}</StatusPill> : <StatusPill tone="neutral" dot={false}>{type}</StatusPill>}
                  </div>
                  {activity.description ? <p className="mt-1 text-[11px] leading-4 text-slate-600">{String(activity.description)}</p> : null}
                  <div className="mt-1 flex items-center gap-3 text-[10px] text-slate-500">
                    <span>Creada {formatDate(typeof activity.createdAt === 'string' ? activity.createdAt : undefined)}</span>
                    {isTask ? <span>· Vence {formatDate(typeof activity.dueAt === 'string' ? activity.dueAt : undefined)}</span> : null}
                    <span className="ml-auto flex gap-2">
                      {isTask && !done ? <button className="font-bold text-emerald-700 hover:underline" onClick={() => complete(activity.id)}>Completar</button> : null}
                      {isTask && !done ? <button className="font-bold text-slate-600 hover:underline" onClick={() => setReprogramando(activity)}>Reprogramar</button> : null}
                      <button className="font-bold text-red-600 hover:underline" onClick={() => remove(activity.id)}>Eliminar</button>
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      ) : !resource.error ? (
        <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-5 py-6 text-center">
          <Icon name="history" className="text-[28px] text-slate-400" />
          <p className="mt-2 text-xs font-bold text-slate-700">Sin actividad registrada</p>
          <p className="mt-1 text-[11px] text-slate-500">Registre la primera nota, llamada o tarea de esta cuenta.</p>
        </div>
      ) : null}
      {reprogramando ? (
        <ActionFormModal
          open
          icon="event_repeat"
          title={`Reprogramar «${String(reprogramando.subject ?? '')}»`}
          description="Se cambia sólo el vencimiento. El asunto y el detalle no se tocan: reescribirlos cambiaría lo que se dijo que pasó."
          submitLabel="Reprogramar"
          fields={[{ name: 'dueAt', label: 'Nuevo vencimiento', type: 'datetime', required: true, span: 2, defaultValue: typeof reprogramando.dueAt === 'string' ? reprogramando.dueAt.slice(0, 16) : '' }]}
          onClose={() => setReprogramando(null)}
          onSubmit={(payload) => reprogramar(reprogramando, payload)}
        />
      ) : null}
    </Panel>
  );
}
