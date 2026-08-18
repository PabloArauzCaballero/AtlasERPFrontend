import { requireUuidPathParam } from '@/lib/apiPath';
import { apiRequest } from '@/lib/apiClient';
import type { JsonObject, ResourceRow } from './types';

/**
 * Valida el identificador SÓLO cuando viene.
 *
 * Los endpoints del portal aceptan la cuenta como opcional a propósito: el comercio no la manda
 * —su alcance lo deriva el backend de sus membresías— y el staff interno sí debe mandarla. Enviar
 * una cadena vacía sería peor que no enviar nada: el backend la rechazaría por formato en vez de
 * derivar el alcance.
 */
function optionalUuid(value: string | undefined, description: string): string | undefined {
  return value ? requireUuidPathParam(value, description) : undefined;
}

export const portalService = {
  listPlans() {
    return apiRequest<ResourceRow[]>('/portal/plans');
  },
  createPlan(body: JsonObject) {
    return apiRequest<ResourceRow>('/portal/plans', { method: 'POST', body });
  },
  getSubscription(merchantAccountId?: string) {
    const id = optionalUuid(merchantAccountId, 'el UUID de la cuenta merchant');
    return apiRequest<ResourceRow | null>('/portal/subscription', { query: { merchantAccountId: id } });
  },
  subscribe(body: JsonObject) {
    return apiRequest<ResourceRow>('/portal/subscription', { method: 'POST', body });
  },
  listBranches(accountId?: string) {
    const id = optionalUuid(accountId, 'el UUID de la cuenta merchant');
    return apiRequest<ResourceRow[]>('/portal/branches', { query: { accountId: id } });
  },
  getBilling(merchantAccountId?: string) {
    const id = optionalUuid(merchantAccountId, 'el UUID de la cuenta merchant');
    return apiRequest<ResourceRow>('/portal/billing', { query: { merchantAccountId: id } });
  },
  listAdvertisers(merchantAccountId?: string) {
    const id = optionalUuid(merchantAccountId, 'el UUID de la cuenta merchant');
    return apiRequest<ResourceRow[]>('/portal/advertisers', { query: { merchantAccountId: id } });
  },
  listCampaigns(advertiserId: string) {
    const id = requireUuidPathParam(advertiserId, 'el UUID del anunciante');
    return apiRequest<ResourceRow[]>('/portal/campaigns', { query: { advertiserId: id } });
  },
  setCampaignStatus(campaignId: string, status: 'ACTIVE' | 'PAUSED') {
    const id = requireUuidPathParam(campaignId, 'el UUID de la campaña');
    return apiRequest<ResourceRow>(`/portal/campaigns/${id}/status`, { method: 'PATCH', body: { status } });
  },
};
