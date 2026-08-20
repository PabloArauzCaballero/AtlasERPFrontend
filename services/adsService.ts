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
  getAdvertiser(advertiserId: string) {
    const safeAdvertiserId = requireUuidPathParam(advertiserId, 'el UUID del anunciante');
    return apiRequest<ResourceRow>(`/admin/ads/advertisers/${safeAdvertiserId}`);
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
  getCampaign(campaignId: string) {
    const safeCampaignId = requireUuidPathParam(campaignId, 'el UUID de la campaña');
    return apiRequest<ResourceRow>(`/admin/ads/campaigns/${safeCampaignId}`);
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
  selectDelivery(body: JsonObject) {
    return apiRequest<ResourceRow>('/ads/delivery/select', { method: 'POST', body });
  },
  trackEvent(body: JsonObject) {
    return apiRequest<ResourceRow>('/ads/events', { method: 'POST', body });
  },
  bulkTrackEvents(body: JsonObject) {
    return apiRequest<ResourceRow>('/ads/events/bulk', { method: 'POST', body });
  },
};
