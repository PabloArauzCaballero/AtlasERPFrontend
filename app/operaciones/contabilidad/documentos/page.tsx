'use client';

import { useCallback, useState } from 'react';
import { Modal } from '@/components/atlas/Modal';
import { CrudDirectory } from '@/components/screens/CrudDirectory';
import { FileAttachmentsPanel } from '@/components/screens/FileAttachmentsPanel';
import { asientoDesdeExcel, camposAsiento, camposLineaAsiento } from '@/components/screens/altas/asientoContable';
import { accountingService } from '@/services/accountingService';
import type { ResourceRow } from '@/services/types';

/**
 * Documentos contables: el listado es la pantalla.
 *
 * El alta era una pestaña «Crear documento» junto a «Documentos registrados»: un verbo en la barra
 * de secciones. Un asiento lleva líneas y columna de control, así que va a su propia página; el
 * botón está en la cabecera, y contabilizar o reversar siguen en la fila.
 */
/** Un borrador que espera que OTRA persona lo apruebe o lo rechace. */
const esperaDecision = (row: ResourceRow) =>
  String(row.status ?? '').toUpperCase() === 'DRAFT' && String(row.approvalStatus ?? '').toUpperCase() === 'PENDING';

/**
 * Sólo se ofrece contabilizar lo que el servidor ya autorizó (sin aprobación requerida, o aprobado).
 * Es una comodidad: el backend lo vuelve a exigir, y también rechaza un NOT_REQUIRED anterior a la
 * política (sin referencia), cuyo error se muestra tal cual.
 */
const puedeContabilizarse = (row: ResourceRow) =>
  String(row.status ?? '').toUpperCase() === 'DRAFT' &&
  ['NOT_REQUIRED', 'APPROVED'].includes(String(row.approvalStatus ?? '').toUpperCase());

