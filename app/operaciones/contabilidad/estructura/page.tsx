'use client';

import { useCallback, useState } from 'react';
import { TabbedPanels } from '@/components/atlas/TabbedPanels';
import { WorkspaceHeader } from '@/components/atlas/WorkspaceHeader';
import { CrudDirectory } from '@/components/screens/CrudDirectory';
import { accountingService } from '@/services/accountingService';
import { domainLoader } from '@/services/domains';
import { useOptions } from '@/hooks/useOptions';
import { loadFiscalYears, loadLegalEntities } from '@/services/optionLoaders';

/**
 * Estructura financiera: TODO lo que se configura una vez y encabeza la contabilidad.
 *
 * Absorbió DOS entradas del menú: «Periodos y ledgers» y «Sucursales y fiscales». Pablo pidió la
 * primera el 2026-09-20 —«está de más, la verdad está un poco largo»—; la segunda vino detrás por
 * obligación, porque ahí vivían los «Años fiscales» y los períodos cuelgan de ellos: dejarlas
 * separadas habría puesto el ejercicio en una pantalla y sus meses en otra, y con «Años fiscales»
 * duplicado en las dos.
 *
 * Lo que sobraba era la ENTRADA, no la función: sin período abierto no se puede contabilizar nada,
 * y el 2026-09-21 los de DEV se acababan el 30 de septiembre. Por eso el contenido se mudó aquí en
 * vez de borrarse, y de paso los mensajes de error del backend («créalo en Estructura financiera»)
 * pasaron a señalar un sitio que existe.
 *
 * Configuración maestra de Contabilidad: de ocho entradas a cinco.
 */

/** Aviso común: el maestro se da de alta desde aquí, pero el backend todavía no expone corregirlo. */
const soloAlta = {
  tone: 'warning' as const,
  title: 'Alta sí, modificación todavía no',
  body: 'Este maestro se consulta y se da de alta, pero no se edita ni se borra, así que no hay lápiz. Si un dato está mal, corrígelo con un alta nueva y deja de usar la anterior.',
};

