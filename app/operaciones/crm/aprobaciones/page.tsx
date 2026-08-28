'use client';

import { useCallback, useState } from 'react';
import { CrudDirectory } from '@/components/screens/CrudDirectory';
import { b2bService } from '@/services/b2bService';
import type { JsonObject, ResourceRow } from '@/services/types';

/**
 * Cola de excepciones comerciales: el listado COMPLETO, no solo lo pendiente.
 *
 * La pantalla anterior pedía `onlyPending=true` y nada más, así que en cuanto una solicitud se
 * decidía desaparecía de la vista: quedaba una lista vacía y la impresión de que no había habido
 * nunca nada. Lo decidido es justamente lo que hay que poder consultar después —quién aprobó qué y
 * con qué justificación—, así que aquí se piden todas y el estado es un filtro.
 *
 * La decisión se toma DESDE la fila. Antes era una pestaña con un desplegable de solicitudes
 * pendientes: había que leer una en la tabla, cambiar de pestaña y volver a buscarla en una lista
 * que solo la nombraba por su tipo.
 */
export default function ApprovalsPage() {
  const [version, setVersion] = useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(() => b2bService.listApprovals(false), [version]);

  async function decidir(row: ResourceRow, payload: JsonObject) {
    const resultado = await b2bService.decideApproval(String(row.id ?? ''), payload);
    setVersion((value) => value + 1);
    return resultado;
  }

  return (
    <CrudDirectory
      moduleLabel="CRM"
      title="Excepciones comerciales"
      description="Solicitudes de excepción —MDR por debajo del mínimo y equivalentes— con su justificación, su decisión y quién la tomó."
      load={load}
      labelKey="approvalType"
      searchPlaceholder="Buscar por tipo de excepción o motivo…"
      emptyHint="Cuando una propuesta pida una excepción de MDR, aparecerá aquí."
      pageSize={25}
      columns={[
        { key: 'approvalType', label: 'Tipo' },
        { key: 'reason', label: 'Motivo' },
        { key: 'status', label: 'Estado', kind: 'status' },
        { key: 'proposalId', label: 'Propuesta', kind: 'mono' },
        { key: 'decidedAt', label: 'Decidida', kind: 'date' },
        { key: 'createdAt', label: 'Solicitada', kind: 'date' },
      ]}
      filters={[
        { key: 'status', label: 'Estado' },
        { key: 'approvalType', label: 'Tipo' },
      ]}
      extraActions={[
        {
          key: 'decidir',
          label: 'Registrar decisión',
          icon: 'gavel',
          /* Solo las que siguen esperando: sobre una decidida no hay nada que decidir. */
          enabled: (row) => String(row.status ?? '') === 'PENDING',
          form: {
            title: (row) => `Decidir la solicitud de ${String(row.approvalType ?? 'excepción')}`,
            description: 'Doble control: la justificación queda asociada a quien decide y se guarda para auditoría.',
            submitLabel: 'Registrar decisión',
            submit: decidir,
            fields: [
              { name: 'status', label: 'Decisión', type: 'select', required: true, span: 2, defaultValue: 'APPROVED', options: [{ label: 'Aprobar', value: 'APPROVED' }, { label: 'Rechazar', value: 'REJECTED' }] },
              { name: 'reason', label: 'Justificación', type: 'textarea', required: true, span: 2, placeholder: 'Decisión fundamentada para auditoría…' },
            ],
          },
        },
      ]}
      notice={{
        tone: 'info',
        title: 'Una decisión no se edita ni se borra',
        body: 'Es el registro de quién autorizó una excepción y por qué. Para cambiar de criterio se decide la siguiente solicitud, no se reescribe la anterior.',
      }}
    />
  );
}
