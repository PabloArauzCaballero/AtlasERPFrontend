'use client';

import { useCallback, useState } from 'react';
import { CrudDirectory } from '@/components/screens/CrudDirectory';
import { b2bService } from '@/services/b2bService';
import { asRows } from '@/lib/asRows';
import { cargarTodo } from '@/lib/cargarTodo';
import { loadB2BAccounts } from '@/services/optionLoaders';
import type { JsonObject, ResourceRow } from '@/services/types';

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

/**
 * Las sucursales con el NOMBRE de su comercio.
 *
 * El listado del servidor sólo trae `accountId`, y la columna «Comercio» enseñaba ese uuid. El
 * nombre sale del directorio de cuentas (entero, por páginas); si una cuenta no aparece —archivada,
 * por ejemplo— se dice así en vez de pintar el identificador.
 */
async function sucursalesConComercio(): Promise<ResourceRow[]> {
  const [sucursales, cuentas] = await Promise.all([
    b2bService.listBranches(),
    cargarTodo((query) => b2bService.listAccounts({ page: query.page ?? 1, limit: query.limit ?? 100 })).catch(() => ({ items: [] })),
  ]);
  const nombres = new Map(asRows(cuentas).map((cuenta) => [String(cuenta.id ?? ''), String(cuenta.tradeName || cuenta.legalName || '')]));
  return asRows(sucursales).map((sucursal) => ({
    ...sucursal,
    comercio: nombres.get(String(sucursal.accountId ?? '')) || 'Comercio no encontrado en el directorio',
  }));
}

export default function MerchantBranchesPage() {
  const [version, setVersion] = useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(() => sucursalesConComercio(), [version]);

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
        { key: 'comercio', label: 'Comercio' },
      ]}
      filters={[{ key: 'status', label: 'Estado', options: ESTADOS }]}
      create={{
        label: 'Registrar sucursal',
        title: 'Nueva sucursal',
        description: 'Nace PENDIENTE y sin poder originar ventas a plazos: eso se habilita al activar el comercio, no al darla de alta.',
        fields: [
          { name: 'accountId', label: 'Comercio', tooltip: 'Comercio al que pertenece la sucursal.', type: 'select', required: true, span: 2, optionsLoader: loadB2BAccounts },
          { name: 'name', label: 'Nombre de la sucursal', tooltip: 'Nombre con el que el comercio identifica el local. Ej.: Sucursal Equipetrol.', required: true, span: 2 },
          { name: 'city', label: 'Ciudad', tooltip: 'Ciudad donde está la sucursal; queda registrada en su ficha.', optional: true, optionsSource: 'catalog:city' },
          { name: 'address', label: 'Dirección', tooltip: 'Dirección de la sucursal, con zona y referencia.', optional: true, span: 3 },
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
          { name: 'name', label: 'Nombre de la sucursal', tooltip: 'Nombre con el que el comercio identifica el local. Ej.: Sucursal Equipetrol.', required: true, span: 2 },
          // Una ciudad escrita a mano antes y fuera del catálogo se conserva como «valor anterior».
          { name: 'city', label: 'Ciudad', tooltip: 'Ciudad donde está la sucursal; queda registrada en su ficha.', optional: true, optionsSource: 'catalog:city' },
          { name: 'address', label: 'Dirección', tooltip: 'Dirección de la sucursal, con zona y referencia.', optional: true, span: 3 },
        ],
        submit: (id, payload) => b2bService.updateBranch(id, payload),
      }}
      extraActions={[
        {
          key: 'estado',
          label: 'Cambiar estado',
          description: 'Habilita o da de baja la sucursal. Sólo las habilitadas pueden originar ventas; su historial se conserva.',
          icon: 'published_with_changes',
          form: {
            title: (row) => `Estado de «${String(row.name ?? '')}»`,
            description: 'Dar de baja una sucursal no borra su historial: las ventas originadas allí siguen contando.',
            fields: (row) => [
              {
                name: 'status',
                label: 'Estado', tooltip: 'Estado del registro; decide qué acciones se permiten sobre él y si aparece en los listados operativos.',
                type: 'select' as const,
                required: true,
                span: 2 as const,
                defaultValue: String(row.status ?? 'PENDING'),
                // Del backend: la lista local no tenía SUSPENDED, que el esquema sí acepta.
                optionsSource: 'domain:crm.branchStatus' as const,
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
