'use client';

import { useCallback, useState } from 'react';
import { CrudDirectory } from '@/components/screens/CrudDirectory';
import { b2bService } from '@/services/b2bService';
import { loadB2BAccounts } from '@/services/optionLoaders';
import type { JsonObject } from '@/services/types';

/**
 * Sucursales de los comercios, desde el lado del ERP.
 *
 * Las tres operaciones internas —crear, corregir y cambiar el estado de una sucursal— existían en
 * el backend y en el servicio del frontend, y no las llamaba ninguna pantalla: la única forma de
 * gestionar sucursales era el portal del comercio, es decir, no había forma de que un operador
 * interno lo hiciera por él.
 *
 * Faltaba además la mitad de lectura: `GET /b2b/onboarding/branches` no existía, así que una
 * sucursal creada desde el ERP no volvía a aparecer en ninguna respuesta. Sin listado tampoco se
 * podía elegir dónde se origina una venta a plazos.
 *
 * `canOriginateBnpl` es la columna que de verdad importa: una sucursal ACTIVA que no puede originar
 * no vende a plazos, y las dos cosas se confunden si sólo se mira el estado.
 */

const ESTADOS = [
  { label: 'Pendiente', value: 'PENDING' },
  { label: 'Activa', value: 'ACTIVE' },
  { label: 'Inactiva', value: 'INACTIVE' },
];

export default function MerchantBranchesPage() {
  const [version, setVersion] = useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(() => b2bService.listBranches(), [version]);

  return (
    <CrudDirectory
      moduleLabel="CRM"
      title="Sucursales de comercios"
      description="Dónde opera cada comercio y en qué locales se puede vender a plazos."
      load={load}
      labelKey="name"
      searchPlaceholder="Buscar por nombre, ciudad o estado…"
      emptyHint="Sin sucursales registradas. Un comercio sin sucursal activa no puede originar ventas a plazos."
      notice={{
        tone: 'info',
        title: 'Estado y habilitación no son lo mismo',
        body: 'Una sucursal ACTIVA opera; que además pueda originar ventas a plazos (canOriginateBnpl) se habilita al activar el comercio, tras el onboarding. Una sucursal activa sin habilitación no vende a plazos, y mirar sólo el estado hace parecer que sí.',
      }}
      columns={[
        { key: 'name', label: 'Sucursal' },
        { key: 'city', label: 'Ciudad' },
        { key: 'address', label: 'Dirección' },
        { key: 'status', label: 'Estado', kind: 'status' },
        { key: 'canOriginateBnpl', label: 'Vende a plazos', kind: 'bool' },
        { key: 'accountId', label: 'Comercio', kind: 'mono' },
      ]}
      filters={[{ key: 'status', label: 'Estado', options: ESTADOS }]}
      create={{
        label: 'Registrar sucursal',
        title: 'Nueva sucursal',
        description: 'Nace PENDIENTE y sin poder originar ventas a plazos: eso se habilita al activar el comercio, no al darla de alta.',
        fields: [
          { name: 'accountId', label: 'Comercio', type: 'select', required: true, span: 2, optionsLoader: loadB2BAccounts },
          { name: 'name', label: 'Nombre de la sucursal', required: true, span: 2 },
          { name: 'city', label: 'Ciudad', optional: true },
          { name: 'address', label: 'Dirección', optional: true, span: 3 },
        ],
        submit: async (payload: JsonObject) => {
          const created = await b2bService.createBranch(payload);
          setVersion((value) => value + 1);
          return created;
        },
      }}
      edit={{
        description: 'El comercio al que pertenece no se cambia: una sucursal que cambia de dueño es otra sucursal.',
        fields: [
          { name: 'name', label: 'Nombre de la sucursal', required: true, span: 2 },
          { name: 'city', label: 'Ciudad', optional: true },
          { name: 'address', label: 'Dirección', optional: true, span: 3 },
        ],
        submit: (id, payload) => b2bService.updateBranch(id, payload),
      }}
      extraActions={[
        {
          key: 'estado',
          label: 'Cambiar estado',
          icon: 'published_with_changes',
          form: {
            title: (row) => `Estado de «${String(row.name ?? '')}»`,
            description: 'Dar de baja una sucursal no borra su historial: las ventas originadas allí siguen contando.',
            fields: (row) => [
              {
                name: 'status',
                label: 'Estado',
                type: 'select' as const,
                required: true,
                span: 2 as const,
                defaultValue: String(row.status ?? 'PENDING'),
                options: ESTADOS,
              },
            ],
            submit: (row, payload) => b2bService.setBranchStatus(String(row.id ?? ''), payload),
            submitLabel: 'Guardar estado',
          },
        },
      ]}
    />
  );
}
