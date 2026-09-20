'use client';

import { LiveDirectoryScreen } from '@/components/screens/LiveDirectoryScreen';
import { auditService } from '@/services/auditService';

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
export default function BusinessActionLogPage() {
  return (
    <LiveDirectoryScreen
      moduleLabel="Control"
      title="Registro de actividad"
      description="Qué se hizo en el ERP, quién lo hizo y cómo acabó. Sirve para revisar un caso concreto y para responder a control interno."
      load={auditService.listBusinessActions}
      statusOptions={[{ label: 'Exitosa', value: 'SUCCESS' }, { label: 'Fallida', value: 'FAILED' }, { label: 'Parcial', value: 'PARTIAL' }]}
      // Un registro transcrito de un papel llega con otro origen y la serie del papel en su resumen.
      filters={[{ key: 'sourceSystem', label: 'Cómo se registró', kind: 'select', options: [{ label: 'Tecleado en el ERP', value: 'ATLAS' }, { label: 'Transcrito de un papel', value: 'ERP_PAPER' }] }]}
      columns={[
        { key: 'createdAt', label: 'Fecha y hora', kind: 'date' },
        { key: 'moduleCode', label: 'Módulo' },
        { key: 'businessProcess', label: 'Proceso' },
        { key: 'actionCode', label: 'Acción' },
        { key: 'aggregateType', label: 'Sobre qué' },
        { key: 'status', label: 'Resultado', kind: 'status' },
      ]}
      metrics={[
        { label: 'Acciones registradas', value: (_rows, total) => total, detail: 'En total', icon: 'history_edu' },
        { label: 'Salieron bien', value: (rows) => rows.filter((row) => row.status === 'SUCCESS').length, detail: 'En esta página', icon: 'check_circle', tone: 'teal' },
        { label: 'Fallaron', value: (rows) => rows.filter((row) => row.status === 'FAILED').length, detail: 'Hay que mirarlas', icon: 'error', tone: 'red' },
      ]}
    />
  );
}
