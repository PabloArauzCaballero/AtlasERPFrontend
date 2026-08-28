'use client';

import { useCallback, useState } from 'react';
import { TabbedPanels } from '@/components/atlas/TabbedPanels';
import { WorkspaceHeader } from '@/components/atlas/WorkspaceHeader';
import { CrudDirectory } from '@/components/screens/CrudDirectory';
import { OpportunityKanbanScreen } from '@/components/screens/OpportunityKanbanScreen';
import { b2bService } from '@/services/b2bService';
import { loadB2BAccounts, loadInternalUsers } from '@/services/optionLoaders';

/**
 * Oportunidades: la tabla primero, el tablero después.
 *
 * El pipeline solo existía como kanban. Un tablero está bien para mover una tarjeta de etapa, pero
 * no responde «cuántas hay», «cuáles cierran este mes» ni «cuáles son de este ejecutivo»: no
 * filtra, no ordena, no pagina y reparte los registros en siete columnas que hay que recorrer a
 * mano. El alta, además, no estaba en ninguna pantalla: una oportunidad solo nacía por API.
 */
export default function OpportunitiesPage() {
  const [version, setVersion] = useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(() => b2bService.listOpportunities(), [version]);

  return (
    <div className="space-y-5">
      <WorkspaceHeader
        breadcrumbs={[{ label: 'CRM' }, { label: 'Oportunidades' }]}
        title="Pipeline de oportunidades"
        description="Embudo comercial: qué se está negociando, con quién, por cuánto y en qué etapa."
      />
      <TabbedPanels
        keepMounted
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
                  description: 'Nace en DISCOVERY. El ingreso esperado lo calcula el backend con el volumen y la tasa de MDR.',
                  submit: async (payload) => {
                    const resultado = await b2bService.createOpportunity(payload);
                    setVersion((value) => value + 1);
                    return resultado;
                  },
                  fields: [
                    { name: 'accountId', label: 'Cuenta B2B', type: 'select', required: true, span: 2, optionsLoader: loadB2BAccounts },
                    { name: 'ownerUserId', label: 'Ejecutivo responsable', type: 'select', required: true, span: 2, optionsLoader: loadInternalUsers },
                    { name: 'name', label: 'Nombre de la oportunidad', required: true, span: 2, placeholder: 'Beta Market — RENEWAL' },
                    { name: 'opportunityType', label: 'Tipo', type: 'select', required: true, options: ['NEW_MERCHANT', 'RENEWAL', 'UPSELL', 'CROSS_SELL', 'REACTIVATION'].map((value) => ({ label: value.replaceAll('_', ' '), value })) },
                    { name: 'expectedMonthlyVolume', label: 'Volumen mensual esperado', type: 'number', valueKind: 'number', optional: true },
                    { name: 'expectedMdrRate', label: 'Tasa de MDR esperada (%)', type: 'number', valueKind: 'number', optional: true },
                    { name: 'probability', label: 'Probabilidad (%)', type: 'number', valueKind: 'number', defaultValue: 0 },
                    { name: 'expectedCloseDate', label: 'Cierre previsto', type: 'date', optional: true },
                  ],
                }}
                notice={{
                  tone: 'info',
                  title: 'La etapa se mueve en el tablero',
                  body: 'El backend solo expone el cambio de etapa —con motivo obligatorio si se pierde— y no permite editar ni borrar una oportunidad. Por eso aquí no hay lápiz ni papelera: para moverla, usa la pestaña «Tablero».',
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
        ]}
      />
    </div>
  );
}
