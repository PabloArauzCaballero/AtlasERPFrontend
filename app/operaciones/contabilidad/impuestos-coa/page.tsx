'use client';

import { useCallback, useState } from 'react';
import { TabbedPanels } from '@/components/atlas/TabbedPanels';
import { WorkspaceHeader } from '@/components/atlas/WorkspaceHeader';
import { CrudDirectory } from '@/components/screens/CrudDirectory';
import { accountingService } from '@/services/accountingService';

const soloAlta = {
  tone: 'warning' as const,
  title: 'Alta sí, modificación todavía no',
  body: 'El backend expone listar y crear, pero aún no PATCH ni DELETE. Tanto el plan de cuentas como los impuestos son versionados: lo correcto es cerrar la vigencia del anterior y dar de alta la versión nueva.',
};

export default function TaxesCoaPage() {
  const [version, setVersion] = useState(0);
  const bump = () => setVersion((value) => value + 1);
  /* eslint-disable react-hooks/exhaustive-deps */
  const loadCharts = useCallback(() => accountingService.listChartsOfAccounts(), [version]);
  const loadTaxes = useCallback(() => accountingService.listTaxCodes(), [version]);
  /* eslint-enable react-hooks/exhaustive-deps */

  return (
    <div className="space-y-5">
      <WorkspaceHeader
        breadcrumbs={[{ label: 'Contabilidad' }, { label: 'Impuestos y COA' }]}
        title="Impuestos y plan de cuentas"
        description="Versiones del plan de cuentas y códigos tributarios con vigencia controlada."
      />
      <TabbedPanels
        tabs={[
          {
            id: 'coa',
            label: 'Planes de cuentas',
            icon: 'account_tree',
            content: (
              <CrudDirectory
                embedded
                moduleLabel="Contabilidad"
                title="Planes de cuentas (COA)"
                description="Cada versión del plan de cuentas y su ventana de vigencia."
                load={loadCharts}
                labelKey="name"
                searchPlaceholder="Buscar por código o nombre…"
                columns={[
                  { key: 'code', label: 'Código', kind: 'mono' },
                  { key: 'name', label: 'Nombre' },
                  { key: 'versionNo', label: 'Versión', align: 'right' },
                  { key: 'effectiveFrom', label: 'Vigente desde', kind: 'date' },
                  { key: 'effectiveTo', label: 'Vigente hasta', kind: 'date' },
                  { key: 'status', label: 'Estado', kind: 'status' },
                ]}
                filters={[{ key: 'status', label: 'Estado' }]}
                notice={soloAlta}
                create={{
                  label: 'Crear versión COA',
                  title: 'Nueva versión del plan de cuentas',
                  fields: [
                    { name: 'code', label: 'Código', required: true, placeholder: 'COA-BO' },
                    { name: 'versionNo', label: 'Versión', type: 'number', valueKind: 'number', required: true, defaultValue: 1 },
                    { name: 'name', label: 'Nombre', required: true, placeholder: 'Plan de cuentas ATLAS Bolivia', span: 2 },
                    { name: 'effectiveFrom', label: 'Vigente desde', type: 'date', required: true },
                    { name: 'effectiveTo', label: 'Vigente hasta', type: 'date', optional: true },
                  ],
                  submit: async (payload) => { const created = await accountingService.createChartOfAccounts(payload); bump(); return created; },
                }}
              />
            ),
          },
          {
            id: 'impuestos',
            label: 'Códigos tributarios',
            icon: 'receipt',
            content: (
              <CrudDirectory
                embedded
                moduleLabel="Contabilidad"
                title="Códigos tributarios"
                description="Tasa, recuperabilidad y vigencia de cada impuesto aplicable."
                load={loadTaxes}
                labelKey="code"
                searchPlaceholder="Buscar por código o tipo…"
                columns={[
                  { key: 'code', label: 'Código', kind: 'mono' },
                  { key: 'taxType', label: 'Tipo' },
                  { key: 'rate', label: 'Tasa %', align: 'right' },
                  { key: 'recoverablePercent', label: 'Recuperable %', align: 'right' },
                  { key: 'effectiveFrom', label: 'Vigente desde', kind: 'date' },
                  { key: 'effectiveTo', label: 'Vigente hasta', kind: 'date' },
                ]}
                filters={[{ key: 'taxType', label: 'Tipo' }]}
                notice={soloAlta}
                create={{
                  label: 'Crear código tributario',
                  title: 'Nuevo código tributario',
                  fields: [
                    { name: 'code', label: 'Código', required: true, placeholder: 'IVA13_VENTA' },
                    { name: 'taxType', label: 'Tipo', type: 'select', required: true, options: [
                      { label: 'IVA', value: 'IVA' }, { label: 'IT', value: 'IT' }, { label: 'IUE', value: 'IUE' }, { label: 'Retención', value: 'RETENTION' }, { label: 'Otro', value: 'OTHER' },
                    ] },
                    { name: 'rate', label: 'Tasa (%)', type: 'number', valueKind: 'number', required: true, defaultValue: 13 },
                    { name: 'recoverablePercent', label: 'Recuperable (%)', type: 'number', valueKind: 'number', required: true, defaultValue: 0 },
                    { name: 'effectiveFrom', label: 'Vigente desde', type: 'date', required: true },
                    { name: 'effectiveTo', label: 'Vigente hasta', type: 'date', optional: true },
                  ],
                  submit: async (payload) => { const created = await accountingService.createTaxCode(payload); bump(); return created; },
                }}
              />
            ),
          },
        ]}
      />
    </div>
  );
}
