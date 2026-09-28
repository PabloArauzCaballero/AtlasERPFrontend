'use client';

import { useCallback, useMemo } from 'react';
import { LiveDirectoryScreen, type RowAction } from '@/components/screens/LiveDirectoryScreen';
import type { ActionField } from '@/components/screens/StructuredActionForm';
import { useOptions } from '@/hooks/useOptions';
import { b2bService } from '@/services/b2bService';
import { resolveOptions } from '@/services/domains';
import type { Option } from '@/services/optionLoaders';
import type { JsonObject, PageQuery, ResourceRow } from '@/services/types';

type ActivityStatus = 'PENDING' | 'DONE' | 'CANCELLED';

/**
 * Las palabras de cada estado. Los valores válidos y su ayuda los publica el servidor
 * (`crm.activityStatus`); esto es sólo cómo se lee la columna mientras el catálogo llega.
 */
const STATUS_LABELS: Record<ActivityStatus, string> = {
  PENDING: 'Pendiente',
  DONE: 'Hecha',
  CANCELLED: 'Cancelada',
};

/** El detalle entero no cabe en una fila: se enseña el principio y el resto va en la ficha. */
function resumen(texto: unknown): string {
  const limpio = String(texto ?? '').replace(/\s+/g, ' ').trim();
  if (!limpio) return '—';
  return limpio.length > 32 ? `${limpio.slice(0, 31)}…` : limpio;
}

/**
 * El valor de un `datetime-local` es hora LOCAL. Cortar el ISO del servidor (`…T19:00Z`) enseñaba
 * la hora de Greenwich: una reunión de las 15:00 en La Paz aparecía a las 19:00 al reprogramarla.
 */
