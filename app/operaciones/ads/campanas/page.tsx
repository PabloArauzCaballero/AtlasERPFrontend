'use client';

import { TabbedPanels } from '@/components/atlas/TabbedPanels';
import { WorkspaceHeader } from '@/components/atlas/WorkspaceHeader';
import { InlineActionForm } from '@/components/screens/InlineActionForm';
import { LiveDirectoryScreen } from '@/components/screens/LiveDirectoryScreen';
import { adsService } from '@/services/adsService';
import type { JsonObject, PageQuery, ResourceRow } from '@/services/types';
import { formatMicrosAsBob } from '@/lib/formatters';
import { toast } from '@/lib/toast';
import { loadAdSets, loadAdvertisers, loadCampaigns, loadCreatives, loadPlacements, loadSegments } from '@/services/optionLoaders';

/**
 * Campañas publicitarias: portafolio, alta de la cadena completa y flujo de estado.
 *
 * El alta faltaba entera. La pantalla sabía listar campañas y cambiarles el estado porque el
 * backend tampoco ofrecía más: no existía `POST /admin/ads/campaigns` ni de ninguna de las piezas
 * que cuelgan de ella, así que la única forma de que existiera una campaña era sembrarla por SQL.
 *
 * Las altas van en el orden en que hay que hacerlas —campaña, conjunto, creatividad, anuncio— y
 * cada una pide el identificador que devolvió la anterior. La CAMPAÑA, que es lo que lista la
 * tabla, se crea en el modal de «Nueva campaña» y su estado se cambia desde la fila: tenerlo en dos
 * pestañas aparte obligaba a volver a buscar en un desplegable la campaña que ya se estaba mirando.
 * Los tres pasos que cuelgan de ella no tienen tabla propia y siguen siendo pestañas.
 */
