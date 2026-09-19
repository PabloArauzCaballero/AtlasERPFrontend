'use client';

import { useCallback, useState } from 'react';
import { Modal } from '@/components/atlas/Modal';
import { CrudDirectory } from '@/components/screens/CrudDirectory';
import { MdrRulesPanel } from '@/components/screens/MdrRulesPanel';
import { b2bService } from '@/services/b2bService';
import { loadInternalUsers, loadProposals } from '@/services/optionLoaders';
import type { JsonObject, ResourceRow } from '@/services/types';

export default function CommercialContractsPage() {
  const load = useCallback(() => b2bService.listContracts(), []);
  /** El contrato cuya comisión se está administrando. `null` cierra el diálogo. */
  const [comisionDe, setComisionDe] = useState<ResourceRow | null>(null);

  return (
    <CrudDirectory
      moduleLabel="CRM"
      title="Contratos comerciales"
      description="Todos los contratos generados desde propuestas aceptadas, con su vigencia, ciclo de facturación y estado de firma."
      load={load}
      searchPlaceholder="Buscar por número de contrato o estado…"
      emptyHint="Genera el primer contrato desde una propuesta aceptada con el botón «Generar contrato»."
      labelKey="contractNumber"
      columns={[
        { key: 'contractNumber', label: 'Número', kind: 'mono' },
        { key: 'startDate', label: 'Inicio', kind: 'date' },
        { key: 'endDate', label: 'Fin', kind: 'date' },
        { key: 'billingCycle', label: 'Ciclo' },
        { key: 'settlementPolicy', label: 'Liquidación' },
        { key: 'signedAt', label: 'Firmado', kind: 'date' },
        { key: 'status', label: 'Estado', kind: 'status' },
      ]}
      filters={[
        { key: 'status', label: 'Estado' },
        { key: 'billingCycle', label: 'Ciclo' },
      ]}
      notice={{
        tone: 'info',
        title: 'Un contrato comercial no se edita ni se borra',
        body: 'Nace de una propuesta aceptada y su vigencia es la prueba de lo pactado. Para cambiarlo se genera uno nuevo desde otra propuesta; para dejar de aplicarlo se firma y se cierra su vigencia.',
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
          { name: 'billingCycle', label: 'Ciclo de facturación', tooltip: 'Cada cuánto se factura al comercio: mensual, trimestral, por transacción…', required: true, defaultValue: 'MONTHLY', optionsSource: 'domain:crm.contractBillingCycle' },
          { name: 'settlementPolicy', label: 'Política de liquidación', tooltip: 'Cómo se liquida lo cobrado: por contrato, por sucursal o por cuenta.', required: true, defaultValue: 'PER_CONTRACT', optionsSource: 'domain:crm.contractSettlementPolicy' },
          { name: 'documentUrl', label: 'URL del documento', tooltip: 'Enlace al contrato firmado en el repositorio de documentos, con https://.', type: 'url', optional: true, span: 2 },
        ],
        submit: (payload: JsonObject) => b2bService.createContractFromProposal(payload),
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
          key: 'comision',
          label: 'Comisión por venta (MDR)',
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
    </CrudDirectory>
  );
}
