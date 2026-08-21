'use client';

import { LiveDirectoryScreen } from '@/components/screens/LiveDirectoryScreen';
import { accountingService } from '@/services/accountingService';
import { glAccountTypeOptions, recordStatusOptions } from '@/lib/catalogs';

const detailBase = '/operaciones/contabilidad/cuentas-gl/detalle';

export default function GlAccountsPage() {
  return (
    <LiveDirectoryScreen
      moduleLabel="Contabilidad"
      title="Plan de cuentas (cuentas GL)"
      description="Plan de cuentas operativo, clasificación contable y banderas de control por dimensión."
      load={accountingService.listGlAccounts}
      createHref="/operaciones/contabilidad/cuentas-gl/crear"
      createLabel="Nueva cuenta GL"
      detailHref={(row) => (row.id ? `${detailBase}?id=${row.id}` : undefined)}
      rowActions={(row) =>
        row.id
          ? [
              { key: 'view', label: 'Ver', icon: 'visibility', href: `${detailBase}?id=${row.id}` },
              { key: 'edit', label: 'Editar', icon: 'edit', href: `${detailBase}?id=${row.id}` },
            ]
          : []
      }
      filters={[
        { key: 'accountType', label: 'Clasificación', options: glAccountTypeOptions },
        { key: 'status', label: 'Estado', options: recordStatusOptions },
      ]}
      columns={[
        { key: 'accountNo', label: 'Cuenta', kind: 'mono' },
        { key: 'name', label: 'Descripción' },
        { key: 'accountType', label: 'Clasificación' },
        { key: 'normalBalance', label: 'Naturaleza', align: 'center' },
        { key: 'isControlAccount', label: 'Control', kind: 'status' },
        { key: 'requiresCostCenter', label: 'Centro costo', kind: 'status' },
        { key: 'requiresPartner', label: 'Partner', kind: 'status' },
      ]}
      metrics={[
        { label: 'Cuentas activas', value: (_rows, total) => total, detail: 'Versión vigente del COA', icon: 'account_tree' },
        { label: 'Activos', value: (rows) => rows.filter((row) => row.accountType === 'ASSET').length, detail: 'Página actual', icon: 'savings', tone: 'teal' },
        { label: 'Cuentas control', value: (rows) => rows.filter((row) => row.isControlAccount === true).length, detail: 'Conciliación obligatoria', icon: 'rule', tone: 'amber' },
        { label: 'Con dimensiones', value: (rows) => rows.filter((row) => row.requiresCostCenter === true || row.requiresProfitCenter === true).length, detail: 'Exigen imputación', icon: 'account_tree', tone: 'purple' },
      ]}
      searchPlaceholder="Buscar número o nombre de cuenta..."
    />
  );
}
