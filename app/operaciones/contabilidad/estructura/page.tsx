'use client';

import { useCallback, useState } from 'react';
import { TabbedPanels } from '@/components/atlas/TabbedPanels';
import { WorkspaceHeader } from '@/components/atlas/WorkspaceHeader';
import { CrudDirectory } from '@/components/screens/CrudDirectory';
import { accountingService } from '@/services/accountingService';
import { countryOptions, currencyOptions, timezoneOptions } from '@/lib/catalogs';

/** Aviso común: el maestro se da de alta desde aquí, pero el backend todavía no expone corregirlo. */
const soloAlta = {
  tone: 'warning' as const,
  title: 'Alta sí, modificación todavía no',
  body: 'El backend expone listar y crear para este maestro, pero aún no PATCH ni DELETE, así que no se pinta un lápiz que devolvería 404. Si un dato está mal, corrígelo con un alta nueva y deja de usar la anterior.',
};

export default function FinancialStructurePage() {
  const [version, setVersion] = useState(0);
  const bump = () => setVersion((value) => value + 1);
  /* eslint-disable react-hooks/exhaustive-deps */
  const loadEntities = useCallback(() => accountingService.listLegalEntities(), [version]);
  const loadCostCenters = useCallback(() => accountingService.listCostCenters(), [version]);
  const loadProfitCenters = useCallback(() => accountingService.listProfitCenters(), [version]);
  const loadBankAccounts = useCallback(() => accountingService.listBankAccounts(), [version]);
  /* eslint-enable react-hooks/exhaustive-deps */

  return (
    <div className="space-y-5">
      <WorkspaceHeader
        breadcrumbs={[{ label: 'Contabilidad' }, { label: 'Estructura' }]}
        title="Estructura financiera"
        description="Entidades legales, centros de costo y de beneficio, y cuentas bancarias que encabezan libros, períodos e impuestos."
      />
      <TabbedPanels
        tabs={[
          {
            id: 'entidades',
            label: 'Entidades legales',
            icon: 'corporate_fare',
            content: (
              <CrudDirectory
                embedded
                moduleLabel="Contabilidad"
                title="Entidades legales"
                description="Cada entidad jurídica que emite libros y documentos contables."
                load={loadEntities}
                labelKey="legalName"
                searchPlaceholder="Buscar por código, razón social o NIT…"
                columns={[
                  { key: 'code', label: 'Código', kind: 'mono' },
                  { key: 'legalName', label: 'Razón social' },
                  { key: 'taxId', label: 'NIT', kind: 'pii' },
                  { key: 'countryCode', label: 'País' },
                  { key: 'baseCurrency', label: 'Moneda base' },
                  { key: 'timezone', label: 'Zona horaria' },
                ]}
                filters={[{ key: 'countryCode', label: 'País' }, { key: 'baseCurrency', label: 'Moneda' }]}
                notice={soloAlta}
                create={{
                  label: 'Crear entidad legal',
                  title: 'Nueva entidad legal',
                  description: 'Datos legales y tributarios de la entidad que encabezará los libros.',
                  fields: [
                    { name: 'code', label: 'Código interno', required: true, placeholder: 'ATLAS-BO' },
                    { name: 'legalName', label: 'Razón social', required: true, placeholder: 'Razón social registrada', span: 2 },
                    { name: 'taxId', label: 'NIT', optional: true, placeholder: 'NIT oficial' },
                    { name: 'countryCode', label: 'País', type: 'select', required: true, defaultValue: 'BO', options: countryOptions },
                    { name: 'baseCurrency', label: 'Moneda base', type: 'select', required: true, defaultValue: 'BOB', options: currencyOptions },
                    { name: 'timezone', label: 'Zona horaria', type: 'select', required: true, defaultValue: 'America/La_Paz', options: timezoneOptions, span: 2 },
                  ],
                  submit: async (payload) => { const created = await accountingService.createLegalEntity(payload); bump(); return created; },
                }}
              />
            ),
          },
          {
            id: 'centros-costo',
            label: 'Centros de costo',
            icon: 'donut_small',
            content: (
              <CrudDirectory
                embedded
                moduleLabel="Contabilidad"
                title="Centros de costo"
                description="Dimensión de imputación para las cuentas que la exigen."
                load={loadCostCenters}
                labelKey="name"
                columns={[
                  { key: 'code', label: 'Código', kind: 'mono' },
                  { key: 'name', label: 'Nombre' },
                  { key: 'status', label: 'Estado', kind: 'status' },
                ]}
                filters={[{ key: 'status', label: 'Estado' }]}
                emptyHint="Todavía no hay centros de costo cargados en esta base."
                notice={{ tone: 'info', title: 'Sólo consulta', body: 'El backend expone el listado de centros de costo, pero no su alta ni su edición: hoy se cargan por migración.' }}
              />
            ),
          },
          {
            id: 'centros-beneficio',
            label: 'Centros de beneficio',
            icon: 'trending_up',
            content: (
              <CrudDirectory
                embedded
                moduleLabel="Contabilidad"
                title="Centros de beneficio"
                description="Dimensión de resultado para las cuentas que la exigen."
                load={loadProfitCenters}
                labelKey="name"
                columns={[
                  { key: 'code', label: 'Código', kind: 'mono' },
                  { key: 'name', label: 'Nombre' },
                  { key: 'status', label: 'Estado', kind: 'status' },
                ]}
                filters={[{ key: 'status', label: 'Estado' }]}
                emptyHint="Todavía no hay centros de beneficio cargados en esta base."
                notice={{ tone: 'info', title: 'Sólo consulta', body: 'El backend expone el listado, pero no el alta ni la edición: hoy se cargan por migración.' }}
              />
            ),
          },
          {
            id: 'bancos',
            label: 'Cuentas bancarias',
            icon: 'account_balance',
            content: (
              <CrudDirectory
                embedded
                moduleLabel="Contabilidad"
                title="Cuentas bancarias"
                description="Cuentas por las que entran y salen los fondos de cada entidad."
                load={loadBankAccounts}
                labelKey="accountName"
                columns={[
                  { key: 'accountName', label: 'Cuenta' },
                  { key: 'bankName', label: 'Banco' },
                  { key: 'accountNumber', label: 'Número', kind: 'pii' },
                  { key: 'currencyCode', label: 'Moneda' },
                  { key: 'status', label: 'Estado', kind: 'status' },
                ]}
                filters={[{ key: 'currencyCode', label: 'Moneda' }, { key: 'status', label: 'Estado' }]}
                emptyHint="Todavía no hay cuentas bancarias registradas en esta base."
                notice={{ tone: 'info', title: 'Sólo consulta', body: 'El backend expone el listado, pero no el alta ni la edición: hoy se cargan por migración.' }}
              />
            ),
          },
        ]}
      />
    </div>
  );
}