function aHoraLocal(valor: unknown): string {
  if (typeof valor !== 'string' || !valor) return '';
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return '';
  return new Date(fecha.getTime() - fecha.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

/** Sólo el nombre: el código del rol («COMMERCIAL_EXECUTIVE») no le dice nada a quien opera. */
const loadResponsables = async (): Promise<Option[]> =>
  (await b2bService.listInternalUsers())
    .filter((user) => user.id)
    .map((user) => ({ value: String(user.id), label: String(user.fullName ?? user.email ?? 'Sin nombre') }));

const loadActivityTypes = () => resolveOptions('domain:crm.activityType');
const loadActivityStatuses = () => resolveOptions('domain:crm.activityStatus');

/**
 * «Actividad y tareas» de la ficha de una cuenta B2B (y, si se pasa, de una oportunidad).
 *
 * Era un formulario abierto encima de un timeline que traía TODAS las actividades de una vez, sin
 * buscar ni filtrar, y sólo sabía «Completar» una tarea: una que ya no se iba a hacer había que
 * borrarla. Ahora es la forma estándar del ERP (`LiveDirectoryScreen`): tabla paginada en el
 * servidor con buscador y filtros por tipo y estado, alta en un modal desde «Añadir actividad», y
 * el estado —pendiente, hecha o cancelada— se cambia desde la fila.
 */
export function AccountActivitiesPanel({ accountId, opportunityId }: { accountId: string; opportunityId?: string }) {
  const activityTypes = useOptions(loadActivityTypes);
  const activityStatuses = useOptions(loadActivityStatuses);
  const typeLabels = useMemo(
    () => Object.fromEntries(activityTypes.map((option) => [option.value, option.label])),
    [activityTypes],
  );

  const load = useCallback(
    async (query: PageQuery) => {
      const page = await b2bService.listActivities({ ...query, accountId, ...(opportunityId ? { opportunityId } : {}) });
      // «Fecha»: la programada si la tiene; si no, cuándo se registró. Dos columnas de fecha empujaban
      // las acciones de la fila fuera de la pantalla.
      const items = (page.items ?? page.rows ?? []).map((row) => ({ ...row, fecha: row.dueAt ?? row.createdAt, detalleCorto: resumen(row.description) }));
      return { ...page, items };
    },
    [accountId, opportunityId],
  );

  const createFields: ActionField[] = [
    {
      name: 'activityType',
      label: 'Tipo',
      tooltip: 'Qué clase de gestión fue: una nota, una llamada, una reunión o una tarea por hacer.',
      optionsSource: 'domain:crm.activityType',
      required: true,
      defaultValue: 'NOTE',
    },
    {
      name: 'ownerUserId',
      label: 'Responsable',
      tooltip: 'Ejecutivo comercial que responde por esta actividad; es quien la ve en sus pendientes.',
      optionsLoader: loadResponsables,
      required: true,
    },
    {
      name: 'subject',
      label: 'Asunto',
      tooltip: 'Una línea que diga de qué se trata, para reconocerla en la tabla sin abrirla.',
      placeholder: 'Llamada de seguimiento, propuesta enviada…',
      required: true,
      span: 2,
    },
    {
      name: 'dueAt',
      label: 'Fecha programada',
      type: 'datetime',
      tooltip: 'Cuándo tiene que hacerse. Si la pones, la actividad queda pendiente hasta que la marques como hecha.',
      hint: 'Déjala vacía para anotar algo que ya ocurrió: queda como hecha.',
      span: 2,
    },
    {
      name: 'description',
      label: 'Detalle',
      type: 'textarea',
      tooltip: 'Qué se habló o qué hay que hacer, para quien lo lea después.',
      placeholder: 'Acuerdos, próximos pasos…',
      span: 2,
    },
  ];

  async function create(payload: JsonObject) {
    const due = typeof payload.dueAt === 'string' && payload.dueAt ? payload.dueAt : null;
    const description = typeof payload.description === 'string' ? payload.description.trim() : '';
    await b2bService.createActivity({
      accountId,
      ...(opportunityId ? { opportunityId } : {}),
      ownerUserId: String(payload.ownerUserId ?? ''),
      activityType: String(payload.activityType ?? 'NOTE'),
      subject: String(payload.subject ?? '').trim(),
      ...(description ? { description } : {}),
      ...(due ? { dueAt: new Date(due).toISOString() } : {}),
    });
  }

  function rowActions(row: ResourceRow): RowAction[] {
    const id = row.id ? String(row.id) : '';
    if (!id) return [];
    const status = String(row.status ?? 'PENDING') as ActivityStatus;
    const subject = String(row.subject ?? 'esta actividad');
    const setStatus = (next: ActivityStatus) => async () => { await b2bService.setActivityStatus(id, next); };

    const hecha: RowAction = {
      key: 'hecha', label: 'Hecha', icon: 'task_alt', primary: true,
      description: 'Marca la actividad como hecha; deja de figurar entre los pendientes.',
      onClick: setStatus('DONE'),
    };
    const cancelar: RowAction = {
      key: 'cancelar', label: 'Cancelar', icon: 'block', primary: true, tone: 'danger',
      description: 'La actividad no se va a hacer. Se conserva en la cuenta para saber que se decidió así.',
      onClick: setStatus('CANCELLED'),
      confirm: {
        title: 'Cancelar actividad',
        message: `«${subject}» quedará como cancelada. Podrás volver a ponerla como pendiente cuando quieras.`,
        confirmLabel: 'Cancelar actividad', tone: 'danger', successMessage: 'Actividad cancelada',
      },
    };
    const pendiente: RowAction = {
      key: 'pendiente', label: 'Pendiente', icon: 'undo', primary: true,
      description: 'Vuelve a poner la actividad como pendiente.',
      onClick: setStatus('PENDING'),
    };
    const reprogramar: RowAction = {
      key: 'reprogramar', label: 'Reprogramar', icon: 'event_repeat',
      description: 'Cambia sólo la fecha programada. El asunto y el detalle no se tocan: reescribirlos cambiaría lo que se dijo que pasó.',
      form: {
        title: () => `Reprogramar «${subject}»`,
        description: 'Se cambia sólo la fecha programada; el asunto y el detalle quedan como están.',
        submitLabel: 'Reprogramar',
        fields: [{
          name: 'dueAt', label: 'Nueva fecha programada', type: 'datetime', required: true, span: 2,
          tooltip: 'Nueva fecha y hora en que tiene que hacerse.',
          defaultValue: aHoraLocal(row.dueAt),
        }],
        submit: async (_row, payload) => {
          await b2bService.updateActivity(id, { dueAt: new Date(String(payload.dueAt)).toISOString() });
        },
      },
    };
    const eliminar: RowAction = {
      key: 'eliminar', label: 'Eliminar', icon: 'delete', tone: 'danger',
      description: 'Borra la actividad de la cuenta. Si sólo no se va a hacer, mejor cancélala: así queda constancia.',
      onClick: async () => { await b2bService.deleteActivity(id); },
      confirm: {
        title: 'Eliminar actividad',
        message: `«${subject}» se borrará de la cuenta y no se podrá recuperar.`,
        confirmLabel: 'Eliminar', tone: 'danger', successMessage: 'Actividad eliminada',
      },
    };

    if (status === 'PENDING') return [hecha, cancelar, reprogramar, eliminar];
    if (status === 'DONE') return [pendiente, { ...cancelar, primary: false }, eliminar];
    return [pendiente, { ...hecha, primary: false }, eliminar];
  }

  return (
    <section data-testid="actividades-cuenta">
      <LiveDirectoryScreen
        embedded
        moduleLabel="CRM"
        title="Actividad y tareas"
        description="Notas, llamadas, reuniones y tareas de la cuenta. Marca cada una como hecha, cancelada o pendiente desde su fila."
        load={load}
        createLabel="Añadir actividad"
        create={{
          title: 'Añadir actividad',
          description: 'Una tarea o algo con fecha programada queda pendiente; lo demás se anota como hecho.',
          icon: 'add_task',
          fields: createFields,
          submit: create,
        }}
        searchPlaceholder="Buscar por asunto, detalle o responsable..."
        statusOptions={activityStatuses.length ? activityStatuses : Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))}
        filters={[{ key: 'activityType', label: 'Tipo', options: activityTypes }]}
        columns={[
          { key: 'subject', label: 'Asunto' },
          { key: 'activityType', label: 'Tipo', labels: typeLabels },
          { key: 'status', label: 'Estado', kind: 'status', labels: STATUS_LABELS },
          { key: 'ownerName', label: 'Responsable' },
          { key: 'fecha', label: 'Fecha', kind: 'datetime' },
          { key: 'detalleCorto', label: 'Detalle' },
        ]}
        /* Sin tira de números: el total ya está al pie de la tabla y el filtro «Pendiente» cuenta los que faltan. */
        metrics={[]}
        rowActions={rowActions}
      />
    </section>
  );
}
