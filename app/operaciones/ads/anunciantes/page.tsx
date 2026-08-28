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
      /*
       * Las dos operaciones que el backend ofrecía sobre un anunciante y ninguna pantalla llamaba:
       * habilitarlo o suspenderlo, y darle perfil de facturación. Sin la primera, un anunciante
       * quedaba en «pendiente de revisión» para siempre —no había forma de activarlo desde la
       * consola—; sin la segunda, no se le podía emitir factura porque le faltaban los datos
       * fiscales.
       */
      rowActions={(row) => [
        {
          key: 'estado',
          label: 'Cambiar estado',
          icon: 'published_with_changes',
          form: {
            title: () => `Estado de ${String(row.tradeName ?? row.legalName ?? '')}`,
            description: 'El motivo queda en la auditoría del módulo: suspender a un anunciante corta su entrega, y quien lo revise después necesita saber por qué.',
            fields: [
              {
                name: 'status',
                label: 'Estado',
                type: 'select',
                required: true,
                options: [
                  { label: 'Pendiente de revisión', value: 'PENDING_REVIEW' },
                  { label: 'Activo', value: 'ACTIVE' },
                  { label: 'Suspendido', value: 'SUSPENDED' },
                  { label: 'Rechazado', value: 'REJECTED' },
                ],
              },
              {
                name: 'riskStatus',
                label: 'Riesgo',
                type: 'select',
                optional: true,
                options: [
                  { label: 'Normal', value: 'NORMAL' },
                  { label: 'En vigilancia', value: 'WATCHLIST' },
                  { label: 'Bloqueado', value: 'BLOCKED' },
                ],
              },
              { name: 'reason', label: 'Motivo', required: true, span: 3, placeholder: 'Documentación fiscal verificada' },
            ],
            submit: (target, payload) => adsService.updateAdvertiserStatus(String(target.id ?? ''), payload),
            submitLabel: 'Guardar estado',
          },
        },
        {
          key: 'facturacion',
          label: 'Perfil de facturación',
          icon: 'receipt_long',
          form: {
            title: () => `Facturación de ${String(row.tradeName ?? row.legalName ?? '')}`,
            description: 'Los datos con los que se le emite la factura. Un anunciante puede tener varios perfiles; el marcado por defecto es el que se usa.',
            fields: [
              { name: 'fiscalName', label: 'Razón social fiscal', required: true, span: 2 },
              { name: 'taxId', label: 'NIT', required: true },
              { name: 'billingEmail', label: 'Correo de facturación', type: 'email', required: true, span: 2 },
              { name: 'taxRegime', label: 'Régimen tributario', optional: true },
              { name: 'addressLine', label: 'Dirección', optional: true, span: 2 },
              { name: 'city', label: 'Ciudad', optional: true },
              { name: 'country', label: 'País', optional: true, defaultValue: 'BO', hint: 'Dos letras: BO, AR, BR…' },
              { name: 'sinCustomerCode', label: 'Código de cliente SIN', optional: true },
            ],
            submit: (target, payload) => adsService.createBillingProfile(String(target.id ?? ''), payload),
            submitLabel: 'Guardar perfil',
          },
        },
      ]}
      /*
       * Sin `detailHref`: apuntaba a ESTA misma lista con un `?id=` que ninguna pantalla lee, así
       * que el botón «Ver» de cada fila recargaba el listado. Un enlace que no lleva a ninguna
       * parte se lee como una pantalla rota. Lo que se puede hacer sobre un anunciante está en las
       * acciones de la fila; el día que exista una ficha, el enlace vuelve apuntando a ella.
       */
    />
  );
}