export default function AccountingDocumentsPage() {
  const load = useCallback(() => accountingService.listDocuments(), []);
  /** El asiento cuyo comprobante de respaldo se está viendo. `null` cierra el diálogo. */
  const [respaldoDe, setRespaldoDe] = useState<ResourceRow | null>(null);

  return (
    <CrudDirectory
      moduleLabel="Contabilidad"
      title="Documentos contables"
      description="Todos los asientos registrados y su estado de contabilización. Un documento contabilizado no se edita ni se borra: se reversa."
      load={load}
      labelKey="documentNo"
      searchPlaceholder="Buscar por número, tipo o estado…"
      emptyHint="Usa el botón «Crear documento» para registrar el primer asiento."
      columns={[
        { key: 'documentNo', label: 'Documento', kind: 'mono' },
        { key: 'documentType', label: 'Tipo' },
        { key: 'documentDate', label: 'Fecha', kind: 'date' },
        { key: 'postingDate', label: 'Contabilización', kind: 'date' },
        { key: 'currencyCode', label: 'Moneda' },
        { key: 'status', label: 'Estado', kind: 'status' },
        { key: 'approvalStatus', label: 'Aprobación', kind: 'status' },
      ]}
      filters={[{ key: 'documentType', label: 'Tipo' }, { key: 'status', label: 'Estado' }, { key: 'approvalStatus', label: 'Aprobación' }]}
      notice={{
        tone: 'info',
        title: 'Sin lápiz ni papelera, y es a propósito',
        body: 'Un asiento contabilizado es inmutable: corregirlo o borrarlo rompería el cuadre del período y la trazabilidad. Lo que corresponde es contabilizar el borrador o reversarlo con un asiento contrario.',
      }}
      create={{ label: 'Crear documento', href: '/operaciones/contabilidad/documentos/crear' }}
      /*
       * Carga masiva de asientos: UNA FILA POR LÍNEA, agrupadas por la referencia del documento.
       * Un asiento no cabe en una fila —tiene dos líneas como mínimo—, y por eso este listado se
       * quedó sin importar cuando la pantalla de «Carga masiva» se retiró. Es además el formato en
       * el que cualquier contabilidad exporta su libro diario, así que la hoja de origen casi
       * siempre ya viene así.
       */
      importar={{
        entidad: 'asientos',
        fields: camposAsiento,
        submit: (payload) => accountingService.createDocument(asientoDesdeExcel(payload) as typeof payload),
        lineas: {
          name: 'lines',
          clave: 'asiento',
          claveLabel: 'Referencia del asiento',
          nombreLinea: 'línea',
          ejemploClave: 'ASIENTO-1',
          fields: camposLineaAsiento,
        },
      }}
      extraActions={[
        {
          /*
           * El comprobante que respalda el asiento (la factura, el recibo, el extracto). Se ofrece
           * también en un asiento contabilizado: adjuntar la prueba no cambia el asiento.
           */
          key: 'respaldo',
          label: 'Respaldo',
          description: 'Adjunta o consulta el comprobante (factura, recibo, extracto) que respalda este asiento.',
          icon: 'attach_file',
          silent: true,
          run: async (row) => setRespaldoDe(row),
        },
        {
          /*
           * La reversión: el aviso de esta misma pantalla decía «lo que corresponde es
           * contabilizarlo o reversarlo» y sólo estaba lo primero. El endpoint y el
           * método del servicio existían; faltaba el botón, así que un asiento
           * contabilizado por error no tenía salida desde la consola.
           */
          key: 'reversar',
          label: 'Reversar',
          description: 'Crea un asiento contrario que anula el efecto de este, sin borrar el original.',
          icon: 'undo',
          enabled: (row) => String(row.status ?? '').toUpperCase() === 'POSTED',
          form: {
            title: (row) => `Reversar ${String(row.documentNo ?? '')}`,
            description: 'Se crea un asiento CONTRARIO; el original no se toca. El número de la reversión y el período salen del sistema: el período es el que esté abierto para la fecha que pongas.',
            fields: [
              /*
               * Dos campos, no cuatro.
               *
               * El número lo asigna el backend (serie DOC-…) y el período lo dice la fecha de
               * reversión: pedirlo en un desplegable con TODOS los períodos dejaba reversar en
               * septiembre contra el período de julio, y era el usuario quien tenía que saber
               * cuál estaba abierto.
               */
              { name: 'reversalDate', label: 'Fecha de reversión', tooltip: 'Fecha con la que se contabiliza la reversión; tiene que caer en un período abierto.', type: 'date', required: true, span: 3 },
              { name: 'reason', label: 'Motivo', tooltip: 'Motivo breve del cambio; queda en la bitácora para que otro entienda por qué se hizo.', required: true, span: 3, placeholder: 'Documento cargado con la cuenta equivocada' },
            ],
            submit: (row, payload) => accountingService.reverseDocument(String(row.id ?? ''), payload),
            submitLabel: 'Reversar',
          },
        },
        {
          /*
           * ATL-03: la necesidad de aprobar la decide el SERVIDOR (política), no quien crea el asiento.
           * Aprobar y rechazar los ve quien puede decidir; el backend exige además que no sea el
           * creador y que el rol sea CFO o administrador (un 403 se muestra tal cual).
           */
          key: 'aprobar',
          label: 'Aprobar',
          description: 'Autoriza que este borrador se contabilice. No puede aprobarlo quien lo creó.',
          icon: 'approval',
          enabled: esperaDecision,
          confirm: {
            title: 'Aprobar el documento',
            message: 'Autorizas que este asiento se contabilice. Queda registrado que lo aprobaste tú; quien lo creó no puede aprobarlo.',
            confirmLabel: 'Sí, aprobar',
          },
          run: (row) => accountingService.approveDocument(String(row.id ?? '')),
        },
        {
          key: 'rechazar',
          label: 'Rechazar',
          description: 'Niega la autorización: el borrador no se podrá contabilizar.',
          icon: 'block',
          enabled: esperaDecision,
          form: {
            title: (row) => `Rechazar ${String(row.documentNo ?? '')}`,
            description: 'El rechazo es definitivo para este borrador: no se contabiliza. Si el asiento era válido, se crea otro.',
            fields: [
              { name: 'reason', label: 'Motivo', tooltip: 'Por qué se rechaza; queda en la bitácora del documento.', required: true, span: 3, placeholder: 'Falta el comprobante de respaldo' },
            ],
            submit: (row, payload) => accountingService.rejectDocument(String(row.id ?? ''), payload),
            submitLabel: 'Rechazar',
          },
        },
        {
          key: 'contabilizar',
          label: 'Contabilizar',
          description: 'Pasa el asiento a firme: impacta en los saldos y ya no se puede editar, sólo reversar. Si exige aprobación, antes tiene que aprobarlo otra persona.',
          icon: 'task_alt',
          enabled: puedeContabilizarse,
          run: (row) => accountingService.postDocument(String(row.id ?? '')),
          confirm: {
            title: 'Contabilizar el documento',
            message: 'El asiento pasa a firme y deja de poder editarse. Sólo podrá deshacerse con una reversión.',
            confirmLabel: 'Sí, contabilizar',
          },
        },
      ]}
    >
      {respaldoDe ? (
        <Modal
          open
          title={`Respaldo · ${String(respaldoDe.documentNo ?? 'asiento')}`}
          description="El comprobante que prueba el asiento: factura, recibo, extracto. Se guarda en el almacén de evidencia de Atlas."
          icon="attach_file"
          width="lg"
          onClose={() => setRespaldoDe(null)}
        >
          <FileAttachmentsPanel ownerType="ACCOUNTING_DOCUMENT" ownerId={String(respaldoDe.id ?? '')} title="Comprobantes de respaldo" />
        </Modal>
      ) : null}
    </CrudDirectory>
  );
}
