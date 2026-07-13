'use client';

import { LiveDirectoryScreen } from '@/components/screens/LiveDirectoryScreen';
import { auditService } from '@/services/auditService';

export default function BusinessActionLogPage() {
  return (
    <LiveDirectoryScreen
      moduleLabel="Auditoría"
      title="Business Action Log"
      description="Ledger de acciones de negocio para trazabilidad, investigaciones y control interno."
      load={auditService.listBusinessActions}
      statusOptions={[{ label: 'Exitosa', value: 'SUCCESS' }, { label: 'Fallida', value: 'FAILED' }, { label: 'Parcial', value: 'PARTIAL' }]}
      columns={[
        { key: 'createdAt', label: 'Fecha/hora', kind: 'date' },
        { key: 'moduleCode', label: 'Módulo' },
        { key: 'businessProcess', label: 'Proceso' },
        { key: 'actionCode', label: 'Acción' },
        { key: 'aggregateType', label: 'Entidad' },
        { key: 'aggregateId', label: 'ID agregado', kind: 'mono' },
        { key: 'status', label: 'Resultado', kind: 'status' },
      ]}
      metrics={[
        { label: 'Acciones registradas', value: (_rows, total) => total, detail: 'Ledger consultado', icon: 'history_edu' },
        { label: 'Exitosas', value: (rows) => rows.filter((row) => row.status === 'SUCCESS').length, detail: 'Página actual', icon: 'check_circle', tone: 'teal' },
        { label: 'Fallidas', value: (rows) => rows.filter((row) => row.status === 'FAILED').length, detail: 'Requieren análisis', icon: 'error', tone: 'red' },
        { label: 'Correlaciones', value: (rows) => new Set(rows.map((row) => row.correlationId).filter(Boolean)).size, detail: 'Flujos distinguibles', icon: 'link', tone: 'purple' },
      ]}
    />
  );
}
