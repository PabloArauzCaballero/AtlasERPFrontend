'use client';

import { LiveDirectoryScreen } from '@/components/screens/LiveDirectoryScreen';
import { useOptions } from '@/hooks/useOptions';
import { adsService } from '@/services/adsService';
import { domainLoader } from '@/services/domains';

export default function AdvertisersPage() {
  /*
   * El filtro de estado lee el dominio del backend. La lista copiada ofrecía `PENDING`, que no es
   * un estado de anunciante (es `PENDING_REVIEW`): filtrar por «Pendiente» devolvía siempre vacío.
   */
  const estados = useOptions(domainLoader('domain:ads.advertiserStatus'));

  return (
    <LiveDirectoryScreen
      moduleLabel="Ads"
      title="Directorio de anunciantes"
      description="Directorio de anunciantes, modalidad de facturación, riesgo comercial y habilitación operativa."
      load={adsService.listAdvertisers}
      createHref="/operaciones/ads/anunciantes/crear"
      createLabel="Nuevo anunciante"
      searchPlaceholder="Buscar anunciante, marca o NIT..."
      statusOptions={estados}
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
              { name: 'status', label: 'Estado', required: true, optionsSource: 'domain:ads.advertiserStatus' },
              { name: 'riskStatus', label: 'Riesgo', optional: true, optionsSource: 'domain:ads.riskStatus' },
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
              // El régimen es un dominio cerrado (sus códigos llevan espacios: «REGIMEN GENERAL»); como texto libre, el backend lo rechazaba.
              { name: 'taxRegime', label: 'Régimen tributario', optional: true, optionsSource: 'domain:ads.taxRegime' },
              { name: 'addressLine', label: 'Dirección', optional: true, span: 2 },
              { name: 'city', label: 'Ciudad', optional: true, optionsSource: 'catalog:city' },
              { name: 'country', label: 'País', optional: true, defaultValue: 'BO', optionsSource: 'catalog:country' },
              // Lo asigna el SIN, fuera de Atlas: se copia tal cual y no hay dominio que ofrecer.
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
