import { requireUuidPathParam } from '@/lib/apiPath';
import { apiRequest } from '@/lib/apiClient';
import type { JsonObject, ResourceRow } from './types';

export const portalService = {
  listPlans() {
    return apiRequest<ResourceRow[]>('/portal/plans');
  },
  createPlan(body: JsonObject) {
    return apiRequest<ResourceRow>('/portal/plans', { method: 'POST', body });
  },
  getSubscription(merchantAccountId: string) {
    const id = requireUuidPathParam(merchantAccountId, 'el UUID de la cuenta merchant');
    return apiRequest<ResourceRow | null>('/portal/subscription', { query: { merchantAccountId: id } });
  },
  subscribe(body: JsonObject) {
    return apiRequest<ResourceRow>('/portal/subscription', { method: 'POST', body });
  },
  listBranches(accountId: string) {
    const id = requireUuidPathParam(accountId, 'el UUID de la cuenta merchant');
    return apiRequest<ResourceRow[]>('/portal/branches', { query: { accountId: id } });
  },
  getBilling(merchantAccountId: string) {
    const id = requireUuidPathParam(merchantAccountId, 'el UUID de la cuenta merchant');
    return apiRequest<ResourceRow>('/portal/billing', { query: { merchantAccountId: id } });
  },
  listAdvertisers() {
    return apiRequest<ResourceRow[]>('/portal/advertisers');
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