export default function CampaignsPage() {
  /* La tabla se recarga sola tras crear o cambiar el estado: ambas cosas pasan dentro de ella. */
  function cambiarEstado(row: ResourceRow, payload: JsonObject) {
    return adsService.updateCampaignStatus(String(row.id ?? ''), payload);
  }

  function createCampaign(payload: JsonObject) {
    return adsService.createCampaign(payload);
  }

  async function createAdSet(payload: JsonObject) {
    const id = String(payload.campaignId ?? '');
    const { campaignId: _id, ...body } = payload;
    return adsService.createAdSet(id, body);
  }

  async function createCreative(payload: JsonObject) {
    return adsService.createCreative(payload);
  }

  async function createAd(payload: JsonObject) {
    const id = String(payload.adSetId ?? '');
    const { adSetId: _id, ...body } = payload;
    return adsService.createAd(id, body);
  }

  /**
   * El resultado se dice en el aviso porque no hay fila que actualizar: la consulta no escribe, y
   * abrir una pantalla entera para tres cifras sería más ruido que respuesta.
   */
  async function verRendimiento(row: ResourceRow, payload: JsonObject) {
    const result = (await adsService.getCampaignPerformance(String(row.id ?? ''), payload as PageQuery)) as Record<string, unknown>;
    const totales = (result.totals ?? result) as Record<string, unknown>;
    const num = (value: unknown) => Number(value ?? 0).toLocaleString('es-BO');
    toast.success(
      `Rendimiento de ${String(row.name ?? '')}`,
      `${num(totales.impressions)} impresiones · ${num(totales.clicks)} clics · ${formatMicrosAsBob(Number(totales.spendMicros ?? 0))} consumido`,
    );
    return result;
  }

  return (
    <div className="space-y-5">
      <WorkspaceHeader
        breadcrumbs={[{ label: 'Ads' }, { label: 'Campañas' }]}
        title="Gestión de campañas"
        description="Portafolio de campañas, alta de la cadena completa —campaña, conjunto, creatividad, anuncio— y flujo de estado auditado."
      />
      <TabbedPanels
        keepMounted
        tabs={[
          {
            id: 'listado',
            label: 'Campañas',
            icon: 'table_view',
            content: (
              <LiveDirectoryScreen
                embedded
                moduleLabel="Ads"
                title="Portafolio de campañas"
                description="Seguimiento de campañas, presupuesto, aprobación, entrega y estado operativo."
                load={adsService.listCampaigns}
                createLabel="Nueva campaña"
                create={{
                  icon: 'campaign',
                  title: 'Crear campaña',
                  description: 'Nace en DRAFT / NOT_SUBMITTED. El presupuesto va en micros: 1 BOB = 1.000.000.',
                  submit: createCampaign,
                  fields: [
                    { name: 'advertiserId', label: 'Anunciante', type: 'select', required: true, span: 2, optionsLoader: loadAdvertisers },
                    { name: 'name', label: 'Nombre de la campaña', required: true, span: 2 },
                    { name: 'objective', label: 'Objetivo', type: 'select', required: true, options: ['AWARENESS', 'TRAFFIC', 'LEADS', 'CONVERSIONS', 'PROMOTION'].map((value) => ({ label: value, value })) },
                    { name: 'currency', label: 'Moneda', required: true, defaultValue: 'BOB' },
                    { name: 'budgetTotalMicros', label: 'Presupuesto total (micros)', required: true, valueKind: 'number' },
                    { name: 'budgetDailyMicros', label: 'Tope diario (micros)', valueKind: 'number', optional: true, hint: 'No puede superar al total.' },
                    { name: 'startsAt', label: 'Inicio', type: 'datetime', required: true },
                    { name: 'endsAt', label: 'Fin', type: 'datetime', optional: true },
                  ],
                }}
                rowActions={(row) => [
                  {
                    /*
                     * El rendimiento de una campaña: `GET /admin/ads/campaigns/:id/performance`
                     * existía con su método en el servicio y ninguna pantalla lo pedía, así que
                     * «cómo va mi campaña» no se podía responder desde la consola aunque el dato
                     * estuviera calculado.
                     */
                    key: 'rendimiento',
                    label: 'Ver rendimiento',
                    icon: 'query_stats',
                    form: {
                      icon: 'query_stats',
                      title: () => `Rendimiento de «${String(row.name ?? '')}»`,
                      description: 'Impresiones, clics y consumo del rango. No modifica nada: el rango es lo que hay que elegir para leerlo.',
                      submitLabel: 'Consultar',
                      submit: verRendimiento,
                      fields: [
                        { name: 'from', label: 'Desde', type: 'date', optional: true },
                        { name: 'to', label: 'Hasta', type: 'date', optional: true },
                        {
                          name: 'groupBy',
                          label: 'Agrupar por',
                          type: 'select',
                          optional: true,
                          options: [
                            { label: 'Día', value: 'day' },
                            { label: 'Semana', value: 'week' },
                            { label: 'Mes', value: 'month' },
                          ],
                        },
                      ],
                    },
                  },
                  {
                    key: 'estado',
                    label: 'Cambiar estado',
                    icon: 'published_with_changes',
                    form: {
                      icon: 'published_with_changes',
                      title: () => `Actualizar el estado de «${String(row.name ?? '')}»`,
                      description: 'Aplica una transición permitida por el backend, con una razón que queda auditada.',
                      submitLabel: 'Actualizar estado',
                      submit: cambiarEstado,
                      fields: [
                        { name: 'status', label: 'Nuevo estado', type: 'select', required: true, span: 2, defaultValue: String(row.status ?? 'DRAFT'), options: ['DRAFT', 'PENDING_REVIEW', 'APPROVED', 'ACTIVE', 'PAUSED', 'ENDED', 'REJECTED', 'ARCHIVED'].map((value) => ({ label: value.replaceAll('_', ' '), value })) },
                        { name: 'reason', label: 'Razón', required: true, span: 2, placeholder: 'Mínimo 8 caracteres' },
                      ],
                    },
                  },
                ]}
                statusOptions={[
                  { label: 'Borrador', value: 'DRAFT' },
                  { label: 'Activa', value: 'ACTIVE' },
                  { label: 'Pausada', value: 'PAUSED' },
                  { label: 'Finalizada', value: 'ENDED' },
                ]}
                columns={[
                  { key: 'name', label: 'Campaña' },
                  { key: 'advertiserId', label: 'Anunciante', kind: 'mono' },
                  { key: 'budgetTotalMicros', label: 'Presupuesto', kind: 'money', align: 'right' },
                  { key: 'startsAt', label: 'Inicio', kind: 'date' },
                  { key: 'endsAt', label: 'Fin', kind: 'date' },
                  { key: 'approvalStatus', label: 'Aprobación', kind: 'status' },
                  { key: 'status', label: 'Estado', kind: 'status' },
                ]}
                metrics={[
                  { label: 'Campañas', value: (_rows, total) => total, detail: 'Portafolio administrado', icon: 'campaign' },
                  { label: 'Activas', value: (rows) => rows.filter((row) => row.status === 'ACTIVE').length, detail: 'En delivery', icon: 'play_circle', tone: 'teal' },
                  { label: 'En aprobación', value: (rows) => rows.filter((row) => String(row.approvalStatus).includes('PENDING')).length, detail: 'Requieren decisión', icon: 'approval', tone: 'amber' },
                  { label: 'Pausadas', value: (rows) => rows.filter((row) => row.status === 'PAUSED').length, detail: 'Intervención operativa', icon: 'pause_circle', tone: 'red' },
                ]}
              />
            ),
          },
          {
            id: 'conjunto',
            label: '1 · Conjunto',
            icon: 'ad_units',
            content: (
              <InlineActionForm
                title="Crear conjunto de anuncios"
                description="Aquí se aplica la segmentación y el tope de frecuencia. Sin espacios, el conjunto nunca entra en una subasta."
                icon="ad_units"
                submitLabel="Crear conjunto"
                successMessage="El conjunto quedó creado."
                onSubmit={createAdSet}
                fields={[
                  { name: 'campaignId', label: 'Campaña', type: 'select', required: true, span: 2, optionsLoader: loadCampaigns },
                  { name: 'name', label: 'Nombre del conjunto', required: true, span: 2 },
                  { name: 'buyingModel', label: 'Modelo de compra', type: 'select', required: true, options: ['CPM', 'CPC', 'CPA', 'FIXED'].map((value) => ({ label: value, value })) },
                  { name: 'bidAmountMicros', label: 'Puja (micros)', required: true, valueKind: 'number' },
                  { name: 'targetSegmentId', label: 'Segmento de audiencia', type: 'select', optional: true, span: 2, optionsLoader: async () => [{ label: '— Toda la audiencia —', value: '' }, ...(await loadSegments())], hint: 'Sin segmento, el conjunto entrega a toda la audiencia.' },
                  /*
                   * Uno por ahora. Antes era una lista de uuids separados por comas: escribir a mano
                   * varios identificadores en un campo de texto es la forma mas facil de mandar una
                   * campana a un sitio que no era, sin que nada lo advierta.
                   */
                  { name: 'placementIds', label: 'Espacio publicitario', type: 'select', required: true, span: 2, optionsLoader: loadPlacements, valueKind: 'stringList' },
                  { name: 'frequencyCapCount', label: 'Tope de frecuencia', optional: true, valueKind: 'number', hint: 'Exige también la ventana.' },
                  { name: 'frequencyCapWindowHours', label: 'Ventana del tope (horas)', optional: true, valueKind: 'number' },
                ]}
              />
            ),
          },
          {
            id: 'creatividad',
            label: '2 · Creatividad',
            icon: 'image',
            content: (
              <InlineActionForm
                title="Crear creatividad"
                description="El destino debe ser http(s). Pasa por revisión de políticas antes de servirse."
                icon="image"
                submitLabel="Crear creatividad"
                successMessage="La creatividad quedó creada y entra en revisión."
                onSubmit={createCreative}
                fields={[
                  { name: 'advertiserId', label: 'Anunciante', type: 'select', required: true, span: 2, optionsLoader: loadAdvertisers },
                  { name: 'name', label: 'Nombre', required: true, span: 2 },
                  { name: 'creativeType', label: 'Tipo', type: 'select', required: true, options: ['IMAGE', 'VIDEO', 'CAROUSEL', 'TEXT_CARD'].map((value) => ({ label: value, value })) },
                  { name: 'headline', label: 'Titular', optional: true },
                  { name: 'ctaText', label: 'Texto del botón', optional: true },
                  { name: 'destinationUrl', label: 'URL de destino', required: true, span: 2 },
                  { name: 'bodyText', label: 'Cuerpo', type: 'textarea', optional: true, span: 2 },
                ]}
              />
            ),
          },
          {
            id: 'anuncio',
            label: '3 · Anuncio',
            icon: 'ads_click',
            content: (
              <InlineActionForm
                title="Crear anuncio"
                description="Une conjunto y creatividad. Ambos deben ser del mismo anunciante: el backend lo rechaza si no."
                icon="ads_click"
                submitLabel="Crear anuncio"
                successMessage="El anuncio quedó creado."
                onSubmit={createAd}
                fields={[
                  { name: 'adSetId', label: 'Conjunto de anuncios', type: 'select', required: true, span: 2, optionsLoader: loadAdSets },
                  { name: 'creativeId', label: 'Creatividad', type: 'select', required: true, span: 2, optionsLoader: loadCreatives },
                  { name: 'name', label: 'Nombre del anuncio', required: true, span: 2 },
                  { name: 'weight', label: 'Peso', optional: true, valueKind: 'number', defaultValue: '1', hint: 'Pondera el reparto entre anuncios del mismo conjunto.' },
                ]}
              />
            ),
          },
        ]}
      />
    </div>
  );
}
