'use client';

import { useCallback } from 'react';
import { CrudDirectory } from '@/components/screens/CrudDirectory';
import { b2bService } from '@/services/b2bService';
import type { ResourceRow } from '@/services/types';

/** Estados en los que la propuesta todavía es un borrador y admite correcciones. */
const EDITABLES = new Set(['DRAFT', 'PENDING_APPROVAL']);
/** A los anteriores se suma la rechazada: ya no vale para nada y puede retirarse del listado. */
const BORRABLES = new Set(['DRAFT', 'PENDING_APPROVAL', 'REJECTED']);
/** Mientras no esté aceptada: de la aceptada cuelga el contrato, y rechazarla lo dejaría huérfano. */
const RECHAZABLES = new Set(['DRAFT', 'PENDING_APPROVAL', 'SENT']);

const estado = (row: ResourceRow) => String(row.status ?? '').toUpperCase();

interface ProposalsDirectoryProps {
  /** Dentro de una pestaña: sin cabecera de pantalla, sólo el rótulo de la sección. */
  embedded?: boolean | undefined;
}

/**
 * La cartera de propuestas: primero la tabla, después el constructor.
 *
 * Antes esta vista abría con el formulario de alta y dejaba el listado como un panel de resumen
 * truncado encima. La pregunta que trae a alguien aquí —«¿qué propuestas hay y en qué estado
 * están?»— no tenía respuesta: la tabla no filtraba, no paginaba y no dejaba tocar ninguna fila,
 * así que el estado real de la cartera había que deducirlo. Ahora la tabla es la pantalla.
 *
 * «Nueva propuesta» y «Rechazar» eran verbos metidos en una barra de secciones. El alta lleva
 * líneas y columna lateral, así que va a su propia página (`/crear`); rechazar va en la fila.
 *
 * Vive como componente, y no como página, porque se enseña dentro del pipeline: «Propuestas» es su
 * ÚLTIMA pestaña. Una propuesta es el paso siguiente del mismo trato —se emite contra una
 * oportunidad y de la aceptada cuelga el contrato—, así que se consulta junto al embudo y no en
 * otra pantalla del menú. Las excepciones de MDR sí son pantalla suelta: `/crm/aprobaciones`.
 */
export function ProposalsDirectory({ embedded = false }: ProposalsDirectoryProps = {}) {
  const load = useCallback(() => b2bService.listProposals(), []);

  return (
    <CrudDirectory
      embedded={embedded}
      moduleLabel="CRM"
      title="Propuestas comerciales"
      description="Cartera de propuestas con su vigencia, su ingreso estimado y el punto del ciclo en el que está cada una."
      load={load}
      labelKey="proposalNumber"
      searchPlaceholder="Buscar por número, comercio o estado…"
      emptyHint="Usa el botón «Nueva propuesta» para armar la primera."
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
      create={{ label: 'Nueva propuesta', href: '/operaciones/crm/propuestas/crear' }}
      extraActions={[
        {
          key: 'enviar',
          label: 'Enviar al cliente',
          icon: 'send',
          run: (row) => b2bService.sendProposal(String(row.id ?? '')),
          confirm: {
            title: 'Enviar la propuesta',
            message: 'Quedará marcada como enviada y con fecha de envío. Si tiene aprobaciones pendientes, no saldrá hasta resolverlas.',
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
        {
          /*
           * Rechazar es una operación SOBRE una propuesta. Era una pestaña que volvía a pedir en un
           * desplegable la propuesta que el usuario tenía delante; ahora sale en su fila.
           */
          key: 'rechazar',
          label: 'Rechazar',
          icon: 'cancel',
          tone: 'danger',
          enabled: (row) => RECHAZABLES.has(estado(row)),
          form: {
            title: (row) => `Rechazar ${String(row.proposalNumber ?? 'la propuesta')}`,
            description: 'El motivo es obligatorio: un rechazo sin explicación no sirve para decidir la siguiente oferta.',
            fields: [
              { name: 'reason', label: 'Motivo del rechazo', tooltip: 'Por qué se rechaza la propuesta; el comercial lo lee para corregirla.', type: 'textarea', required: true, span: 3, placeholder: 'Por qué el cliente o el comité no la acepta.' },
            ],
            submit: (row, payload) => b2bService.rejectProposal(String(row.id ?? ''), String(payload.reason ?? '')),
            submitLabel: 'Rechazar propuesta',
          },
        },
      ]}
      edit={{
        title: 'Corregir la propuesta',
        description: 'Solo la cabecera, y solo mientras es borrador. Los términos comerciales son el acuerdo: cambiarlos bajo el mismo número es pactar otra cosa, y eso se hace con una propuesta nueva.',
        enabled: (row) => EDITABLES.has(estado(row)),
        fields: [
          // El correlativo lo asignó el backend: se enseña, no se reescribe (y no viaja en el envío).
          { name: 'proposalNumber', label: 'Número de propuesta', tooltip: 'Número de la propuesta; lo asigna el sistema al guardar.', assignedByBackend: true },
          { name: 'validUntil', label: 'Válida hasta', tooltip: 'Fecha hasta la que el cliente puede aceptar la propuesta.', type: 'date', optional: true },
          { name: 'totalEstimatedMonthlyRevenue', label: 'Ingreso mensual estimado', tooltip: 'Ingreso mensual estimado en bolivianos si se acepta.', type: 'number', valueKind: 'number', optional: true },
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
        body: 'El lápiz y la papelera solo aparecen mientras la propuesta es un borrador (o quedó rechazada). Enviada o aceptada es la prueba de lo que se ofreció al cliente, y de la aceptada cuelga el contrato. Rechazar se ofrece en la fila mientras no esté aceptada.',
      }}
    />
  );
}
