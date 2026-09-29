'use client';

import { tope } from '@/lib/topes';
import { useCallback, useState } from 'react';
import { Modal } from '@/components/atlas/Modal';
import { CrudDirectory } from '@/components/screens/CrudDirectory';
import { FileAttachmentsPanel } from '@/components/screens/FileAttachmentsPanel';
import { MdrRulesPanel } from '@/components/screens/MdrRulesPanel';
import { b2bService } from '@/services/b2bService';
import { adjuntarAlCrear, TAMANO_MAXIMO_EVIDENCIA } from '@/services/filesService';
import { loadInternalUsers, loadProposals } from '@/services/optionLoaders';
import type { JsonObject, ResourceRow } from '@/services/types';

export default function CommercialContractsPage() {
  const load = useCallback(() => b2bService.listContracts(), []);
  /** El contrato cuya comisión se está administrando. `null` cierra el diálogo. */
  const [comisionDe, setComisionDe] = useState<ResourceRow | null>(null);
  /** El contrato cuyos documentos se están viendo. `null` cierra el diálogo. */
  const [documentosDe, setDocumentosDe] = useState<ResourceRow | null>(null);

  return (
    <CrudDirectory
      moduleLabel="CRM"
      title="Contratos comerciales"
      tope={tope('los 200 contratos más recientes')}
      description="Los contratos generados desde propuestas aceptadas, con su comercio, su vigencia y su estado de firma. Lo que se cobra de verdad es la comisión por venta (MDR) de cada contrato."
      load={load}
      searchPlaceholder="Buscar por número de contrato o estado…"
      emptyHint="Genera el primer contrato desde una propuesta aceptada con el botón «Generar contrato»."
      labelKey="contractNumber"
      columns={[
        { key: 'contractNumber', label: 'Número', kind: 'mono' },
        { key: 'tradeName', label: 'Comercio' },
        { key: 'startDate', label: 'Inicio', kind: 'date' },
        { key: 'endDate', label: 'Fin', kind: 'date' },
        { key: 'billingCycle', label: 'Ciclo pactado' },
        { key: 'settlementPolicy', label: 'Liquidación pactada' },
        { key: 'signedAt', label: 'Firmado', kind: 'date' },
        { key: 'status', label: 'Estado', kind: 'status' },
      ]}
      filters={[
        { key: 'status', label: 'Estado' },
        { key: 'billingCycle', label: 'Ciclo pactado' },
      ]}
      notice={{
        tone: 'info',
        title: 'Un contrato comercial no se edita ni se borra',
        body: 'Nace de una propuesta aceptada y es la prueba de lo pactado. Para cambiarlo se genera uno nuevo desde otra propuesta. Lo que el sistema cobra es la comisión por venta (MDR) de sus reglas, cerrada cada mes; el ciclo de facturación y la política de liquidación se guardan como condición pactada, pero hoy no cambian cómo se factura. No hay una operación para cerrar la vigencia de un contrato desde aquí.',
      }}
      create={{
        label: 'Generar contrato',
        title: 'Generar contrato desde propuesta',
        description: 'Cabecera contractual heredada de una propuesta ya aceptada.',
        fields: [
          { name: 'proposalId', label: 'Propuesta aceptada', tooltip: 'Propuesta aceptada por el cliente de la que nace el contrato.', type: 'select', required: true, span: 2, optionsLoader: loadProposals },
          // El correlativo lo asigna el backend al generar el contrato.
          { name: 'contractNumber', label: 'Número de contrato', tooltip: 'Número del contrato; lo asigna el sistema al guardar.', assignedByBackend: true },
          { name: 'startDate', label: 'Fecha inicial', tooltip: 'Fecha en que entra en vigor.', type: 'date', required: true },
          { name: 'endDate', label: 'Fecha final', tooltip: 'Fecha en que termina; vacío = indefinido.', type: 'date', optional: true },
          { name: 'billingCycle', label: 'Ciclo de facturación', tooltip: 'Ciclo de facturación pactado con el comercio. Es informativo: hoy el sistema factura la comisión en el cierre mensual, sea cual sea el ciclo.', required: true, defaultValue: 'MONTHLY', optionsSource: 'domain:crm.contractBillingCycle' },
          { name: 'settlementPolicy', label: 'Política de liquidación', tooltip: 'Cómo se pactó agrupar la liquidación. Es informativo: hoy el cierre agrupa por cuenta y moneda.', required: true, defaultValue: 'PER_CONTRACT', optionsSource: 'domain:crm.contractSettlementPolicy' },
          /*
           * El documento se SUBE, no se enlaza. Antes era un campo «URL del documento» que pedía un
           * https:// a otro repositorio: el contrato firmado quedaba fuera de Atlas, sin hash y sin
           * sesión. Ahora va al almacén de evidencia, a la carpeta `documentos/` del comercio.
           */
          { name: 'documento', label: 'Documento del contrato', tooltip: 'El contrato firmado (PDF o imagen). Se guarda en la carpeta «documentos» del comercio, en Archivos.', type: 'file', accept: 'application/pdf,image/jpeg,image/png', maxBytes: TAMANO_MAXIMO_EVIDENCIA, hint: 'PDF, JPEG o PNG hasta 15 MB. También se puede subir después, desde la fila.', optional: true, span: 2 },
        ],
        submit: async (payload: JsonObject) => {
          const { documento, ...datos } = payload as JsonObject & { documento?: unknown };
          const creado = (await b2bService.createContractFromProposal(datos)) as { contract?: { id?: string } };
          await adjuntarAlCrear('CONTRACT', creado.contract?.id, documento, 'El contrato');
          return creado;
        },
      }}
      /*
       * Las dos operaciones del contrato viven en SU FILA.
       *
       * Vivían debajo de la tabla, cada una en su formulario, y el primer campo de ambas era un
       * desplegable que pedía otra vez el contrato: el usuario elegía la fila con los ojos y luego
       * tenía que volver a elegirla con el ratón, con el riesgo de firmar o tarifar el contrato
       * equivocado. Sin contratos todavía, además, los dos desplegables sólo sabían decir «— No hay
       * datos registrados —» y los formularios quedaban ahí, pidiendo datos para nada.
       */
      extraActions={[
        {
          key: 'firmar',
          label: 'Firmar y activar',
          description: 'Registra quién aprobó el contrato y cuándo se firmó. Desde la firma el contrato entra en vigor.',
          icon: 'draw',
          primary: true,
          /* Firmar es lo que pone en vigor lo pactado: se ofrece mientras no haya firma. */
          enabled: (row) => !row.signedAt,
          form: {
            title: (row) => `Firmar ${String(row.contractNumber ?? 'el contrato')}`,
            description: 'Confirmación institucional del contrato: quién lo aprueba y cuándo se firmó. Desde la firma corre la vigencia.',
            fields: [
              { name: 'approvedByUserId', label: 'Aprobador', tooltip: 'Usuario interno que aprobó el contrato.', type: 'select', required: true, span: 2, optionsLoader: loadInternalUsers },
              /* Selector de fecha y hora: el control entrega la hora local y se envía como ISO, en
                 vez de pedir que se teclee un ISO con su zona horaria. */
              { name: 'signedAt', label: 'Fecha y hora de firma', tooltip: 'Fecha y hora de la firma; desde ahí corre la vigencia.', type: 'datetime', optional: true, span: 2 },
            ],
            submit: (row, payload: JsonObject) => b2bService.signAndActivateContract(String(row.id ?? ''), payload),
            submitLabel: 'Firmar y activar',
          },
        },
        {
          key: 'documentos',
          label: 'Documentos',
          description: 'Abre los documentos adjuntos a este contrato para verlos o subir otros.',
          icon: 'attach_file',
          /* `silent`: no ejecuta nada, abre la lista de documentos de ESE contrato para verlos o subir más. */
          silent: true,
          run: async (row) => setDocumentosDe(row),
        },
        {
          key: 'comision',
          label: 'Comisión por venta (MDR)',
          description: 'Muestra, agrega o desactiva las reglas de cuánto cobra Atlas por cada venta del comercio.',
          icon: 'percent',
          primary: true,
          /*
           * `silent` porque no ejecuta nada: abre el panel de reglas de ESE contrato. No cabe en un
           * formulario declarativo —lista las reglas vigentes, añade y activa o desactiva—, así que
           * se abre en un diálogo con el contrato ya fijado.
           */
          silent: true,
          /* Sin versión vigente no hay dónde colgar la comisión: la acción no se ofrece. */
          enabled: (row) => Boolean(row.currentVersionId),
          run: async (row) => setComisionDe(row),
        },
      ]}
    >
      {comisionDe ? (
        <Modal
          open
          title={`Comisión por venta · ${String(comisionDe.contractNumber ?? 'contrato')}`}
          description="Lo que Atlas cobra al comercio por cada venta de este contrato. Gana la regla más específica."
          icon="percent"
          width="lg"
          onClose={() => setComisionDe(null)}
        >
          {/* La VERSIÓN del contrato, no el contrato: es de la versión de la que cuelga la regla. */}
          <MdrRulesPanel
            contractVersionId={String(comisionDe.currentVersionId ?? '')}
            accountId={String(comisionDe.accountId ?? '')}
          />
        </Modal>
      ) : null}
      {documentosDe ? (
        <Modal
          open
          title={`Documentos · ${String(documentosDe.contractNumber ?? 'contrato')}`}
          description="El contrato firmado y sus anexos. Se guardan en la carpeta «documentos» del comercio, en Archivos."
          icon="attach_file"
          width="lg"
          onClose={() => setDocumentosDe(null)}
        >
          <FileAttachmentsPanel ownerType="CONTRACT" ownerId={String(documentosDe.id ?? '')} title="Documentos del contrato" />
        </Modal>
      ) : null}
    </CrudDirectory>
  );
}
