'use client';

import { useCallback, useState } from 'react';
import { TabbedPanels } from '@/components/atlas/TabbedPanels';
import { WorkspaceHeader } from '@/components/atlas/WorkspaceHeader';
import { AccountGroupsScreen } from '@/components/screens/AccountGroupsScreen';
import { CrudDirectory } from '@/components/screens/CrudDirectory';
import { accountingService } from '@/services/accountingService';
import { cargarTodo } from '@/lib/cargarTodo';
import { accountClassificationOptions, statementTypeOptions } from '@/lib/catalogs';
import { loadAccountGroups, loadChartsOfAccounts, withEmpty } from '@/services/optionLoaders';

export default function AccountGroupsPage() {
  const [version, setVersion] = useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(() => cargarTodo((query) => accountingService.listAccountGroups(query)), [version]);

  return (
    <div className="space-y-5">
      <WorkspaceHeader
        breadcrumbs={[{ label: 'Contabilidad' }, { label: 'Grupos de cuenta' }]}
        title="Grupos de cuenta"
        description="Taxonomía de reporte para estados financieros. Independiente de la jerarquía cuenta a cuenta."
      />
      <TabbedPanels
        tabs={[
          {
            id: 'listado',
            label: 'Todos los grupos',
            icon: 'table_view',
            content: (
              <CrudDirectory
                embedded
                moduleLabel="Contabilidad"
                title="Grupos de cuenta"
                description="Listado plano de la taxonomía, con su clasificación y estado."
                load={load}
                labelKey="name"
                searchPlaceholder="Buscar por código o nombre…"
                columns={[
                  { key: 'code', label: 'Código', kind: 'mono' },
                  { key: 'name', label: 'Nombre' },
                  { key: 'statementType', label: 'Estado financiero' },
                  { key: 'classification', label: 'Clasificación' },
                  { key: 'subClassification', label: 'Subclasificación' },
                  { key: 'sortOrder', label: 'Orden', align: 'right' },
                  { key: 'status', label: 'Estado', kind: 'status' },
                ]}
                filters={[
                  { key: 'statementType', label: 'Estado financiero', options: statementTypeOptions },
                  { key: 'classification', label: 'Clasificación', options: accountClassificationOptions },
                  { key: 'status', label: 'Estado' },
                ]}
                notice={{
                  tone: 'info',
                  title: 'Sin papelera',
                  body: 'Borrar un grupo dejaría huérfanas las cuentas colgadas de él y descuadraría los estados financieros que lo usan. Para retirarlo, cámbialo a estado inactivo.',
                }}
                create={{
                  label: 'Crear grupo',
                  title: 'Nuevo grupo de cuenta',
                  fields: [
                    { name: 'coaId', label: 'Plan de cuentas (COA)', type: 'select', required: true, span: 2, optionsLoader: loadChartsOfAccounts },
                    { name: 'parentGroupId', label: 'Grupo padre', type: 'select', optional: true, span: 2, optionsLoader: async () => withEmpty(await loadAccountGroups()) },
                    { name: 'code', label: 'Código', required: true },
                    { name: 'name', label: 'Nombre', required: true },
                    { name: 'statementType', label: 'Estado financiero', type: 'select', required: true, defaultValue: 'BALANCE_SHEET', options: statementTypeOptions },
                    { name: 'classification', label: 'Clasificación', type: 'select', required: true, defaultValue: 'ASSET', options: accountClassificationOptions },
                    { name: 'subClassification', label: 'Subclasificación', optional: true },
                    { name: 'sortOrder', label: 'Orden', type: 'number', valueKind: 'number', defaultValue: 0 },
                  ],
                  submit: async (payload) => { const created = await accountingService.createAccountGroup(payload); setVersion((value) => value + 1); return created; },
                }}
                edit={{
                  description: 'El plan y el código no se cambian: son la referencia con la que las cuentas cuelgan del grupo.',
                  fields: [
                    { name: 'name', label: 'Nombre', required: true, span: 2 },
                    { name: 'statementType', label: 'Estado financiero', type: 'select', options: statementTypeOptions },
                    { name: 'classification', label: 'Clasificación', type: 'select', options: accountClassificationOptions },
                    { name: 'subClassification', label: 'Subclasificación', optional: true },
                    { name: 'sortOrder', label: 'Orden', type: 'number', valueKind: 'number' },
                  ],
                  submit: (id, payload) => accountingService.updateAccountGroup(id, payload),
                }}
              />
            ),
          },
          { id: 'arbol', label: 'Jerarquía', icon: 'account_tree', content: <AccountGroupsScreen embedded /> },
        ]}
      />
    </div>
  );
}
