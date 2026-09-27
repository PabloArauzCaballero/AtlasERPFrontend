'use client';

import { useCallback, useState } from 'react';
import { FormField } from '@/components/atlas/FormField';
import { Panel } from '@/components/atlas/Panel';
import { CrudDirectory, type CrudToolbarAction } from '@/components/screens/CrudDirectory';
import { fiscalService, loadIssuerProfiles } from '@/services/fiscalService';
import type { JsonObject } from '@/services/types';
import { CATALOGOS_SIN } from './comun';

/**
 * Catálogos del SIN: las listas que publica Impuestos (actividades, productos, motivos de
 * anulación…) y contra las que se valida cada factura. Se eligen arriba y se leen en la tabla.
 *
 * Si las filas vienen del entorno de pruebas se dice, en ámbar y sin rodeos: un código de producto
 * simulado no sirve para facturar de verdad, y confundirlo con el real es exactamente el error que
 * sale caro el día que se enciende producción.
 */
export function CatalogosSinPanel({ activo }: Readonly<{ activo: boolean }>) {
  const [catalogo, setCatalogo] = useState('ACTIVIDADES');
  const [simulado, setSimulado] = useState(false);

  const load = useCallback(async () => {
    const filas = await fiscalService.listCatalog(catalogo);
    setSimulado((filas ?? []).some((fila) => fila.simulated === true));
    return filas ?? [];
  }, [catalogo]);

  const sincronizar: CrudToolbarAction = {
    key: 'sincronizar',
    label: 'Sincronizar ahora',
    icon: 'sync',
    title: 'Sincronizar catálogos con Impuestos',
    description: 'Vuelve a descargar los catálogos del SIN; lo que Impuestos dejó de publicar desaparece.',
    submitLabel: 'Sincronizar',
    fields: [
      { name: 'perfilId', label: 'Emisor', tooltip: 'Emisor con cuyas credenciales se consulta a Impuestos; cualquiera activo sirve.', type: 'select', required: true, span: 2, optionsLoader: loadIssuerProfiles },
      {
        name: 'catalogo',
        label: 'Catálogo',
        tooltip: 'Uno solo, o todos si se deja vacío. Sincronizar todos tarda algo más.',
        type: 'select',
        optional: true,
        span: 2,
        emptyOption: 'Todos los catálogos',
        options: CATALOGOS_SIN,
      },
    ],
    submit: (payload: JsonObject) =>
      fiscalService.syncCatalogs(String(payload.perfilId ?? ''), payload.catalogo ? String(payload.catalogo) : undefined),
  };

  return (
    <div className="space-y-4">
      <Panel compact>
        <FormField
          kind="select"
          name="catalogoSin"
          label="Catálogo"
          tooltip="Qué lista de Impuestos quiere consultar; cada una se sincroniza desde el SIN."
          options={CATALOGOS_SIN}
          value={catalogo}
          onChange={(event) => setCatalogo(event.target.value)}
          className="max-w-md"
          data-testid="catalogo-sin"
        />
      </Panel>
      <CrudDirectory
        embedded
        moduleLabel="Contabilidad"
        title={CATALOGOS_SIN.find((opcion) => opcion.value === catalogo)?.label ?? 'Catálogo'}
        description={CATALOGOS_SIN.find((opcion) => opcion.value === catalogo)?.description ?? ''}
        load={load}
        idKey="codigo"
        labelKey="descripcion"
        searchPlaceholder="Buscar por código o descripción…"
        emptyHint={activo ? 'Aún no se sincronizó: usa «Más» › «Sincronizar ahora».' : 'Con la facturación electrónica apagada no se sincroniza con Impuestos.'}
        columns={[
          { key: 'codigo', label: 'Código', kind: 'mono' },
          { key: 'descripcion', label: 'Descripción' },
          { key: 'syncedAt', label: 'Sincronizado', kind: 'date' },
        ]}
        toolbarActions={activo ? [sincronizar] : []}
        notice={
          simulado
            ? {
                tone: 'warning',
                title: 'Catálogo de pruebas',
                body: 'Estas filas vienen del entorno de pruebas de Impuestos, no del SIN real. Sirven para ensayar; antes de facturar en producción hay que volver a sincronizar.',
              }
            : undefined
        }
      />
    </div>
  );
}
