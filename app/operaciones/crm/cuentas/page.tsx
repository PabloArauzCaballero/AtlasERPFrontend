'use client';

import { LiveDirectoryScreen } from '@/components/screens/LiveDirectoryScreen';
import { camposDeSecciones } from '@/components/screens/useExcelImport';
import { seccionesAltaCuentaB2b } from '@/components/screens/altas/cuentaB2b';
import { b2bService } from '@/services/b2bService';

export default function B2BAccountsPage() {
  return (
    <LiveDirectoryScreen
      moduleLabel="CRM"
      title="Directorio de cuentas B2B"
      description="Gestione entidades comerciales, perfiles de cumplimiento, propiedad de cuenta y estado del ciclo de vida."
      load={b2bService.listAccounts}
      createHref="/operaciones/crm/cuentas/crear"
      createLabel="Crear cuenta"
      /*
       * Carga masiva: los MISMOS campos y el MISMO endpoint del alta. Es el listado más usado del
       * ERP y era el que menos forma tenía de cargar nada: su «Carga masiva» se retiró con las
       * otras dos y nadie la sustituyó aquí, porque el alta vive en su propia página y el listado
       * no tenía de dónde sacar la plantilla. Ahora sale del mismo módulo que el formulario.
       */
      importar={{ entidad: 'empresas', fields: camposDeSecciones(seccionesAltaCuentaB2b), submit: b2bService.createAccount }}
      searchPlaceholder="Buscar por nombre, razón social, NIT, categoría, rubro o ciudad..."
      statusOptions={[
        { label: 'Lead', value: 'LEAD' }, { label: 'Calificada', value: 'QUALIFIED' },
        { label: 'Cliente', value: 'CUSTOMER' }, { label: 'Suspendida', value: 'SUSPENDED' },
        { label: 'Descalificada', value: 'DISQUALIFIED' },
      ]}
      filters={[
        { key: 'category', label: 'Categoría', kind: 'text', placeholder: 'Categoría contiene…', tooltip: 'Muestra las cuentas cuya categoría contiene lo que escribas, sin distinguir mayúsculas. Ej.: «restaur» encuentra «Restaurantes».' },
        { key: 'businessLine', label: 'Rubro', kind: 'text', placeholder: 'Rubro contiene…', tooltip: 'Muestra las cuentas cuyo rubro contiene lo que escribas, sin distinguir mayúsculas.' },
        { key: 'tag', label: 'Tag', kind: 'text', placeholder: 'Tag contiene…', tooltip: 'Muestra las cuentas con alguna etiqueta que contenga lo que escribas, sin distinguir mayúsculas.' },
        { key: 'includeArchived', label: 'Archivadas', kind: 'select', allLabel: 'Sin archivadas', options: [{ label: 'Con archivadas', value: 'true' }] },
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
        // Las tres de abajo cuentan la PÁGINA cargada: el servidor no devuelve esos totales.
        { label: 'Clientes activos', value: (rows) => rows.filter((row) => row.lifecycleStatus === 'CUSTOMER').length, soloPagina: true, icon: 'storefront', tone: 'teal' },
        { label: 'En calificación', value: (rows) => rows.filter((row) => row.lifecycleStatus === 'QUALIFIED' || row.lifecycleStatus === 'LEAD').length, soloPagina: true, icon: 'fact_check', tone: 'amber' },
        // Alto y crítico: con sólo `HIGH` un comercio CRITICAL no contaba como riesgo observado.
        { label: 'Riesgo observado', value: (rows) => rows.filter((row) => /HIGH|CRITICAL/.test(String(row.riskTier ?? '').toUpperCase())).length, soloPagina: true, icon: 'shield', tone: 'red' },
      ]}
      detailHref={(row) => row.id ? `/operaciones/crm/cuentas/detalle?id=${String(row.id)}` : undefined}
      rowActions={(row) => {
        const id = row.id ? String(row.id) : '';
        const name = String(row.tradeName ?? row.legalName ?? 'esta empresa');
        const archived = Boolean(row.archivedAt);
        const actions = id
          ? [{ key: 'ver', label: 'Ver', description: 'Abre la ficha de la empresa con sus contactos, contratos e historial.', icon: 'chevron_right', href: `/operaciones/crm/cuentas/detalle?id=${id}` }]
          : [];
        if (!id) return actions;
        return [
          ...actions,
          archived
            ? {
                key: 'restaurar', label: 'Restaurar', description: 'Devuelve la empresa archivada a los listados, con su estado y su historial intactos.', icon: 'unarchive',
                onClick: async () => { await b2bService.restoreAccount(id); },
                confirm: {
                  title: 'Restaurar empresa',
                  message: `«${name}» volverá a aparecer en los listados con su estado intacto.`,
                  confirmLabel: 'Restaurar', tone: 'primary' as const,
                  successMessage: 'Empresa restaurada',
                },
              }
            : {
                key: 'archivar', label: 'Archivar', description: 'Saca la empresa de los listados operativos sin borrarla; se puede restaurar cuando quieras.', icon: 'archive', tone: 'danger' as const,
                onClick: async () => { await b2bService.archiveAccount(id); },
                confirm: {
                  title: 'Archivar empresa',
                  message: `«${name}» saldrá de los listados operativos. Podrás restaurarla cuando quieras y su historial se conserva.`,
                  confirmLabel: 'Archivar', tone: 'danger' as const,
                  successMessage: 'Empresa archivada',
                },
              },
        ];
      }}
    />
  );
}
