'use client';

import { useCallback, useState } from 'react';
import { CrudDirectory } from '@/components/screens/CrudDirectory';
import { accountingService } from '@/services/accountingService';
import { cargarTodo } from '@/lib/cargarTodo';
import { glAccountTypeOptions, recordStatusOptions } from '@/lib/catalogs';
import { loadChartsOfAccounts, loadGlAccounts, withEmpty } from '@/services/optionLoaders';

const detailBase = '/operaciones/contabilidad/cuentas-gl/detalle';
const banderas = ['isControlAccount', 'requiresCostCenter', 'requiresProfitCenter', 'requiresPartner', 'requiresTaxCode'];
const siNo = [{ label: 'No', value: 'false' }, { label: 'Sí', value: 'true' }];

export default function GlAccountsPage() {
  const [version, setVersion] = useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(() => cargarTodo((query) => accountingService.listGlAccounts(query)), [version]);

  return (
    <CrudDirectory
      moduleLabel="Contabilidad"
      title="Plan de cuentas (cuentas GL)"
      description="Todas las cuentas del plan operativo, su clasificación contable y las dimensiones que exigen."
      load={load}
      labelKey="accountNo"
      searchPlaceholder="Buscar por número o nombre de cuenta…"
      pageSize={50}
      columns={[
        { key: 'accountNo', label: 'Cuenta', kind: 'mono' },
        { key: 'name', label: 'Descripción' },
        { key: 'accountType', label: 'Clasificación' },
        { key: 'normalBalance', label: 'Naturaleza' },
        { key: 'isControlAccount', label: 'Control', kind: 'bool' },
        { key: 'requiresCostCenter', label: 'Centro costo', kind: 'bool' },
        { key: 'requiresPartner', label: 'Partner', kind: 'bool' },
      ]}
      filters={[
        { key: 'accountType', label: 'Clasificación', options: glAccountTypeOptions },
        { key: 'status', label: 'Estado', options: recordStatusOptions },
        { key: 'normalBalance', label: 'Naturaleza', options: [{ label: 'Débito', value: 'D' }, { label: 'Crédito', value: 'C' }] },
      ]}
      notice={{
        tone: 'info',
        title: 'Sin papelera, y es a propósito',
        body: 'Una cuenta GL con movimientos no se puede borrar sin romper el mayor. Lo que corresponde es desactivarla para que deje de admitir imputaciones nuevas.',
      }}
      create={{
        label: 'Nueva cuenta GL',
        title: 'Nueva cuenta del plan',
        description: 'Cuenta dentro de una versión vigente del plan, con sus dimensiones obligatorias.',
        fields: [
          { name: 'coaId', label: 'Plan de cuentas (COA)', type: 'select', required: true, span: 2, optionsLoader: loadChartsOfAccounts },
          { name: 'parentAccountId', label: 'Cuenta padre', type: 'select', optional: true, span: 2, optionsLoader: async () => withEmpty(await loadGlAccounts()) },
          { name: 'accountNo', label: 'Número de cuenta', required: true },
          { name: 'name', label: 'Nombre', required: true },
          { name: 'accountType', label: 'Tipo', type: 'select', required: true, options: ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE', 'CONTRA_ASSET'].map((value) => ({ label: value, value })) },
          { name: 'normalBalance', label: 'Naturaleza', type: 'select', required: true, options: [{ label: 'Débito', value: 'D' }, { label: 'Crédito', value: 'C' }] },
          ...banderas.map((name) => ({ name, label: name.replace(/([A-Z])/g, ' $1'), type: 'select' as const, valueKind: 'boolean' as const, defaultValue: 'false', options: siNo })),
        ],
        submit: async (payload) => { const created = await accountingService.createGlAccount(payload); setVersion((value) => value + 1); return created; },
      }}
      edit={{
        description: 'El número de cuenta y su plan no se cambian: son la referencia de los asientos ya contabilizados.',
        fields: [
          { name: 'name', label: 'Nombre', required: true, span: 2 },
          { name: 'accountType', label: 'Tipo', type: 'select', options: ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE', 'CONTRA_ASSET'].map((value) => ({ label: value, value })) },
          { name: 'normalBalance', label: 'Naturaleza', type: 'select', options: [{ label: 'Débito', value: 'D' }, { label: 'Crédito', value: 'C' }] },
          ...banderas.map((name) => ({ name, label: name.replace(/([A-Z])/g, ' $1'), type: 'select' as const, valueKind: 'boolean' as const, options: siNo })),
        ],
        submit: (id, payload) => accountingService.updateGlAccount(id, payload),
      }}
      extraActions={[{ key: 'ficha', label: 'Abrir ficha completa', icon: 'visibility', href: (row) => `${detailBase}?id=${String(row.id ?? '')}` }]}
    />
  );
}
