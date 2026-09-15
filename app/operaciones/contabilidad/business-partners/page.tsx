'use client';

import { useCallback, useState } from 'react';
import { CrudDirectory } from '@/components/screens/CrudDirectory';
import { accountingService } from '@/services/accountingService';
import { cargarTodo } from '@/lib/cargarTodo';
import { loadLegalEntities } from '@/services/optionLoaders';
import { useOptions } from '@/hooks/useOptions';
import { domainLoader } from '@/services/domains';

const detailBase = '/operaciones/contabilidad/business-partners/detalle';

export default function BusinessPartnersPage() {
  const [version, setVersion] = useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(() => cargarTodo((query) => accountingService.listBusinessPartners(query)), [version]);
  /*
   * Los filtros leen los mismos dominios que el alta. La lista local de estados era la genérica
   * (activo/inactivo/archivado) y un partner también puede estar BLOQUEADO; la de tipos no tenía
   * GOVERNMENT. Filtrar por un valor que el backend sí guarda era imposible.
   */
  const tiposPartner = useOptions(domainLoader('domain:accounting.partnerType'));
  const estadosKyb = useOptions(domainLoader('domain:accounting.kybStatus'));
  const estadosPartner = useOptions(domainLoader('domain:accounting.businessPartnerStatus'));

  return (
    <CrudDirectory
      moduleLabel="Contabilidad"
      title="Business partners"
      description="Maestro financiero de clientes, proveedores, comercios, bancos y entidades relacionadas."
      load={load}
      labelKey="legalName"
      searchPlaceholder="Buscar por código, razón social o NIT…"
      columns={[
        { key: 'partnerNo', label: 'Código', kind: 'mono' },
        { key: 'legalName', label: 'Razón social' },
        { key: 'tradeName', label: 'Nombre comercial' },
        { key: 'partnerType', label: 'Tipo' },
        { key: 'taxId', label: 'NIT', kind: 'pii' },
        { key: 'countryCode', label: 'País' },
        { key: 'kybStatus', label: 'KYB', kind: 'status' },
      ]}
      filters={[
        { key: 'partnerType', label: 'Tipo', options: tiposPartner },
        { key: 'kybStatus', label: 'KYB', options: estadosKyb },
        { key: 'status', label: 'Estado', options: estadosPartner },
        { key: 'countryCode', label: 'País' },
      ]}
      notice={{
        tone: 'info',
        title: 'Sin papelera, y es a propósito',
        body: 'Un business partner es la contraparte de contratos, facturas y asientos ya emitidos: borrarlo dejaría documentos apuntando al vacío. Para retirarlo de circulación, ponlo en KYB rechazado o estado inactivo.',
      }}
      create={{
        label: 'Crear partner',
        title: 'Nuevo business partner',
        description: 'Contraparte financiera con identidad legal y estado KYB controlado.',
        fields: [
          // El código lo asigna el backend (BP-AAAA-NNNNNN): pedirlo obligaba a inventar una serie.
          { name: 'partnerNo', label: 'Código de partner', assignedByBackend: true },
          { name: 'partnerType', label: 'Tipo', required: true, defaultValue: 'COMPANY', optionsSource: 'domain:accounting.partnerType' },
          { name: 'legalName', label: 'Razón social / nombre legal', required: true, span: 2 },
          { name: 'tradeName', label: 'Nombre comercial', optional: true },
          { name: 'taxId', label: 'NIT / documento', optional: true },
          { name: 'countryCode', label: 'País', required: true, defaultValue: 'BO', optionsSource: 'catalog:country' },
          { name: 'kybStatus', label: 'Estado KYB', required: true, defaultValue: 'PENDING', optionsSource: 'domain:accounting.kybStatus' },
        ],
        submit: async (payload) => { const created = await accountingService.createBusinessPartner(payload); setVersion((value) => value + 1); return created; },
      }}
      edit={{
        description: 'El código de partner no se cambia: es la referencia con la que lo citan los documentos ya emitidos.',
        fields: [
          { name: 'partnerNo', label: 'Código de partner', assignedByBackend: true, hint: 'Asignado por el sistema; no se cambia.' },
          { name: 'legalName', label: 'Razón social', required: true, span: 2 },
          { name: 'tradeName', label: 'Nombre comercial', optional: true },
          { name: 'taxId', label: 'NIT / documento', optional: true },
          { name: 'countryCode', label: 'País', required: true, optionsSource: 'catalog:country' },
          { name: 'kybStatus', label: 'Estado KYB', required: true, optionsSource: 'domain:accounting.kybStatus' },
        ],
        submit: (id, payload) => accountingService.updateBusinessPartner(id, payload),
      }}
      extraActions={[
        { key: 'ficha', label: 'Abrir ficha completa', icon: 'visibility', href: (row) => `${detailBase}?id=${String(row.id ?? '')}` },
        {
          /*
           * Los roles del socio (cliente, proveedor, comercio…) se podían dar de alta por API y por
           * ninguna pantalla: el `POST /accounting/business-partners/roles` existía con su método en
           * el servicio y nadie lo llamaba. Un rol es lo que decide en qué listados aparece y qué
           * cuentas por defecto se le pueden fijar, así que sin él la ficha queda a medias.
           */
          key: 'rol',
          label: 'Asignar rol',
          icon: 'badge',
          form: {
            title: (row) => `Rol de ${String(row.legalName ?? '')}`,
            description: 'Un socio puede tener varios roles a la vez y cada uno con su vigencia: el mismo comercio puede ser cliente desde enero y proveedor desde marzo.',
            fields: [
              {
                name: 'roleCode',
                label: 'Rol',
                required: true,
                optionsSource: 'domain:accounting.partnerRole',
              },
              { name: 'legalEntityId', label: 'Entidad legal', type: 'select', optional: true, span: 2, optionsLoader: loadLegalEntities, hint: 'Vacío = el rol vale para todas.' },
              { name: 'effectiveFrom', label: 'Vigente desde', type: 'date', required: true },
              { name: 'effectiveTo', label: 'Vigente hasta', type: 'date', optional: true },
            ],
            submit: (row, payload) => accountingService.createBusinessPartnerRole({ ...payload, businessPartnerId: String(row.id ?? '') }),
            submitLabel: 'Asignar rol',
          },
        },
      ]}
    />
  );
}
