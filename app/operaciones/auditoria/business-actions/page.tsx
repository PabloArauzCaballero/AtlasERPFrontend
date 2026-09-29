'use client';

import { LiveDirectoryScreen } from '@/components/screens/LiveDirectoryScreen';
import { useOptions } from '@/hooks/useOptions';
import { auditService } from '@/services/auditService';
import { loadInternalUsers } from '@/services/optionLoaders';

/**
 * Quién hizo qué y cuándo, en palabras de quien trabaja aquí.
 *
 * Se llamaba «Business Action Log» en el menú y «Ledger de acciones de negocio» dentro, y enseñaba
 * «ID agregado», el código crudo del origen y un recuento de «Correlaciones». Eso es vocabulario de
 * quien construyó la tabla, no de quien la consulta: el contador que viene a ver si el asiento de
 * ayer se registró y con qué resultado no sabe qué es un agregado ni le sirve saber cuántos flujos
 * distinguibles hubo. Las columnas que quedan son las que se leen: cuándo, en qué módulo, qué
 * proceso, qué acción, sobre qué y cómo acabó.
 *
 * El identificador del registro no se pinta como columna: es un dato para soporte, y ocupaba el
 * ancho que necesita lo que sí se lee.
 */
/** Los módulos que escriben en este registro, con el código exacto que guardan. */
const MODULOS = [
  { value: 'ACCOUNTING', label: 'Contabilidad', description: 'Cierres y reaperturas, facturas por cobrar, recibos y asientos.' },
  { value: 'CRM', label: 'CRM · pipeline y contratos', description: 'Mover oportunidades, decidir aprobaciones, firmar contratos y liquidar coberturas.' },
  { value: 'B2B_SALES_CRM', label: 'CRM · cuentas y onboarding', description: 'Alta y archivo de cuentas B2B y pasos del onboarding de comercios.' },
  { value: 'PORTAL', label: 'Portal del comercio', description: 'Planes del comercio y sus sucursales.' },
  { value: 'ADS', label: 'Publicidad', description: 'Acciones administrativas y entrega de anuncios.' },
];
const ETIQUETAS_MODULO: Record<string, string> = Object.fromEntries(MODULOS.map((modulo) => [modulo.value, modulo.label]));

export default function BusinessActionLogPage() {
  const personas = useOptions(loadInternalUsers);
  return (
    <LiveDirectoryScreen
      moduleLabel="Control"
      title="Registro de actividad"
      description="Qué se hizo en las operaciones que el ERP registra, quién lo hizo y cómo acabó. No es un registro de todo: la ayuda de la pantalla dice qué entra."
      load={auditService.listBusinessActions}
      /*
       * Sin caja de búsqueda: el servidor no busca por texto en este registro y la descartaba, así
       * que escribir en ella no cambiaba nada. En su lugar, los filtros que el servidor sí aplica.
       */
      searchable={false}
      statusOptions={[{ label: 'Exitosa', value: 'SUCCESS' }, { label: 'Fallida', value: 'FAILED' }, { label: 'Parcial', value: 'PARTIAL' }]}
      filters={[
        {
          key: 'aggregateId',
          label: 'Registro afectado',
          kind: 'text',
          placeholder: 'Identificador del registro',
          tooltip: 'Pega el identificador del registro (un período, una factura, una cuenta) para ver todo lo que le pasó, en orden. Tiene que ser el identificador completo, no parte de él.',
        },
        { key: 'moduleCode', label: 'Módulo', kind: 'select', options: MODULOS, tooltip: 'Muestra sólo lo registrado por ese módulo del ERP.' },
        { key: 'actorUserId', label: 'Quién', kind: 'select', options: personas, tooltip: 'Muestra sólo lo que hizo esa persona del personal de Atlas.' },
        { key: 'from', label: 'Desde', kind: 'date', tooltip: 'Primer día incluido, según la fecha en que se registró la acción.' },
        { key: 'to', label: 'Hasta', kind: 'date', tooltip: 'Último día incluido, según la fecha en que se registró la acción.' },
        // Un registro transcrito de un papel llega con otro origen y la serie del papel en su resumen.
        { key: 'sourceSystem', label: 'Cómo se registró', kind: 'select', options: [{ label: 'Tecleado en el ERP', value: 'ATLAS' }, { label: 'Transcrito de un papel', value: 'ERP_PAPER' }] },
      ]}
      columns={[
        { key: 'createdAt', label: 'Fecha y hora', kind: 'datetime' },
        { key: 'moduleCode', label: 'Módulo', labels: ETIQUETAS_MODULO },
        { key: 'businessProcess', label: 'Proceso' },
        { key: 'actionCode', label: 'Acción' },
        { key: 'aggregateType', label: 'Sobre qué' },
        { key: 'status', label: 'Resultado', kind: 'status' },
      ]}
      metrics={[
        { label: 'Acciones registradas', value: (_rows, total) => total, detail: 'En total', icon: 'history_edu' },
        { label: 'Salieron bien', value: (rows) => rows.filter((row) => row.status === 'SUCCESS').length, soloPagina: true, icon: 'check_circle', tone: 'teal' },
        { label: 'Fallaron', value: (rows) => rows.filter((row) => row.status === 'FAILED').length, soloPagina: true, icon: 'error', tone: 'red' },
      ]}
    />
  );
}
