'use client';

import { tope } from '@/lib/topes';
import { useCallback } from 'react';
import { CrudDirectory } from '@/components/screens/CrudDirectory';
import { camposLineaPropuesta, camposPropuesta, propuestaDesdeExcel } from '@/components/screens/altas/propuesta';
import { b2bService } from '@/services/b2bService';
import type { ResourceRow } from '@/services/types';
import { avisoDeEnvio } from '@/lib/avisoEnvioPropuesta';

/** Estados en los que la propuesta todavía es un borrador y admite correcciones. */
const EDITABLES = new Set(['DRAFT', 'PENDING_APPROVAL']);
/** A los anteriores se suma la rechazada: ya no vale para nada y puede retirarse del listado. */
const BORRABLES = new Set(['DRAFT', 'PENDING_APPROVAL', 'REJECTED']);
/** Mientras no esté aceptada: de la aceptada cuelga el contrato, y rechazarla lo dejaría huérfano. */
const RECHAZABLES = new Set(['DRAFT', 'PENDING_APPROVAL', 'SENT']);

const estado = (row: ResourceRow) => String(row.status ?? '').toUpperCase();
/** Se envía (o reenvía) mientras no esté aceptada ni rechazada. */
const ENVIABLES = new Set(['DRAFT', 'SENT']);


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
      tope={tope('las 200 propuestas más recientes')}
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
      /*
       * Carga masiva de propuestas: una fila por condición, agrupadas por la referencia de la
       * propuesta. Una propuesta con MDR más cuota fija son dos filas con la misma referencia.
       */
      importar={{
        entidad: 'propuestas',
        fields: camposPropuesta,
        submit: (payload) => b2bService.createProposal(propuestaDesdeExcel(payload) as typeof payload),
        lineas: {
          name: 'lines',
          clave: 'propuesta',
          claveLabel: 'Referencia de la propuesta',
          nombreLinea: 'condición',
          ejemploClave: 'PROPUESTA-1',
          fields: camposLineaPropuesta,
        },
      }}
      extraActions={[
        {
          /*
           * Enviar es mandar un CORREO a personas concretas del comercio. Antes sólo cambiaba el
           * estado y no preguntaba a quién: el comercio nunca recibía nada.
           */
          key: 'enviar',
          label: 'Enviar al cliente',
          description: 'Envía por correo la propuesta en PDF, con membrete de ATLAS, a los contactos del comercio que elijas. No sale si tiene aprobaciones pendientes.',
          icon: 'send',
          enabled: (row) => ENVIABLES.has(estado(row)),
          form: {
            title: (row) => `Enviar ${String(row.proposalNumber ?? 'la propuesta')}`,
            description: 'Elige a quién del comercio le llega la propuesta. Si la persona no está en la lista, agrégala como contacto del comercio o escribe su correo abajo.',
            fields: (row) => [
              {
                name: 'contactIds',
                label: 'Contactos del comercio',
                tooltip: 'Personas del comercio con correo registrado. La propuesta les llega por correo.',
                type: 'multiselect',
                optional: true,
                span: 3,
                optionsLoader: async () =>
                  (await b2bService.listProposalRecipients(String(row.id ?? ''))).map((c) => ({
                    value: String(c.id),
                    label: `${String(c.fullName)} · ${String(c.email)}${c.roleTitle ? ` (${String(c.roleTitle)})` : ''}${c.isPrimary ? ' — principal' : ''}`,
                  })),
              },
              {
                name: 'extraEmails',
                label: 'Otros correos',
                tooltip: 'Correos que no están como contacto del comercio. Escribe uno y pulsa Enter.',
                type: 'chips',
                valueKind: 'stringList',
                optional: true,
                span: 3,
                placeholder: 'gerencia@comercio.bo',
              },
              {
                name: 'message',
                label: 'Mensaje',
                tooltip: 'Texto opcional para el comercio: va en el correo y como «Mensaje de su ejecutivo comercial» dentro del PDF.',
                type: 'textarea',
                optional: true,
                span: 3,
                placeholder: 'Como conversamos, les compartimos la propuesta…',
              },
            ],
            submit: (row, payload) =>
              b2bService.sendProposal(String(row.id ?? ''), {
                contactIds: Array.isArray(payload.contactIds) ? payload.contactIds.map(String) : [],
                extraEmails: Array.isArray(payload.extraEmails) ? payload.extraEmails.map(String) : [],
                message: typeof payload.message === 'string' && payload.message.trim() ? payload.message : undefined,
              }),
            submitLabel: 'Enviar propuesta',
          },
          resultMessage: (resultado) => avisoDeEnvio(resultado),
        },
        {
          key: 'pdf',
          label: 'Ver PDF',
          description: 'Descarga la propuesta en PDF con el membrete de ATLAS: es el mismo documento que recibe el comercio.',
          icon: 'picture_as_pdf',
          run: async (row) => {
            await b2bService.downloadProposalPdf(String(row.id ?? ''), String(row.proposalNumber ?? ''));
            return { descargado: true };
          },
          resultMessage: (_resultado, row) => ({ title: 'PDF descargado', body: `Propuesta ${String(row.proposalNumber ?? '')}.` }),
        },
        {
          key: 'aceptar',
          label: 'Marcar aceptada',
          description: 'Registra que el cliente aceptó la propuesta; la oportunidad pasa a contratación.',
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
          description: 'Registra que el cliente rechazó la propuesta, con el motivo para preparar la siguiente oferta.',
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
