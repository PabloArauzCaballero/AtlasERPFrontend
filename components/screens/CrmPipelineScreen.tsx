'use client';

import { useCallback, useState } from 'react';
import { TabbedPanels } from '@/components/atlas/TabbedPanels';
import { WorkspaceHeader } from '@/components/atlas/WorkspaceHeader';
import { ApprovalsDirectory } from '@/components/screens/ApprovalsDirectory';
import { CrudDirectory } from '@/components/screens/CrudDirectory';
import { OpportunityKanbanScreen } from '@/components/screens/OpportunityKanbanScreen';
import { ProposalsDirectory } from '@/components/screens/ProposalsDirectory';
import { b2bService } from '@/services/b2bService';
import { loadB2BAccounts, loadInternalUsers } from '@/services/optionLoaders';

interface CrmPipelineScreenProps {
  /** Pestaña con la que abre la pantalla; la decide la ruta por la que se entró. */
  initialTab?: 'listado' | 'tablero' | 'propuestas' | 'aprobaciones' | undefined;
}

/**
 * El embudo comercial entero en una pantalla: oportunidades, su tablero y sus propuestas.
 *
 * El pipeline solo existía como kanban. Un tablero está bien para mover una tarjeta de etapa, pero
 * no responde «cuántas hay», «cuáles cierran este mes» ni «cuáles son de este ejecutivo»: no
 * filtra, no ordena, no pagina y reparte los registros en siete columnas que hay que recorrer a
 * mano. El alta, además, no estaba en ninguna pantalla: una oportunidad solo nacía por API.
 *
 * Las propuestas entran aquí como una pestaña más porque son el paso siguiente del MISMO trato: una
 * propuesta se emite contra una oportunidad y de la aceptada cuelga el contrato. Estaban en otra
 * pantalla del menú lateral, así que comprobar «qué le ofrecimos a este comercio» obligaba a salir
 * del embudo y volver. Las dos rutas —`/oportunidades` y `/propuestas`— siguen existiendo y pintan
 * esta misma pantalla; lo único que cambia es con qué pestaña abre, para que los enlaces de fuera,
 * el menú lateral y las guías por ruta sigan llevando a donde decían.
 */
export function CrmPipelineScreen({ initialTab = 'listado' }: CrmPipelineScreenProps = {}) {
  const [version, setVersion] = useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(() => b2bService.listOpportunities(), [version]);

  return (
    <div className="space-y-5">
      <WorkspaceHeader
        breadcrumbs={[{ label: 'CRM' }, { label: 'Pipeline comercial' }]}
        title="Pipeline comercial"
        description="El embudo de punta a punta: qué se está negociando y por cuánto, en qué etapa va cada trato, qué propuestas han salido de él y qué excepciones hay que autorizar."
      />
      <TabbedPanels
        keepMounted
        initialId={initialTab}
        tabs={[
          {
            id: 'listado',
            label: 'Oportunidades',
            icon: 'table_view',
            content: (
              <CrudDirectory
                embedded
                moduleLabel="CRM"
                title="Oportunidades registradas"
                description="Todo el embudo en una tabla, con su etapa, su volumen esperado y su fecha de cierre."
                load={load}
                labelKey="name"
                searchPlaceholder="Buscar por nombre, tipo o etapa…"
                emptyHint="Usa «Nueva oportunidad» para registrar la primera."
                columns={[
                  { key: 'name', label: 'Oportunidad' },
                  { key: 'opportunityType', label: 'Tipo' },
                  { key: 'stage', label: 'Etapa', kind: 'status' },
                  { key: 'expectedMonthlyVolume', label: 'Volumen mensual', kind: 'money', align: 'right' },
                  { key: 'expectedMonthlyRevenue', label: 'Ingreso esperado', kind: 'money', align: 'right' },
                  { key: 'probability', label: 'Probabilidad %', align: 'right' },
                  { key: 'expectedCloseDate', label: 'Cierre previsto', kind: 'date' },
                ]}
                filters={[
                  { key: 'stage', label: 'Etapa' },
                  { key: 'opportunityType', label: 'Tipo' },
                ]}
                create={{
                  label: 'Nueva oportunidad',
                  title: 'Registrar una oportunidad',
                  description: 'Nace en DISCOVERY. El ingreso esperado se calcula con el volumen y la tasa de MDR.',
                  submit: async (payload) => {
                    const resultado = await b2bService.createOpportunity(payload);
                    setVersion((value) => value + 1);
                    return resultado;
                  },
                  fields: [
                    { name: 'accountId', label: 'Cuenta B2B', tooltip: 'Cuenta B2B del comercio sobre la que se trabaja.', type: 'select', required: true, span: 2, optionsLoader: loadB2BAccounts },
                    { name: 'ownerUserId', label: 'Ejecutivo responsable', tooltip: 'Ejecutivo comercial que responde por esta cuenta; recibe las tareas y los avisos.', type: 'select', required: true, span: 2, optionsLoader: loadInternalUsers },
                    { name: 'name', label: 'Nombre de la oportunidad', tooltip: 'Nombre de la oportunidad. Ej.: Afiliación cadena Hipermaxi.', required: true, span: 2, placeholder: 'Beta Market — RENEWAL' },
                    { name: 'opportunityType', label: 'Tipo', tooltip: 'Qué se vende: afiliación nueva, ampliación, renovación…', type: 'select', required: true, optionsSource: 'domain:crm.opportunityType' },
                    { name: 'expectedMonthlyVolume', label: 'Volumen mensual esperado', tooltip: 'Ventas mensuales estimadas en bolivianos; dimensiona la oportunidad.', type: 'number', valueKind: 'number', optional: true },
                    { name: 'expectedMdrRate', label: 'Tasa de MDR esperada (%)', tooltip: 'Comisión (MDR) en porcentaje que se espera pactar. Ej.: 3.5.', type: 'number', valueKind: 'number', optional: true },
                    { name: 'probability', label: 'Probabilidad (%)', tooltip: 'Probabilidad de cierre en porcentaje; pondera el pronóstico. Ej.: 60.', type: 'number', valueKind: 'number', defaultValue: 0 },
                    { name: 'expectedCloseDate', label: 'Cierre previsto', tooltip: 'Fecha estimada de firma; ordena el pipeline.', type: 'date', optional: true },
                  ],
                }}
                notice={{
                  tone: 'info',
                  title: 'La etapa se mueve en el tablero',
                  body: 'De una oportunidad sólo se cambia la etapa —con motivo obligatorio si se pierde—: no se edita ni se borra. Por eso aquí no hay lápiz ni papelera: para moverla, usa la pestaña «Tablero».',
                }}
              />
            ),
          },
          {
            id: 'tablero',
            label: 'Tablero',
            icon: 'view_kanban',
            content: <OpportunityKanbanScreen embedded version={version} />,
          },
          {
            id: 'propuestas',
            label: 'Propuestas',
            icon: 'request_quote',
            content: <ProposalsDirectory embedded />,
          },
          /*
           * Aprobaciones va la ÚLTIMA, y es una decisión de orden, no de sitio: las pestañas
           * siguen el recorrido del trato —se registra la oportunidad, se mueve por el tablero, se
           * emite la propuesta y, sólo si pide una excepción, alguien la autoriza—. Ponerla antes
           * sugeriría que hay algo que aprobar en cada trato, y la mayoría no pasa por aquí.
           */
          {
            id: 'aprobaciones',
            label: 'Aprobaciones',
            icon: 'approval',
            content: <ApprovalsDirectory embedded />,
          },
        ]}
      />
    </div>
  );
}
