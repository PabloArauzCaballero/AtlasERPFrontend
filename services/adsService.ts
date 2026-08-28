import { requireUuidPathParam } from '@/lib/apiPath';
import { apiRequest } from '@/lib/apiClient';
import { buildBackendQuery } from './query';
import type { JsonObject, PageQuery, PaginatedResult, ResourceRow } from './types';

const advertiserQueryKeys = ['status', 'riskStatus', 'billingMode', 'search'] as const;
const campaignQueryKeys = ['advertiserId', 'status', 'approvalStatus', 'from', 'to'] as const;
const moderationQueryKeys = ['status', 'advertiserId', 'campaignId'] as const;
const inventoryQueryKeys = ['surface', 'status'] as const;
const policiesQueryKeys = ['category', 'isActive', 'severity'] as const;
const deliveryQueryKeys = ['placementId', 'status', 'from', 'to'] as const;
const auditQueryKeys = ['entityType', 'entityId', 'actorId', 'severity', 'from', 'to'] as const;
const segmentQueryKeys = ['advertiserId', 'segmentType', 'status'] as const;

const adsQuery = (query: PageQuery, allowedKeys?: readonly string[]) =>
  buildBackendQuery(query, { pageSizeKey: 'limit', defaultPageSize: 25, allowedKeys });

