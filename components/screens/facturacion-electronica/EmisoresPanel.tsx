'use client';

import { useCallback, useMemo, useState } from 'react';
import { CrudDirectory } from '@/components/screens/CrudDirectory';
import type { ActionField } from '@/components/screens/StructuredActionForm';
import { useOptions } from '@/hooks/useOptions';
import { domainLoader } from '@/services/domains';
import { fiscalService } from '@/services/fiscalService';
import { loadLegalEntities } from '@/services/optionLoaders';
import type { JsonObject, ResourceRow } from '@/services/types';
import { etiquetas } from './comun';
import { EstadoEmisorModal } from './EstadoEmisorModal';

/** Productos del SIN sincronizados, uno por código (el catálogo los repite por actividad). */
async function cargarProductosSin() {
  const filas = await fiscalService.listCatalog('PRODUCTOS').catch(() => []);
  const porCodigo = new Map<string, string>();
  for (const fila of filas ?? []) {
    const extra = (fila.extra ?? {}) as { codigoProducto?: unknown };
    const codigo = String(extra.codigoProducto ?? String(fila.codigo ?? '').split('|').pop() ?? '');
    if (codigo && !porCodigo.has(codigo)) porCodigo.set(codigo, `${codigo} — ${String(fila.descripcion ?? '')}`);
  }
  return [...porCodigo].map(([value, label]) => ({ value, label }));
}

async function cargarUnidadesSin() {
  const filas = await fiscalService.listCatalog('UNIDAD_MEDIDA').catch(() => []);
  return (filas ?? []).map((fila) => ({ value: String(fila.codigo ?? ''), label: String(fila.descripcion ?? '') }));
}

/** Lo que se puede cambiar de un emisor sin rehacer su registro ante Impuestos. */
const camposEditables: ActionField[] = [
  { name: 'razonSocial', label: 'Razón social', tooltip: 'Nombre legal tal como figura en el padrón de Impuestos; sale impreso en cada factura.', required: true, span: 2 },
  { name: 'municipio', label: 'Municipio', tooltip: 'Municipio del domicilio fiscal de la sucursal. Ej.: La Paz.', required: true },
  { name: 'telefono', label: 'Teléfono', tooltip: 'Teléfono de la sucursal que se imprime en la factura; opcional.', optional: true },
  { name: 'direccion', label: 'Dirección', tooltip: 'Dirección de la sucursal registrada ante Impuestos; sale impresa en la factura.', required: true, span: 2 },
  { name: 'actividadEconomica', label: 'Actividad económica', tooltip: 'Código de la actividad registrada en Impuestos (CAEB), sólo dígitos. Ej.: 620100.', required: true, placeholder: '620100' },
  { name: 'leyendaDefault', label: 'Leyenda por defecto', tooltip: 'Leyenda de la Ley 453 que se imprime si la actividad no trae otra; opcional.', optional: true, type: 'textarea', span: 2 },
  {
    name: 'productoSinDefault',
    label: 'Producto del SIN para facturas de contabilidad',
    tooltip: 'Producto homologado con que salen las facturas de Contabilidad (AR), que no tienen catálogo propio. Sin él, esas facturas no se pueden emitir con la facturación electrónica encendida.',
    type: 'select',
    valueKind: 'number',
    optional: true,
    span: 2,
    emptyOption: '— Sin definir —',
    optionsLoader: cargarProductosSin,
  },
  {
    name: 'unidadMedidaDefault',
    label: 'Unidad de medida de esas facturas',
    tooltip: 'Unidad del catálogo del SIN con que se facturan; para servicios suele ser «UNIDAD (SERVICIOS)».',
    type: 'select',
    valueKind: 'number',
    optional: true,
    span: 2,
    emptyOption: '— UNIDAD (SERVICIOS) —',
    optionsLoader: cargarUnidadesSin,
  },
];

const camposAlta: ActionField[] = [
  { name: 'legalEntityId', label: 'Empresa que factura', tooltip: 'Empresa del grupo cuyo NIT emite las facturas; decide qué documentos ve cada usuario.', type: 'select', required: true, span: 2, optionsLoader: loadLegalEntities },
  { name: 'nit', label: 'NIT', tooltip: 'Número de identificación tributaria del emisor, sólo dígitos. No se cambia después.', required: true, placeholder: '1020304050' },
  { name: 'codigoSucursal', label: 'Sucursal ante Impuestos', tooltip: 'Número de sucursal registrado en Impuestos; 0 es la casa matriz.', type: 'number', valueKind: 'number', required: true, defaultValue: 0 },
  { name: 'codigoPuntoVenta', label: 'Punto de venta', tooltip: 'Número del punto de venta registrado en Impuestos; 0 si no se usan puntos de venta.', type: 'number', valueKind: 'number', required: true, defaultValue: 0 },
  ...camposEditables,
];

