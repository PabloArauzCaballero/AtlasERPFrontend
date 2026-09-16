'use client';

import { useCallback, useState } from 'react';
import { TabbedPanels } from '@/components/atlas/TabbedPanels';
import { WorkspaceHeader } from '@/components/atlas/WorkspaceHeader';
import { CrudDirectory } from '@/components/screens/CrudDirectory';
import { useOptions } from '@/hooks/useOptions';
import { accountingService } from '@/services/accountingService';
import { domainLoader } from '@/services/domains';

const soloAlta = {
  tone: 'warning' as const,
  title: 'Alta sí, modificación todavía no',
  body: 'Aquí se consulta y se da de alta, pero no se edita ni se borra. Tanto el plan de cuentas como los impuestos son versionados: lo correcto es cerrar la vigencia del anterior y dar de alta la versión nueva.',
};

export default function TaxesCoaPage() {
  const [version, setVersion] = useState(0);
  const bump = () => setVersion((value) => value + 1);
  /* eslint-disable react-hooks/exhaustive-deps */
  const loadCharts = useCallback(() => accountingService.listChartsOfAccounts(), [version]);
  const loadTaxes = useCallback(() => accountingService.listTaxCodes(), [version]);
  /* eslint-enable react-hooks/exhaustive-deps */
  const tiposImpuesto = useOptions(domainLoader('domain:accounting.taxType'));

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
                    { name: 'code', label: 'Código', tooltip: 'Código corto y único para citar el registro sin usar su identificador interno.', required: true, placeholder: 'COA-BO' },
                    { name: 'versionNo', label: 'Versión', tooltip: 'Versión del plan de cuentas a la que aplica.', type: 'number', valueKind: 'number', required: true, defaultValue: 1 },
                    { name: 'name', label: 'Nombre', tooltip: 'Nombre con el que se identifica el registro en listados e informes.', required: true, placeholder: 'Plan de cuentas ATLAS Bolivia', span: 2 },
                    { name: 'effectiveFrom', label: 'Vigente desde', tooltip: 'Desde cuándo vale; antes de esta fecha el rol no aplica.', type: 'date', required: true },
                    { name: 'effectiveTo', label: 'Vigente hasta', tooltip: 'Hasta cuándo vale; vacío = sin fecha de fin.', type: 'date', optional: true },
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
                filters={[{ key: 'taxType', label: 'Tipo', options: tiposImpuesto }]}
                notice={soloAlta}
                create={{
                  label: 'Crear código tributario',
                  title: 'Nuevo código tributario',
                  fields: [
                    { name: 'code', label: 'Código', tooltip: 'Código corto y único para citar el registro sin usar su identificador interno.', required: true, placeholder: 'IVA13_VENTA' },
                    { name: 'taxType', label: 'Tipo', tooltip: 'Tipo de impuesto (IVA, IT, retención…); decide cómo se calcula y declara.', required: true, optionsSource: 'domain:accounting.taxType' },
                    { name: 'rate', label: 'Tasa (%)', tooltip: 'Tasa en porcentaje. Ej.: 13.', type: 'number', valueKind: 'number', required: true, defaultValue: 13 },
                    { name: 'recoverablePercent', label: 'Recuperable (%)', tooltip: 'Porcentaje del impuesto que se recupera como crédito fiscal. Ej.: 100.', type: 'number', valueKind: 'number', required: true, defaultValue: 0 },
                    { name: 'effectiveFrom', label: 'Vigente desde', tooltip: 'Desde cuándo vale; antes de esta fecha el rol no aplica.', type: 'date', required: true },
                    { name: 'effectiveTo', label: 'Vigente hasta', tooltip: 'Hasta cuándo vale; vacío = sin fecha de fin.', type: 'date', optional: true },
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
