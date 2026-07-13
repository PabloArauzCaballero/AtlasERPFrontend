'use client';

import { LiveDirectoryScreen } from '@/components/screens/LiveDirectoryScreen';
import { b2bService } from '@/services/b2bService';

export default function B2BAccountsPage() {
  return (
    <LiveDirectoryScreen
      moduleLabel="CRM"
      title="Accounts Directory"
      description="Gestione entidades comerciales, perfiles de cumplimiento, propiedad de cuenta y estado del ciclo de vida."
      load={b2bService.listAccounts}
      createHref="/operaciones/crm/cuentas/crear"
      createLabel="Crear cuenta"
      searchPlaceholder="Buscar por nombre comercial, razón social o NIT..."
      statusOptions={[
        { label: 'Lead', value: 'LEAD' }, { label: 'Calificada', value: 'QUALIFIED' },
        { label: 'Cliente', value: 'CUSTOMER' }, { label: 'Suspendida', value: 'SUSPENDED' },
        { label: 'Descalificada', value: 'DISQUALIFIED' },
      ]}
      filters={[
        { key: 'category', label: 'Categoría', kind: 'text', placeholder: 'Filtrar categoría' },
        { key: 'businessLine', label: 'Rubro', kind: 'text', placeholder: 'Filtrar rubro' },
        { key: 'tag', label: 'Tag', kind: 'text', placeholder: 'Filtrar tag' },
      ]}
      columns={[
        { key: 'tradeName', label: 'Cuenta comercial' },
        { key: 'legalName', label: 'Razón social' },
        { key: 'taxId', label: 'NIT', kind: 'pii' },
        { key: 'accountType', label: 'Tipo' },
        { key: 'industry', label: 'Industria' },
        { key: 'category', label: 'Categoría' },
        { key: 'businessLine', label: 'Rubro' },
        { key: 'tags', label: 'Tags', kind: 'list' },
        { key: 'expectedMonthlyVolume', label: 'Volumen mensual', kind: 'money', align: 'right' },
        { key: 'lifecycleStatus', label: 'Estado', kind: 'status' },
      ]}
      metrics={[
        { label: 'Total cuentas', value: (_rows, total) => total.toLocaleString('es-BO'), detail: 'Directorio institucional', icon: 'groups' },
        { label: 'Clientes activos', value: (rows) => rows.filter((row) => row.lifecycleStatus === 'CUSTOMER').length, detail: 'En la página actual', icon: 'storefront', tone: 'teal' },
        { label: 'En calificación', value: (rows) => rows.filter((row) => row.lifecycleStatus === 'QUALIFIED' || row.lifecycleStatus === 'LEAD').length, detail: 'Requieren seguimiento', icon: 'fact_check', tone: 'amber' },
        { label: 'Riesgo observado', value: (rows) => rows.filter((row) => String(row.riskTier ?? '').toUpperCase().includes('HIGH')).length, detail: 'Revisión manual', icon: 'shield', tone: 'red' },
      ]}
      detailHref={(row) => row.id ? `/operaciones/crm/cuentas/detalle?id=${String(row.id)}` : undefined}
    />
  );
}
