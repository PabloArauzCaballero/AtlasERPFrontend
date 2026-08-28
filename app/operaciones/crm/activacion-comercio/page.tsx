'use client';

import { useCallback, useState } from 'react';
import { TabbedPanels } from '@/components/atlas/TabbedPanels';
import { WorkspaceHeader } from '@/components/atlas/WorkspaceHeader';
import { CrudDirectory } from '@/components/screens/CrudDirectory';
import { MerchantActivationScreen } from '@/components/screens/MerchantActivationScreen';
import { b2bService } from '@/services/b2bService';

/**
 * Activación de comercios: qué hay por activar, y luego el control de activación.
 *
 * La pantalla era solo un desplegable y un botón. Para saber qué casos estaban listos y cuáles no
 * había que ir eligiéndolos de uno en uno: el estado del conjunto —lo que decide a qué comercio
 * atender primero— no se veía en ningún sitio.
 */
export default function ActivationPage() {
  const [tab, setTab] = useState('listado');
  const [version, setVersion] = useState(0);
  const recargar = useCallback(() => setVersion((value) => value + 1), []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(() => b2bService.listOnboardingCases(), [version]);

  return (
    <div className="space-y-5">
      <WorkspaceHeader
        breadcrumbs={[{ label: 'CRM' }, { label: 'Activación' }]}
        title="Activación de comercios"
        description="Casos de onboarding listos —o no— para habilitar al comercio a operar en ATLAS."
      />
      <TabbedPanels
        activeId={tab}
        onChange={setTab}
        keepMounted
        tabs={[
          {
            id: 'listado',
            label: 'Casos por activar',
            icon: 'table_view',
            content: (
              <CrudDirectory
                embedded
                moduleLabel="CRM"
                title="Casos de onboarding"
                description="Cuántos requisitos le faltan a cada expediente y si ya quedó activado."
                load={load}
                labelKey="tradeName"
                searchPlaceholder="Buscar por comercio o estado…"
                emptyHint="Los casos se abren desde CRM › Onboarding."
                columns={[
                  { key: 'tradeName', label: 'Comercio' },
                  { key: 'status', label: 'Estado', kind: 'status' },
                  { key: 'pendingItems', label: 'Requisitos pendientes', align: 'right' },
                  { key: 'startedAt', label: 'Iniciado', kind: 'date' },
                  { key: 'completedAt', label: 'Completado', kind: 'date' },
                ]}
                filters={[{ key: 'status', label: 'Estado' }]}
                create={{ label: 'Activar un comercio', onClick: () => setTab('activar') }}
                extraActions={[
                  {
                    key: 'activar',
                    label: 'Activar comercio',
                    icon: 'rocket_launch',
                    run: (row) => b2bService.activateOnboarding(String(row.id ?? ''), {}),
                    confirm: {
                      title: 'Activar el comercio',
                      message: 'El backend vuelve a comprobar los requisitos y el contrato activo: si falta algo, rechaza la activación. La interfaz no puede saltarse ese control.',
                      confirmLabel: 'Activar',
                    },
                  },
                ]}
              />
            ),
          },
          {
            id: 'activar',
            label: 'Control de activación',
            icon: 'rocket_launch',
            content: <MerchantActivationScreen embedded onDone={recargar} />,
          },
        ]}
      />
    </div>
  );
}
