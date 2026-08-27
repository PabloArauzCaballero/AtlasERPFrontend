'use client';

import { useCallback, useState } from 'react';
import { CrudDirectory } from '@/components/screens/CrudDirectory';
import { accountingService } from '@/services/accountingService';
import { cargarTodo } from '@/lib/cargarTodo';
import { countryOptions, kybStatusOptions, partnerTypeOptions, recordStatusOptions } from '@/lib/catalogs';

const detailBase = '/operaciones/contabilidad/business-partners/detalle';

export default function BusinessPartnersPage() {
  const [version, setVersion] = useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(() => cargarTodo((query) => accountingService.listBusinessPartners(query)), [version]);

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
        { key: 'partnerType', label: 'Tipo', options: partnerTypeOptions },
        { key: 'kybStatus', label: 'KYB', options: kybStatusOptions },
        { key: 'status', label: 'Estado', options: recordStatusOptions },
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
          { name: 'partnerNo', label: 'Código de partner', required: true },
          { name: 'partnerType', label: 'Tipo', type: 'select', required: true, defaultValue: 'COMPANY', options: partnerTypeOptions },
          { name: 'legalName', label: 'Razón social / nombre legal', required: true, span: 2 },
          { name: 'tradeName', label: 'Nombre comercial', optional: true },
          { name: 'taxId', label: 'NIT / documento', optional: true },
          { name: 'countryCode', label: 'País', type: 'select', defaultValue: 'BO', options: countryOptions },
          { name: 'kybStatus', label: 'Estado KYB', type: 'select', defaultValue: 'PENDING', options: kybStatusOptions },
        ],
        submit: async (payload) => { const created = await accountingService.createBusinessPartner(payload); setVersion((value) => value + 1); return created; },
      }}
      edit={{
        description: 'El código de partner no se cambia: es la referencia con la que lo citan los documentos ya emitidos.',
        fields: [
          { name: 'legalName', label: 'Razón social', required: true, span: 2 },
          { name: 'tradeName', label: 'Nombre comercial', optional: true },
          { name: 'taxId', label: 'NIT / documento', optional: true },
          { name: 'countryCode', label: 'País', type: 'select', options: countryOptions },
          { name: 'kybStatus', label: 'Estado KYB', type: 'select', options: kybStatusOptions },
        ],
        submit: (id, payload) => accountingService.updateBusinessPartner(id, payload),
      }}
      extraActions={[{ key: 'ficha', label: 'Abrir ficha completa', icon: 'visibility', href: (row) => `${detailBase}?id=${String(row.id ?? '')}` }]}
    />
  );
}
