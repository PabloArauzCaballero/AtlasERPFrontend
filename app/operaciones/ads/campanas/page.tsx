'use client';
import { LiveDirectoryScreen } from '@/components/screens/LiveDirectoryScreen';
import { MultiActionWorkspace } from '@/components/screens/MultiActionWorkspace';
import { adsService } from '@/services/adsService';
import type { JsonObject } from '@/services/types';
import { loadAdSets, loadAdvertisers, loadCampaigns, loadCreatives, loadPlacements, loadSegments } from '@/services/optionLoaders';

/**
 * Campañas publicitarias: portafolio, alta de la cadena completa y flujo de estado.
 *
 * El alta faltaba entera. La pantalla sabía listar campañas y cambiarles el estado porque el
 * backend tampoco ofrecía más: no existía `POST /admin/ads/campaigns` ni de ninguna de las piezas
 * que cuelgan de ella, así que la única forma de que existiera una campaña era sembrarla por SQL.
 *
 * Las cuatro altas van en el orden en que hay que hacerlas —campaña, conjunto, creatividad,
 * anuncio— y cada una pide el identificador que devolvió la anterior. Es lo que convierte cuatro
 * formularios sueltos en un procedimiento que se puede seguir sin leer el código del backend.
 */
export default function CampaignsPage() {
  async function update(payload: JsonObject) {
    const id = String(payload.campaignId ?? '');
    const { campaignId: _id, ...body } = payload;
    return adsService.updateCampaignStatus(id, body);
  }

  async function createCampaign(payload: JsonObject) {
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

  return (
    <div className="space-y-6">
      <LiveDirectoryScreen
        moduleLabel="Ads"
        title="Gestión de campañas"
        description="Seguimiento de campañas, presupuesto, aprobación, entrega y estado operativo."
        load={adsService.listCampaigns}
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
          {
            label: 'Campañas',
            value: (_rows, total) => total,
            detail: 'Portafolio administrado',
            icon: 'campaign',
          },
          {
            label: 'Activas',
            value: (rows) => rows.filter((row) => row.status === 'ACTIVE').length,
            detail: 'En delivery',
            icon: 'play_circle',
            tone: 'teal',
          },
          {
            label: 'En aprobación',
            value: (rows) => rows.filter((row) => String(row.approvalStatus).includes('PENDING')).length,
            detail: 'Requieren decisión',
            icon: 'approval',
            tone: 'amber',
          },
          {
            label: 'Pausadas',
            value: (rows) => rows.filter((row) => row.status === 'PAUSED').length,
            detail: 'Intervención operativa',
            icon: 'pause_circle',
            tone: 'red',
          },
        ]}
      />

      <MultiActionWorkspace
        moduleLabel="Ads"
        title="Alta de campaña"
        description="Campaña, conjunto, creatividad y anuncio. Todo nace en borrador: entregar sigue dependiendo de moderación."
        actions={[
          {
            id: 'create-campaign',
            title: '1 · Crear campaña',
            icon: 'campaign',
            description:
              'Nace en DRAFT / NOT_SUBMITTED. El presupuesto va en micros: 1 BOB = 1.000.000.',
            submitLabel: 'Crear campaña',
            onSubmit: createCampaign,
            fields: [
              { name: 'advertiserId', label: 'Anunciante', type: 'select', required: true, span: 2, optionsLoader: loadAdvertisers },
              { name: 'name', label: 'Nombre de la campaña', required: true, span: 2 },
              {
                name: 'objective',
                label: 'Objetivo',
                type: 'select',
                required: true,
                options: ['AWARENESS', 'TRAFFIC', 'LEADS', 'CONVERSIONS', 'PROMOTION'].map(
                  (value) => ({ label: value, value }),
                ),
              },
              { name: 'currency', label: 'Moneda', required: true, defaultValue: 'BOB' },
              {
                name: 'budgetTotalMicros',
                label: 'Presupuesto total (micros)',
                required: true,
                valueKind: 'number',
              },
              {
                name: 'budgetDailyMicros',
                label: 'Tope diario (micros)',
                valueKind: 'number',
                optional: true,
                hint: 'No puede superar al total.',
              },
              { name: 'startsAt', label: 'Inicio (ISO 8601)', required: true, span: 2 },
              { name: 'endsAt', label: 'Fin (ISO 8601)', optional: true, span: 2 },
            ],
          },
          {
            id: 'create-ad-set',
            title: '2 · Crear conjunto de anuncios',
            icon: 'ad_units',
            description:
              'Aquí se aplica la segmentación y el tope de frecuencia. Sin espacios, el conjunto nunca entra en una subasta.',
            submitLabel: 'Crear conjunto',
            onSubmit: createAdSet,
            fields: [
              { name: 'campaignId', label: 'Campaña', type: 'select', required: true, span: 2, optionsLoader: loadCampaigns },
              { name: 'name', label: 'Nombre del conjunto', required: true, span: 2 },
              {
                name: 'buyingModel',
                label: 'Modelo de compra',
                type: 'select',
                required: true,
                options: ['CPM', 'CPC', 'CPA', 'FIXED'].map((value) => ({ label: value, value })),
              },
              { name: 'bidAmountMicros', label: 'Puja (micros)', required: true, valueKind: 'number' },
              {
                name: 'targetSegmentId',
                label: 'Segmento de audiencia',
                type: 'select',
                optional: true,
                span: 2,
                optionsLoader: async () => [{ label: '— Toda la audiencia —', value: '' }, ...(await loadSegments())],
                hint: 'Sin segmento, el conjunto entrega a toda la audiencia.',
              },
              {
                name: 'placementIds',
                label: 'Espacio publicitario',
                type: 'select',
                required: true,
                span: 2,
                optionsLoader: loadPlacements,
                /*
                 * Uno por ahora. Antes era una lista de uuids separados por comas: escribir a mano
                 * varios identificadores en un campo de texto es la forma mas facil de mandar una
                 * campana a un sitio que no era, sin que nada lo advierta.
                 */
                valueKind: 'stringList',
              },
              {
                name: 'frequencyCapCount',
                label: 'Tope de frecuencia',
                optional: true,
                valueKind: 'number',
                hint: 'Exige también la ventana.',
              },
              {
                name: 'frequencyCapWindowHours',
                label: 'Ventana del tope (horas)',
                optional: true,
                valueKind: 'number',
              },
            ],
          },
          {
            id: 'create-creative',
            title: '3 · Crear creatividad',
            icon: 'image',
            description: 'El destino debe ser http(s). Pasa por revisión de políticas antes de servirse.',
            submitLabel: 'Crear creatividad',
            onSubmit: createCreative,
            fields: [
              { name: 'advertiserId', label: 'Anunciante', type: 'select', required: true, span: 2, optionsLoader: loadAdvertisers },
              { name: 'name', label: 'Nombre', required: true, span: 2 },
              {
                name: 'creativeType',
                label: 'Tipo',
                type: 'select',
                required: true,
                options: ['IMAGE', 'VIDEO', 'CAROUSEL', 'TEXT_CARD'].map((value) => ({
                  label: value,
                  value,
                })),
              },
              { name: 'headline', label: 'Titular', optional: true },
              { name: 'ctaText', label: 'Texto del botón', optional: true },
              { name: 'destinationUrl', label: 'URL de destino', required: true, span: 2 },
              { name: 'bodyText', label: 'Cuerpo', type: 'textarea', optional: true, span: 2 },
            ],
          },
          {
            id: 'create-ad',
            title: '4 · Crear anuncio',
            icon: 'ads_click',
            description:
              'Une conjunto y creatividad. Ambos deben ser del mismo anunciante: el backend lo rechaza si no.',
            submitLabel: 'Crear anuncio',
            onSubmit: createAd,
            fields: [
              { name: 'adSetId', label: 'Conjunto de anuncios', type: 'select', required: true, span: 2, optionsLoader: loadAdSets },
              { name: 'creativeId', label: 'Creatividad', type: 'select', required: true, span: 2, optionsLoader: loadCreatives },
              { name: 'name', label: 'Nombre del anuncio', required: true, span: 2 },
              {
                name: 'weight',
                label: 'Peso',
                optional: true,
                valueKind: 'number',
                defaultValue: '1',
                hint: 'Pondera el reparto entre anuncios del mismo conjunto.',
              },
            ],
          },
        ]}
      />

      <MultiActionWorkspace
        moduleLabel="Ads"
        title="Campaign Workflow"
        description="Actualice el estado de una campaña con una razón auditada."
        actions={[
          {
            id: 'status',
            title: 'Update Campaign Status',
            icon: 'published_with_changes',
            description: 'Aplica una transición permitida por el backend.',
            submitLabel: 'Actualizar estado',
            onSubmit: update,
            fields: [
              { name: 'campaignId', label: 'Campaña', type: 'select', required: true, span: 2, optionsLoader: loadCampaigns },
              {
                name: 'status',
                label: 'Nuevo estado',
                type: 'select',
                required: true,
                options: [
                  'DRAFT',
                  'PENDING_REVIEW',
                  'APPROVED',
                  'ACTIVE',
                  'PAUSED',
                  'ENDED',
                  'REJECTED',
                  'ARCHIVED',
                ].map((value) => ({ label: value.replaceAll('_', ' '), value })),
              },
              {
                name: 'reason',
                label: 'Razón',
                required: true,
                placeholder: 'Mínimo 8 caracteres',
                span: 2,
              },
            ],
          },
        ]}
      />
    </div>
  );
}
