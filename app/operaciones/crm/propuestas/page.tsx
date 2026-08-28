/*
 * Cliente, y no servidor, porque esta pagina pasa una FUNCION (`load`) a un componente de cliente.
 *
 * Un componente de servidor no puede pasar una funcion a uno de cliente —hay que serializarla para
 * cruzar el limite y una funcion no se serializa—, asi que el prerender fallaba con «Functions
 * cannot be passed directly to Client Components» y tumbaba la construccion entera.
 */
'use client';

import { useCallback, useState } from 'react';
import { TabbedPanels } from '@/components/atlas/TabbedPanels';
import { WorkspaceHeader } from '@/components/atlas/WorkspaceHeader';
import { CrudDirectory } from '@/components/screens/CrudDirectory';
import { InlineActionForm } from '@/components/screens/InlineActionForm';
import { ProposalManagerScreen } from '@/components/screens/ProposalManagerScreen';
import { b2bService } from '@/services/b2bService';
import { loadProposals } from '@/services/optionLoaders';
import type { JsonObject, ResourceRow } from '@/services/types';

/** Estados en los que la propuesta todavía es un borrador y admite correcciones. */
const EDITABLES = new Set(['DRAFT', 'PENDING_APPROVAL']);
/** A los anteriores se suma la rechazada: ya no vale para nada y puede retirarse del listado. */
const BORRABLES = new Set(['DRAFT', 'PENDING_APPROVAL', 'REJECTED']);

const estado = (row: ResourceRow) => String(row.status ?? '').toUpperCase();

/**
 * Propuestas comerciales: primero la cartera, después el constructor.
 *
 * Antes esta vista abría con el formulario de alta y dejaba el listado como un panel de resumen
 * truncado encima. La pregunta que trae a alguien aquí —«¿qué propuestas hay y en qué estado
 * están?»— no tenía respuesta: la tabla no filtraba, no paginaba y no dejaba tocar ninguna fila,
 * así que el estado real de la cartera había que deducirlo. Ahora la tabla es la pantalla, y cada
 * formulario vive en su propia pestaña en vez de apilarse debajo.
 */
