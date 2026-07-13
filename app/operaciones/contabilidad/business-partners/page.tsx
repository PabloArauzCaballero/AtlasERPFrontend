'use client';

import { LiveDirectoryScreen } from '@/components/screens/LiveDirectoryScreen';
import { accountingService } from '@/services/accountingService';
import { kybStatusOptions, partnerTypeOptions, recordStatusOptions } from '@/lib/catalogs';

const detailBase = '/operaciones/contabilidad/business-partners/detalle';

export default function BusinessPartnersPage() {
  return (
    <LiveDirectoryScreen
      moduleLabel="Contabilidad"
      title="Business Partners"
      description="Maestro financiero de clientes, proveedores, comercios, bancos y entidades relacionadas."
      load={accountingService.listBusinessPartners}
      createHref="/operaciones/contabilidad/business-partners/crear"
      createLabel="Crear partner"
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
        { key: 'partnerType', label: 'Tipo', options: partnerTypeOptions },
        { key: 'kybStatus', label: 'KYB', options: kybStatusOptions },
        { key: 'status', label: 'Estado', options: recordStatusOptions },
      ]}
      columns={[
        { key: 'partnerNo', label: 'Código', kind: 'mono' },
        { key: 'legalName', label: 'Razón social' },
        { key: 'tradeName', label: 'Nombre comercial' },
        { key: 'partnerType', label: 'Tipo' },
        { key: 'taxId', label: 'NIT', kind: 'pii' },
        { key: 'countryCode', label: 'País', align: 'center' },
        { key: 'kybStatus', label: 'KYB', kind: 'status' },
      ]}
      metrics={[
        { label: 'Partners registrados', value: (_rows, total) => total, detail: 'Maestro corporativo', icon: 'handshake' },
        { label: 'Empresas', value: (rows) => rows.filter((row) => row.partnerType === 'COMPANY').length, detail: 'Página actual', icon: 'domain', tone: 'teal' },
        { label: 'KYB pendiente', value: (rows) => rows.filter((row) => String(row.kybStatus).includes('PENDING')).length, detail: 'Requieren validación', icon: 'policy', tone: 'amber' },
        { label: 'Bancos y grupo', value: (rows) => rows.filter((row) => ['BANK', 'GROUP_ENTITY'].includes(String(row.partnerType))).length, detail: 'Contrapartes especiales', icon: 'account_balance', tone: 'purple' },
      ]}
      searchPlaceholder="Buscar partner por código o razón social..."
    />
  );
}
