'use client';

import { useCallback } from 'react';
import { CrudDirectory } from '@/components/screens/CrudDirectory';
import { accountingService } from '@/services/accountingService';
import type { ResourceRow } from '@/services/types';

/** El backend deja cerrar sólo un período abierto, y reabrir sólo uno que no lo esté. */
const abierto = (row: ResourceRow) => row.isOpen === true && String(row.closeStatus ?? '') === 'OPEN';

/**
 * La entidad legal del período, sacada de su año fiscal.
 *
 * El cierre la exige y el listado de períodos no la trae: cuelga del año fiscal. Pedirla en un
 * desplegable era dejar que alguien cerrara el período con otra entidad y recibiera un 409.
 */
async function entidadLegalDe(row: ResourceRow): Promise<string> {
  const anios = await accountingService.listFiscalYears();
  const anio = anios.find((fila) => String(fila.id ?? '') === String(row.fiscalYearId ?? ''));
  const entidad = String(anio?.legalEntityId ?? '');
  if (!entidad) throw new Error('No se encontró el año fiscal de este período, así que no se sabe a qué entidad legal pertenece.');
  return entidad;
}

/**
 * Cierre de períodos: la tabla y, en cada fila, la operación que le toca.
 *
 * Tenía tres pestañas —el estado, «Cerrar período» y «Reapertura controlada»— y las dos últimas
 * volvían a pedir en desplegables la entidad y el período que la tabla ya mostraba. Cerrar y reabrir
 * son operaciones SOBRE un período: van en su fila, y cada una sólo aparece donde el backend la
 * acepta. La columna de estado leía `status`, que el período no tiene (`closeStatus`), y salía vacía.
 */
export default function PeriodClosingPage() {
  const load = useCallback(() => accountingService.listAccountingPeriods(), []);

  return (
    <CrudDirectory
      moduleLabel="Contabilidad"
      title="Cierre de períodos"
      description="Qué períodos están abiertos y cuáles cerrados. Cerrar y reabrir se hacen desde la fila del período."
      load={load}
      labelKey="periodNo"
      searchPlaceholder="Buscar por número o estado…"
      columns={[
        { key: 'periodNo', label: 'Período', kind: 'mono' },
        { key: 'startDate', label: 'Desde', kind: 'date' },
        { key: 'endDate', label: 'Hasta', kind: 'date' },
        { key: 'closeStatus', label: 'Estado', kind: 'status' },
        { key: 'closedAt', label: 'Cerrado el', kind: 'date' },
      ]}
      filters={[{ key: 'closeStatus', label: 'Estado' }]}
      notice={{
        tone: 'info',
        title: 'El cierre no es un borrado',
        body: 'Cerrar un período no elimina nada: bloquea nuevas contabilizaciones con esa fecha. Por eso aquí no hay papelera, sino el candado de cada fila: cerrar si está abierto, reabrir si no.',
      }}
      extraActions={[
        {
          key: 'cerrar',
          label: 'Cerrar período',
          icon: 'lock',
          enabled: abierto,
          form: {
            title: (row) => `Cerrar el período ${String(row.periodNo ?? '')}`,
            description: 'Bloquea nuevas contabilizaciones en el período. Antes de cerrarlo, el backend comprueba sus controles de cierre.',
            fields: [
              { name: 'closeType', label: 'Tipo de cierre', tooltip: 'Cierre blando (se puede reabrir) o duro (definitivo, para auditoría).', required: true, span: 2, defaultValue: 'MONTHLY', optionsSource: 'domain:accounting.periodCloseType' },
            ],
            submit: async (row, payload) =>
              accountingService.closePeriod({ legalEntityId: await entidadLegalDe(row), periodId: String(row.id ?? ''), closeType: String(payload.closeType ?? 'MONTHLY') }),
            submitLabel: 'Cerrar período',
          },
        },
        {
          key: 'reabrir',
          label: 'Reapertura controlada',
          icon: 'lock_open',
          tone: 'danger',
          enabled: (row) => !abierto(row),
          form: {
            title: (row) => `Reabrir el período ${String(row.periodNo ?? '')}`,
            description: 'Rehabilita temporalmente un período cerrado. Exige motivo documentado y queda en auditoría.',
            fields: [
              { name: 'reason', label: 'Motivo documentado', tooltip: 'Por qué se cierra o reabre el período; lo exige auditoría.', type: 'textarea', required: true, span: 3, placeholder: 'Mínimo 5 caracteres: qué hay que corregir y quién lo autorizó.' },
            ],
            submit: (row, payload) => accountingService.reopenPeriod({ periodId: String(row.id ?? ''), reason: String(payload.reason ?? '') }),
            submitLabel: 'Reabrir período',
          },
        },
      ]}
    />
  );
}