export default function ProposalsPage() {
  const [tab, setTab] = useState('listado');
  const [version, setVersion] = useState(0);
  const recargar = useCallback(() => setVersion((value) => value + 1), []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(() => b2bService.listProposals(), [version]);

  async function rechazar(payload: JsonObject) {
    return b2bService.rejectProposal(String(payload.proposalId ?? ''), String(payload.reason ?? ''));
  }

  return (
    <div className="space-y-5">
      <WorkspaceHeader
        breadcrumbs={[{ label: 'CRM' }, { label: 'Propuestas' }]}
        title="Propuestas comerciales"
        description="Cartera de propuestas con su vigencia, su ingreso estimado y el punto del ciclo en el que está cada una."
      />
      <TabbedPanels
        activeId={tab}
        onChange={setTab}
        keepMounted
        tabs={[
          {
            id: 'listado',
            label: 'Propuestas',
            icon: 'table_view',
            content: (
              <CrudDirectory
                embedded
                moduleLabel="CRM"
                title="Cartera de propuestas"
                description="Todas las propuestas registradas, de la más reciente a la más antigua."
                load={load}
                labelKey="proposalNumber"
                searchPlaceholder="Buscar por número, comercio o estado…"
                emptyHint="Usa la pestaña «Nueva propuesta» para armar la primera."
                columns={[
                  { key: 'proposalNumber', label: 'Propuesta', kind: 'mono' },
                  { key: 'tradeName', label: 'Comercio' },
                  { key: 'status', label: 'Estado', kind: 'status' },
                  { key: 'validUntil', label: 'Válida hasta', kind: 'date' },
                  { key: 'totalEstimatedMonthlyRevenue', label: 'Ingreso mensual est.', kind: 'money', align: 'right' },
                  { key: 'createdAt', label: 'Creada', kind: 'date' },
                ]}
                filters={[
                  { key: 'status', label: 'Estado' },
                  { key: 'tradeName', label: 'Comercio', kind: 'text', placeholder: 'Filtrar comercio' },
                ]}
                create={{ label: 'Nueva propuesta', onClick: () => setTab('nueva') }}
                extraActions={[
                  {
                    key: 'enviar',
                    label: 'Enviar al cliente',
                    icon: 'send',
                    run: (row) => b2bService.sendProposal(String(row.id ?? '')),
                    confirm: {
                      title: 'Enviar la propuesta',
                      message: 'Quedará marcada como enviada y con fecha de envío. Si tiene aprobaciones pendientes, el backend la frenará.',
                      confirmLabel: 'Enviar',
                    },
                  },
                  {
                    key: 'aceptar',
                    label: 'Marcar aceptada',
                    icon: 'task_alt',
                    run: (row) => b2bService.acceptProposal(String(row.id ?? '')),
                    confirm: {
                      title: 'Marcar la propuesta como aceptada',
                      message: 'La oportunidad pasa a CONTRACTING y a partir de aquí se genera el contrato. Solo una propuesta enviada puede aceptarse.',
                      confirmLabel: 'Aceptar',
                    },
                  },
                ]}
                edit={{
                  title: 'Corregir la propuesta',
                  description: 'Solo la cabecera, y solo mientras es borrador. Los términos comerciales son el acuerdo: cambiarlos bajo el mismo número es pactar otra cosa, y eso se hace con una propuesta nueva.',
                  enabled: (row) => EDITABLES.has(estado(row)),
                  fields: [
                    { name: 'proposalNumber', label: 'Número de propuesta', required: true, placeholder: 'CP-2026-001' },
                    { name: 'validUntil', label: 'Válida hasta', type: 'date', optional: true },
                    { name: 'totalEstimatedMonthlyRevenue', label: 'Ingreso mensual estimado', type: 'number', valueKind: 'number', optional: true },
                  ],
                  submit: (id, payload) => b2bService.updateProposal(id, payload),
                }}
                remove={{
                  submit: (id) => b2bService.deleteProposal(id),
                  enabled: (row) => BORRABLES.has(estado(row)),
                  warning: 'Se van con ella sus términos comerciales y sus solicitudes de aprobación. Una propuesta enviada o aceptada no se borra: se rechaza, para que quede constancia.',
                }}
                notice={{
                  tone: 'info',
                  title: 'Qué se puede tocar y qué no',
                  body: 'El lápiz y la papelera solo aparecen mientras la propuesta es un borrador (o quedó rechazada). Enviada o aceptada es la prueba de lo que se ofreció al cliente, y de la aceptada cuelga el contrato.',
                }}
              />
            ),
          },
          {
            id: 'nueva',
            label: 'Nueva propuesta',
            icon: 'add',
            content: <ProposalManagerScreen embedded onDone={recargar} />,
          },
          {
            id: 'rechazo',
            label: 'Rechazar',
            icon: 'cancel',
            content: (
              <InlineActionForm
                title="Rechazar una propuesta"
                description="El motivo es obligatorio: un rechazo sin explicación no sirve para decidir la siguiente oferta."
                icon="cancel"
                submitLabel="Rechazar propuesta"
                submitIcon="cancel"
                successMessage="La propuesta quedó rechazada con su motivo registrado."
                onDone={() => { recargar(); setTab('listado'); }}
                onSubmit={rechazar}
                fields={[
                  { name: 'proposalId', label: 'Propuesta', type: 'select', required: true, span: 2, optionsLoader: loadProposals },
                  { name: 'reason', label: 'Motivo del rechazo', type: 'textarea', required: true, span: 3, placeholder: 'Por qué el cliente o el comité no la acepta.' },
                ]}
              />
            ),
          },
        ]}
      />
    </div>
  );
}
