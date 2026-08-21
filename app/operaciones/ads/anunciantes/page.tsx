'use client';

import { LiveDirectoryScreen } from '@/components/screens/LiveDirectoryScreen';
import { adsService } from '@/services/adsService';

export default function AdvertisersPage() {
  return (
    <LiveDirectoryScreen
      moduleLabel="Ads"
      title="Directorio de anunciantes"
      description="Directorio de anunciantes, modalidad de facturación, riesgo comercial y habilitación operativa."
      load={adsService.listAdvertisers}
      createHref="/operaciones/ads/anunciantes/crear"
      createLabel="Nuevo anunciante"
      searchPlaceholder="Buscar anunciante, marca o NIT..."
      statusOptions={[{ label: 'Activo', value: 'ACTIVE' }, { label: 'Pendiente', value: 'PENDING' }, { label: 'Suspendido', value: 'SUSPENDED' }]}
      columns={[
        { key: 'tradeName', label: 'Anunciante' },
        { key: 'legalName', label: 'Razón social' },
        { key: 'taxId', label: 'NIT', kind: 'pii' },
        { key: 'billingMode', label: 'Facturación' },
        { key: 'currency', label: 'Moneda', align: 'center' },
        { key: 'riskStatus', label: 'Riesgo', kind: 'status' },
        { key: 'status', label: 'Estado', kind: 'status' },
      ]}
      metrics={[
        { label: 'Anunciantes', value: (_rows, total) => total, detail: 'Directorio consolidado', icon: 'business' },
        { label: 'Activos', value: (rows) => rows.filter((row) => row.status === 'ACTIVE').length, detail: 'Página actual', icon: 'verified', tone: 'teal' },
        { label: 'Riesgo pendiente', value: (rows) => rows.filter((row) => String(row.riskStatus).includes('PENDING')).length, detail: 'Revisión requerida', icon: 'shield', tone: 'amber' },
        { label: 'Postpago', value: (rows) => rows.filter((row) => row.billingMode === 'POSTPAID').length, detail: 'Exposición comercial', icon: 'receipt_long', tone: 'purple' },
      ]}
      detailHref={(row) => row.id ? `/operaciones/ads/anunciantes?id=${String(row.id)}` : undefined}
    />
  );
}
