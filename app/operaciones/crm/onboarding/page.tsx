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
import { MdrRulesPanel } from '@/components/screens/MdrRulesPanel';
import { MerchantUserInviteScreen } from '@/components/screens/MerchantUserInviteScreen';
import { OnboardingCaseScreen } from '@/components/screens/OnboardingCaseScreen';
import { b2bService } from '@/services/b2bService';

/**
 * Onboarding de comercios: la cartera de casos primero, los formularios en pestañas.
 *
 * La vista apilaba un resumen truncado, el constructor de casos y el alta de usuarios, uno debajo
 * de otro. Para saber qué casos había abiertos y cuántos requisitos les faltaban había que leer un
 * panel que no filtraba ni paginaba; el resto era formulario.
 */
export default function OnboardingPage() {
  const [tab, setTab] = useState('listado');
  const [version, setVersion] = useState(0);
  const recargar = useCallback(() => setVersion((value) => value + 1), []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(() => b2bService.listOnboardingCases(), [version]);

  return (
    <div className="space-y-5">
      <WorkspaceHeader
        breadcrumbs={[{ label: 'CRM' }, { label: 'Onboarding' }]}
        title="Casos de onboarding"
        description="Requisitos legales, operativos y técnicos de cada comercio antes de habilitarlo para operar."
      />
      <TabbedPanels
        activeId={tab}
        onChange={setTab}
        keepMounted
        tabs={[
          {
            id: 'listado',
            label: 'Casos',
            icon: 'table_view',
            content: (
              <CrudDirectory
                embedded
                moduleLabel="CRM"
                title="Casos abiertos y cerrados"
                description="Estado de cada expediente y cuántos requisitos le faltan por cerrar."
                load={load}
                labelKey="tradeName"
                searchPlaceholder="Buscar por comercio o estado…"
                emptyHint="Usa la pestaña «Nuevo caso» para abrir el primero."
                columns={[
                  { key: 'tradeName', label: 'Comercio' },
                  { key: 'status', label: 'Estado', kind: 'status' },
                  { key: 'pendingItems', label: 'Requisitos pendientes', align: 'right' },
                  { key: 'startedAt', label: 'Iniciado', kind: 'date' },
                  { key: 'completedAt', label: 'Completado', kind: 'date' },
                ]}
                filters={[
                  { key: 'status', label: 'Estado' },
                  { key: 'tradeName', label: 'Comercio', kind: 'text', placeholder: 'Filtrar comercio' },
                ]}
                create={{ label: 'Nuevo caso', onClick: () => setTab('nuevo') }}
                extraActions={[
                  {
                    key: 'activar',
                    label: 'Activar comercio',
                    icon: 'rocket_launch',
                    run: (row) => b2bService.activateOnboarding(String(row.id ?? ''), {}),
                    confirm: {
                      title: 'Activar el comercio',
                      message: 'El backend vuelve a comprobar los requisitos y el contrato activo: si falta algo, rechaza la activación.',
                      confirmLabel: 'Activar',
                    },
                  },
                ]}
                notice={{
                  tone: 'info',
                  title: 'Un caso de onboarding no se borra',
                  body: 'Es el expediente de por qué se habilitó un comercio. Los requisitos se mueven de estado desde la pestaña «Nuevo caso», y la activación se comprueba de nuevo en el backend.',
                }}
              />
            ),
          },
          {
            id: 'nuevo',
            label: 'Nuevo caso y requisitos',
            icon: 'add',
            content: <OnboardingCaseScreen embedded onDone={recargar} />,
          },
          {
            id: 'usuarios',
            label: 'Usuarios del comercio',
            icon: 'person_add',
            /* Es del staff, y antes vivía en el portal del comercio, donde el staff ni entra. */
            content: <MerchantUserInviteScreen />,
          },
          {
            id: 'mdr',
            label: 'Reglas de comisión',
            icon: 'percent',
            /* La comisión se pacta en el alta: activar sin haberla acordado deja la primera venta
               cobrando lo que hubiera por defecto, y esa conversación ya no se puede tener después. */
            content: <MdrRulesPanel />,
          },
        ]}
      />
    </div>
  );
}