export default function FinancialStructurePage() {
  const [version, setVersion] = useState(0);
  const bump = () => setVersion((value) => value + 1);
  /* eslint-disable react-hooks/exhaustive-deps */
  const loadEntities = useCallback(() => accountingService.listLegalEntities(), [version]);
  const loadCostCenters = useCallback(() => accountingService.listCostCenters(), [version]);
  const loadProfitCenters = useCallback(() => accountingService.listProfitCenters(), [version]);
  const loadBankAccounts = useCallback(() => accountingService.listBankAccounts(), [version]);
  const loadBranches = useCallback(() => accountingService.listBranches(), [version]);
  const loadFiscalYearRows = useCallback(() => accountingService.listFiscalYears(), [version]);
  const loadPeriods = useCallback(() => accountingService.listAccountingPeriods(), [version]);
  const loadLedgers = useCallback(() => accountingService.listLedgers(), [version]);
  /* eslint-enable react-hooks/exhaustive-deps */
  const basesContables = useOptions(domainLoader('domain:accounting.ledgerBasis'));

  return (
    <div className="space-y-5">
      <WorkspaceHeader
        breadcrumbs={[{ label: 'Contabilidad' }, { label: 'Estructura' }]}
        title="Estructura financiera"
        description="Todo lo que se configura una vez: las empresas del grupo y sus dimensiones, y el calendario contable —ejercicios, períodos y libros— sin el que no se puede registrar nada."
      />
      <TabbedPanels
        tabs={[
          {
            id: 'entidades',
            /* Rótulos cortos: con ocho pestañas, «Entidades legales» empujaba la primera fuera de la
               barra a 1440 px, y la que se sale es justo por la que se empieza. El título largo
               sigue dentro del panel. */
            label: 'Empresas',
            icon: 'corporate_fare',
            content: (
              <CrudDirectory
                embedded
                moduleLabel="Contabilidad"
                title="Empresas del grupo"
                description="Cada entidad jurídica que emite libros y documentos contables. La empresa es quien declara impuestos; sus ubicaciones son las sucursales de la pestaña siguiente."
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
                  label: 'Crear empresa',
                  title: 'Nueva empresa del grupo',
                  description: 'Datos legales y tributarios de la entidad que encabezará los libros.',
                  fields: [
                    { name: 'code', label: 'Código interno', tooltip: 'Código interno de la entidad legal; aparece en la numeración de documentos. Ej.: ATL.', required: true, placeholder: 'ATLAS-BO' },
                    { name: 'legalName', label: 'Razón social', tooltip: 'Nombre legal tal como figura en el NIT o en el registro de comercio; es el que va en facturas y contratos.', required: true, placeholder: 'Razón social registrada', span: 2 },
                    { name: 'taxId', label: 'NIT', tooltip: 'NIT (o CI si es persona natural) sin puntos ni guiones. Ej.: 1023456019. Se valida contra el padrón.', optional: true, placeholder: 'NIT oficial' },
                    { name: 'countryCode', label: 'País', tooltip: 'País de residencia fiscal del socio; decide qué documento tributario se le exige.', required: true, defaultValue: 'BO', optionsSource: 'catalog:country' },
                    { name: 'baseCurrency', label: 'Moneda base', tooltip: 'Moneda en la que lleva la contabilidad la entidad; todo se convierte a ella.', required: true, defaultValue: 'BOB', optionsSource: 'catalog:currency' },
                    { name: 'timezone', label: 'Zona horaria', tooltip: 'Zona horaria de la entidad; decide a qué día pertenece cada asiento.', required: true, defaultValue: 'America/La_Paz', optionsSource: 'catalog:timezone', span: 2 },
                  ],
                  submit: async (payload) => { const created = await accountingService.createLegalEntity(payload); bump(); return created; },
                }}
              />
            ),
          },
          {
            id: 'sucursales',
            label: 'Sucursales',
            icon: 'store',
            content: (
              <CrudDirectory
                embedded
                moduleLabel="Contabilidad"
                title="Sucursales contables"
                description="Unidades de una empresa que emiten documentos. No son las sucursales de un comercio afiliado: ésas viven en su portal."
                load={loadBranches}
                labelKey="name"
                searchPlaceholder="Buscar por código, nombre o ciudad…"
                columns={[
                  { key: 'code', label: 'Código', kind: 'mono' },
                  { key: 'name', label: 'Nombre' },
                  { key: 'city', label: 'Ciudad' },
                  { key: 'status', label: 'Estado', kind: 'status' },
                ]}
                filters={[{ key: 'city', label: 'Ciudad' }, { key: 'status', label: 'Estado' }]}
                notice={soloAlta}
                create={{
                  label: 'Crear sucursal',
                  title: 'Nueva sucursal contable',
                  fields: [
                    { name: 'legalEntityId', label: 'Empresa', tooltip: 'Empresa del grupo de la que depende la sucursal.', type: 'select', required: true, span: 2, optionsLoader: loadLegalEntities },
                    { name: 'code', label: 'Código', tooltip: 'Código corto y único para citar la sucursal sin usar su identificador interno.', required: true, placeholder: 'SCZ-CENTRAL' },
                    { name: 'name', label: 'Nombre', tooltip: 'Nombre con el que se identifica la sucursal en listados e informes.', required: true, placeholder: 'Oficina central' },
                    { name: 'city', label: 'Ciudad', tooltip: 'Ciudad de la sede; sirve para asignar ejecutivo y zona de cobertura.', optional: true, span: 2, optionsSource: 'catalog:city' },
                  ],
                  submit: async (payload) => { const created = await accountingService.createBranch(payload); bump(); return created; },
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
                notice={{ tone: 'info', title: 'Sólo consulta', body: 'Los centros de costo sólo se consultan: hoy se cargan desde la configuración del sistema.' }}
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
                notice={{ tone: 'info', title: 'Sólo consulta', body: 'Aquí sólo se consulta: hoy estos datos se cargan desde la configuración del sistema.' }}
              />
            ),
          },
          {
            id: 'bancos',
            label: 'Bancos',
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
                notice={{ tone: 'info', title: 'Sólo consulta', body: 'Aquí sólo se consulta: hoy estos datos se cargan desde la configuración del sistema.' }}
              />
            ),
          },
          {
            id: 'ejercicios',
            label: 'Ejercicios',
            icon: 'event_note',
            content: (
              <CrudDirectory
                embedded
                moduleLabel="Contabilidad"
                title="Años fiscales"
                description="El ejercicio contable de cada empresa. De él cuelgan los períodos, así que sin ejercicio del año que viene no hay dónde crear enero."
                load={loadFiscalYearRows}
                labelKey="yearLabel"
                searchPlaceholder="Buscar por año o estado…"
                columns={[
                  { key: 'yearLabel', label: 'Ejercicio', kind: 'mono' },
                  { key: 'startDate', label: 'Desde', kind: 'date' },
                  { key: 'endDate', label: 'Hasta', kind: 'date' },
                  { key: 'status', label: 'Estado', kind: 'status' },
                ]}
                filters={[{ key: 'status', label: 'Estado' }]}
                emptyHint="Crea el ejercicio antes que sus períodos: los períodos cuelgan de él."
                notice={soloAlta}
                create={{
                  label: 'Crear año fiscal',
                  title: 'Nuevo año fiscal',
                  description: 'El ejercicio al que pertenecerán los períodos. Normalmente va del 1 de enero al 31 de diciembre.',
                  fields: [
                    { name: 'legalEntityId', label: 'Empresa', tooltip: 'Empresa del grupo cuyo ejercicio se abre; cada una lleva el suyo.', type: 'select', required: true, span: 2, optionsLoader: loadLegalEntities },
                    // La etiqueta la deriva el backend de las fechas («2027» o «2026-2027»).
                    { name: 'yearLabel', label: 'Etiqueta del ejercicio', tooltip: 'Nombre con el que se cita el ejercicio; lo deduce el sistema de las fechas.', assignedByBackend: true },
                    { name: 'startDate', label: 'Primer día', tooltip: 'Primer día del ejercicio. Ej.: 1 de enero.', type: 'date', required: true, defaultValue: '2027-01-01' },
                    { name: 'endDate', label: 'Último día', tooltip: 'Último día del ejercicio. Ej.: 31 de diciembre.', type: 'date', required: true, defaultValue: '2027-12-31' },
                  ],
                  submit: async (payload) => { const created = await accountingService.createFiscalYear(payload); bump(); return created; },
                }}
              />
            ),
          },
          {
            id: 'periodos',
            label: 'Períodos',
            icon: 'date_range',
            content: (
              <CrudDirectory
                embedded
                moduleLabel="Contabilidad"
                title="Períodos contables"
                description="Cada ventana en la que se pueden fechar contabilizaciones. Si la fecha de un documento no cae en un período ABIERTO, el sistema lo rechaza."
                load={loadPeriods}
                labelKey="periodNo"
                searchPlaceholder="Buscar por número o estado…"
                columns={[
                  { key: 'periodNo', label: 'Período', kind: 'mono' },
                  { key: 'startDate', label: 'Desde', kind: 'date' },
                  { key: 'endDate', label: 'Hasta', kind: 'date' },
                  { key: 'closeStatus', label: 'Estado', kind: 'status' },
                ]}
                filters={[{ key: 'closeStatus', label: 'Estado' }]}
                emptyHint="Sin períodos no se puede contabilizar nada: crea los meses del ejercicio en curso."
                notice={{
                  tone: 'warning',
                  title: 'Sin período, no hay contabilidad',
                  body: 'Los períodos se dan de alta aquí y no se editan: se abren y se cierran desde «Cierres». Crea los del año entero de una vez, porque el día que la fecha de una factura no caiga en ninguno abierto, dejará de poder emitirse —y el aviso hablará del período, no de la factura—.',
                }}
                create={{
                  label: 'Crear período',
                  title: 'Nuevo período contable',
                  description: 'Normalmente un mes. Cuelga del ejercicio, y su número lo pone el sistema.',
                  fields: [
                    { name: 'fiscalYearId', label: 'Ejercicio', tooltip: 'Año fiscal al que pertenece el período; si falta, créalo antes en «Años fiscales».', type: 'select', required: true, span: 2, optionsLoader: loadFiscalYears },
                    // El backend toma el siguiente número libre del año fiscal: pedirlo chocaba con el que ya existía.
                    { name: 'periodNo', label: 'Número de período', tooltip: 'Número del período dentro del año. Ej.: 9 para septiembre.', assignedByBackend: true },
                    { name: 'startDate', label: 'Primer día', tooltip: 'Primer día del período. Ej.: 1 de octubre.', type: 'date', required: true },
                    { name: 'endDate', label: 'Último día', tooltip: 'Último día del período. Ej.: 31 de octubre.', type: 'date', required: true, span: 2 },
                  ],
                  submit: async (payload) => { const created = await accountingService.createPeriod(payload); bump(); return created; },
                }}
              />
            ),
          },
          {
            id: 'libros',
            label: 'Libros',
            icon: 'menu_book',
            content: (
              <CrudDirectory
                embedded
                moduleLabel="Contabilidad"
                title="Libros contables"
                description="Libro por base normativa o propósito gerencial. El marcado como predeterminado es al que van los documentos de esa empresa."
                load={loadLedgers}
                labelKey="name"
                searchPlaceholder="Buscar por código, nombre o base contable…"
                columns={[
                  { key: 'code', label: 'Código', kind: 'mono' },
                  { key: 'name', label: 'Nombre' },
                  { key: 'accountingBasis', label: 'Base contable' },
                  { key: 'isDefault', label: 'Predeterminado', kind: 'bool' },
                  { key: 'status', label: 'Estado', kind: 'status' },
                ]}
                filters={[{ key: 'accountingBasis', label: 'Base contable', options: basesContables }, { key: 'status', label: 'Estado' }]}
                notice={soloAlta}
                create={{
                  label: 'Crear libro',
                  title: 'Nuevo libro contable',
                  description: 'Un libro paralelo para otra base normativa. Casi siempre basta con el predeterminado que ya existe.',
                  fields: [
                    { name: 'legalEntityId', label: 'Empresa', tooltip: 'Empresa del grupo a la que pertenece el libro.', type: 'select', required: true, span: 2, optionsLoader: loadLegalEntities },
                    { name: 'code', label: 'Código', tooltip: 'Código corto y único para citar el libro sin usar su identificador interno.', required: true, placeholder: 'LOCAL-BO' },
                    { name: 'name', label: 'Nombre', tooltip: 'Nombre con el que se identifica el libro en listados e informes.', required: true, placeholder: 'Libro local Bolivia' },
                    { name: 'accountingBasis', label: 'Base contable', tooltip: 'Base normativa del libro: local, gerencial o IFRS.', required: true, defaultValue: 'LOCAL_BO', span: 2, optionsSource: 'domain:accounting.ledgerBasis' },
                    { name: 'isDefault', label: 'Libro predeterminado', tooltip: 'Libro por defecto de la empresa; los documentos van a él si no se indica otro.', type: 'select', valueKind: 'boolean', defaultValue: 'false', span: 2, options: [{ label: 'No', value: 'false' }, { label: 'Sí', value: 'true' }] },
                  ],
                  submit: async (payload) => { const created = await accountingService.createLedger(payload); bump(); return created; },
                }}
              />
            ),
          },
        ]}
      />
    </div>
  );
}