/**
 * Emisores: con qué NIT, sucursal y punto de venta factura cada empresa ante Impuestos.
 *
 * Los códigos que Impuestos entrega (CUIS por sistema, CUFD cada día) se piden desde la fila y
 * NUNCA se enseñan: sólo su vigencia. El estado completo —conexión, vigencias, última
 * sincronización— se abre en un modal, porque consultarlo es preguntarle a Impuestos.
 */
export function EmisoresPanel({ activo }: Readonly<{ activo: boolean }>) {
  const load = useCallback(() => fiscalService.listIssuerProfiles(), []);
  const estados = useOptions(domainLoader('domain:fiscal.issuerStatus'));
  const etiquetasEstado = useMemo(() => etiquetas(estados), [estados]);
  const [viendo, setViendo] = useState<ResourceRow | null>(null);

  const edicion: ActionField[] = [
    ...camposEditables,
    { name: 'status', label: 'Estado', tooltip: 'Un emisor inactivo deja de emitir; sus facturas ya emitidas siguen valiendo.', required: true, optionsSource: 'domain:fiscal.issuerStatus' },
  ];

  return (
    <>
      <CrudDirectory
        embedded
        moduleLabel="Contabilidad"
        title="Emisor y credenciales"
        description="Con qué NIT, sucursal y punto de venta factura cada empresa ante Impuestos Nacionales."
        load={load}
        labelKey="razonSocial"
        searchPlaceholder="Buscar por razón social o NIT…"
        emptyHint="Registra el emisor con «Registrar emisor» antes de emitir la primera factura electrónica."
        columns={[
          { key: 'razonSocial', label: 'Razón social' },
          { key: 'nit', label: 'NIT', kind: 'mono' },
          { key: 'codigoSucursal', label: 'Sucursal', align: 'right' },
          { key: 'codigoPuntoVenta', label: 'Punto de venta', align: 'right' },
          { key: 'municipio', label: 'Municipio' },
          { key: 'status', label: 'Estado', kind: 'status', labels: etiquetasEstado },
        ]}
        filters={[{ key: 'status', label: 'Estado', options: [...estados] }]}
        create={{
          label: 'Registrar emisor',
          title: 'Registrar emisor ante Impuestos',
          description: 'NIT, sucursal y punto de venta no se cambian después: identifican al emisor ante Impuestos.',
          fields: camposAlta,
          submit: (payload: JsonObject) => fiscalService.createIssuerProfile(payload),
        }}
        edit={{
          title: 'Editar emisor',
          description: 'El NIT, la sucursal y el punto de venta no se editan: para cambiarlos se registra otro emisor.',
          fields: edicion,
          submit: (id, payload) => fiscalService.updateIssuerProfile(id, payload),
        }}
        extraActions={[
          {
            key: 'estado',
            label: 'Ver estado ante Impuestos',
            description: 'Muestra si hay conexión con Impuestos y si los códigos CUIS y CUFD del emisor están vigentes.',
            icon: 'monitor_heart',
            primary: true,
            silent: true,
            run: async (row) => { setViendo(row); },
          },
          {
            key: 'cuis',
            label: 'Pedir código de sistema (CUIS)',
            description: 'Pide a Impuestos un código de sistema nuevo. Sólo hace falta si el vigente venció o se perdió.',
            icon: 'key',
            enabled: () => activo,
            confirm: {
              title: 'Pedir un CUIS nuevo',
              message: 'Impuestos entrega un código de sistema nuevo para este emisor. Sólo hace falta si el vigente venció o se perdió.',
              confirmLabel: 'Pedir CUIS',
            },
            run: (row) => fiscalService.requestCuis(String(row.id ?? '')),
          },
          {
            key: 'cufd',
            label: 'Pedir código diario (CUFD)',
            description: 'Pide a Impuestos el código del día. Se renueva solo; úsalo si el de hoy no llegó.',
            icon: 'event_available',
            enabled: () => activo,
            confirm: {
              title: 'Pedir un CUFD nuevo',
              message: 'El sistema lo renueva solo cada día. Pedirlo a mano sirve si el del día no llegó; las facturas nuevas usarán el nuevo.',
              confirmLabel: 'Pedir CUFD',
            },
            run: (row) => fiscalService.requestCufd(String(row.id ?? '')),
          },
        ]}
        notice={{
          tone: 'info',
          title: 'El emisor ante Impuestos',
          body: 'Cada empresa factura con su NIT desde una sucursal y un punto de venta registrados en Impuestos. El sistema pide los códigos de autorización (CUIS y CUFD) y los renueva solo; aquí se ven sus vigencias y se piden a mano si hace falta.',
        }}
      />
      {viendo ? (
        <EstadoEmisorModal perfilId={String(viendo.id ?? '')} nombre={String(viendo.razonSocial ?? 'el emisor')} onClose={() => setViendo(null)} />
      ) : null}
    </>
  );
}