export const adsService = {
  getDashboard(query: PageQuery) {
    return apiRequest<ResourceRow>('/admin/ads/dashboard', {
      query: adsQuery(query, ['from', 'to', 'advertiserId', 'placementId', 'status']),
    });
  },
  listAdvertisers(query: PageQuery) {
    return apiRequest<PaginatedResult<ResourceRow>>('/admin/ads/advertisers', {
      query: adsQuery(query, advertiserQueryKeys),
    });
  },
  createAdvertiser(body: JsonObject) {
    return apiRequest<ResourceRow>('/admin/ads/advertisers', { method: 'POST', body });
  },
  bulkCreateAdvertisers(body: JsonObject) {
    return apiRequest<ResourceRow>('/admin/ads/advertisers/bulk', { method: 'POST', body });
  },
  createBillingProfile(advertiserId: string, body: JsonObject) {
    const safeAdvertiserId = requireUuidPathParam(advertiserId, 'el UUID del anunciante');
    return apiRequest<ResourceRow>(`/admin/ads/advertisers/${safeAdvertiserId}/billing-profiles`, {
      method: 'POST',
      body,
    });
  },
  updateAdvertiserStatus(advertiserId: string, body: JsonObject) {
    const safeAdvertiserId = requireUuidPathParam(advertiserId, 'el UUID del anunciante');
    return apiRequest<ResourceRow>(`/admin/ads/advertisers/${safeAdvertiserId}/status`, {
      method: 'PATCH',
      body,
    });
  },
  listCampaigns(query: PageQuery) {
    return apiRequest<PaginatedResult<ResourceRow>>('/admin/ads/campaigns', {
      query: adsQuery(query, campaignQueryKeys),
    });
  },
  /**
   * Alta de la cadena publicitaria. Hasta ahora el portal sólo sabía listar campañas y cambiarles
   * el estado, porque el backend tampoco ofrecía más: una campaña únicamente podía nacer sembrada
   * por SQL.
   */
  createCampaign(body: JsonObject) {
    return apiRequest<ResourceRow>('/admin/ads/campaigns', { method: 'POST', body });
  },
  createAdSet(campaignId: string, body: JsonObject) {
    const safeCampaignId = requireUuidPathParam(campaignId, 'el UUID de la campaña');
    return apiRequest<ResourceRow>(`/admin/ads/campaigns/${safeCampaignId}/ad-sets`, {
      method: 'POST',
      body,
    });
  },
  createCreative(body: JsonObject) {
    return apiRequest<ResourceRow>('/admin/ads/creatives', { method: 'POST', body });
  },
  createAd(adSetId: string, body: JsonObject) {
    const safeAdSetId = requireUuidPathParam(adSetId, 'el UUID del conjunto de anuncios');
    return apiRequest<ResourceRow>(`/admin/ads/ad-sets/${safeAdSetId}/ads`, {
      method: 'POST',
      body,
    });
  },
  listAdSets(campaignId?: string) {
    return apiRequest<JsonObject[]>('/admin/ads/ad-sets', campaignId ? { query: { campaignId } } : {});
  },
  listCreatives(advertiserId?: string) {
    return apiRequest<JsonObject[]>('/admin/ads/creatives', advertiserId ? { query: { advertiserId } } : {});
  },
  listPlacements() {
    return apiRequest<JsonObject[]>('/admin/ads/placements');
  },
  listSegments(query: PageQuery) {
    return apiRequest<PaginatedResult<ResourceRow>>('/admin/ads/segments', {
      query: adsQuery(query, segmentQueryKeys),
    });
  },
  createSegment(body: JsonObject) {
    return apiRequest<ResourceRow>('/admin/ads/segments', { method: 'POST', body });
  },
  /** Vistas, clicks, conversiones y gasto de una campaña, leídos del agregado diario. */
  getCampaignPerformance(campaignId: string, query: PageQuery) {
    const safeCampaignId = requireUuidPathParam(campaignId, 'el UUID de la campaña');
    return apiRequest<ResourceRow>(`/admin/ads/campaigns/${safeCampaignId}/performance`, {
      query: adsQuery(query, ['from', 'to', 'groupBy']),
    });
  },
  updateCampaignStatus(campaignId: string, body: JsonObject) {
    const safeCampaignId = requireUuidPathParam(campaignId, 'el UUID de la campaña');
    return apiRequest<ResourceRow>(`/admin/ads/campaigns/${safeCampaignId}/status`, {
      method: 'PATCH',
      body,
    });
  },
  listModerationQueue(query: PageQuery) {
    return apiRequest<PaginatedResult<ResourceRow>>('/admin/ads/moderation/queue', {
      query: adsQuery(query, moderationQueryKeys),
    });
  },
  decideModeration(reviewId: string, body: JsonObject) {
    const safeReviewId = requireUuidPathParam(reviewId, 'el UUID de la revisión');
    return apiRequest<ResourceRow>(`/admin/ads/moderation/${safeReviewId}/decision`, {
      method: 'POST',
      body,
    });
  },
  listInventory(query: PageQuery) {
    return apiRequest<PaginatedResult<ResourceRow>>('/admin/ads/inventory', {
      query: adsQuery(query, inventoryQueryKeys),
    });
  },
  createInventory(body: JsonObject) {
    return apiRequest<ResourceRow>('/admin/ads/inventory', { method: 'POST', body });
  },
  listPolicies(query: PageQuery) {
    return apiRequest<PaginatedResult<ResourceRow>>('/admin/ads/policies', {
      query: adsQuery(query, policiesQueryKeys),
    });
  },
  createPolicy(body: JsonObject) {
    return apiRequest<ResourceRow>('/admin/ads/policies', { method: 'POST', body });
  },
  closeBillingPeriod(body: JsonObject) {
    return apiRequest<ResourceRow>('/admin/ads/billing/period-close', { method: 'POST', body });
  },
  registerPayment(invoiceId: string, body: JsonObject) {
    const safeInvoiceId = requireUuidPathParam(invoiceId, 'el UUID de la factura Ads');
    return apiRequest<ResourceRow>(`/admin/ads/invoices/${safeInvoiceId}/payments`, {
      method: 'POST',
      body,
    });
  },
  getDeliveryMonitor(query: PageQuery) {
    return apiRequest<PaginatedResult<ResourceRow>>('/admin/ads/delivery-monitor', {
      query: adsQuery(query, deliveryQueryKeys),
    });
  },
  updateBillableStatus(eventId: string, body: JsonObject) {
    const safeEventId = requireUuidPathParam(eventId, 'el UUID del evento Ads');
    return apiRequest<ResourceRow>(`/admin/ads/events/${safeEventId}/billable-status`, {
      method: 'PATCH',
      body,
    });
  },
  listAudit(query: PageQuery) {
    return apiRequest<PaginatedResult<ResourceRow>>('/admin/ads/audit', {
      query: adsQuery(query, auditQueryKeys),
    });
  },
  // ---- Correo de campaña ----
  /**
   * Encola el envío. `X-Idempotency-Key` es OBLIGATORIO en el backend y es lo que hace que
   * reintentar el mismo envío devuelva el seguimiento del primero en vez de duplicar los correos.
   */
  sendCampaignEmail(body: JsonObject, idempotencyKey: string) {
    return apiRequest<ResourceRow>('/admin/ads/email/send', {
      method: 'POST',
      body,
      headers: { 'x-idempotency-key': idempotencyKey },
    });
  },
  getEmailTracking(trackingId: string) {
    const id = requireUuidPathParam(trackingId, 'el UUID del seguimiento de correo');
    return apiRequest<ResourceRow>(`/admin/ads/email/tracking/${id}`);
  },
  listEmailSuppressions() { return apiRequest<ResourceRow[]>('/admin/ads/email/suppressions'); },
  suppressEmail(body: JsonObject) {
    return apiRequest<ResourceRow>('/admin/ads/email/suppressions', { method: 'POST', body });
  },
  /*
   * Aquí estaban `selectDelivery`, `trackEvent` y `bulkTrackEvents`, y ninguna pantalla las
   * llamaba. No es un hueco que rellenar: `/ads/delivery/select` y `/ads/events` son la API del AD
   * SERVER —rol `ADS_AD_SERVER`, una credencial de servicio— y su llamante es el que sirve el
   * anuncio, no la consola. Tenerlas en el servicio del portal insinuaba que faltaba una pantalla
   * que no debe existir; los endpoints siguen en pie para quien integra.
   *
   * Y también `getAdvertiser` y `getCampaign`: traían UN registro que el listado ya devuelve
   * entero. Vuelven el día que haya una ficha que los necesite.
   */
};
