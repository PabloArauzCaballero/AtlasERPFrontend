import { requireUuidPathParam } from '@/lib/apiPath';
import { apiRequest } from '@/lib/apiClient';
import { buildBackendQuery } from './query';
import type { JsonObject, PageQuery, PaginatedResult, ResourceRow } from './types';

const b2bListKeys = ['status', 'search', 'category', 'businessLine', 'tag', 'sortBy', 'sortOrder'] as const;
const b2bQuery = (query: PageQuery) =>
  buildBackendQuery(query, { pageSizeKey: 'limit', defaultPageSize: 25, allowedKeys: b2bListKeys });

export const b2bService = {
  listAccounts(query: PageQuery) {
    return apiRequest<PaginatedResult<ResourceRow>>('/b2b/accounts', { query: b2bQuery(query) });
  },
  // ---- Catálogos de referencia (para selects) ----
  listInternalUsers() { return apiRequest<ResourceRow[]>('/b2b/internal-users'); },
  listB2BContracts() { return apiRequest<ResourceRow[]>('/b2b/contracts-catalog'); },
  listReceivables(accountId?: string) {
    return apiRequest<ResourceRow[]>('/b2b/receivables', accountId ? { query: { accountId } } : {});
  },
  getAccount(id: string) {
    const accountId = requireUuidPathParam(id, 'el UUID de la cuenta B2B');
    return apiRequest<ResourceRow>(`/b2b/accounts/${accountId}`);
  },
  createAccount(body: JsonObject) {
    return apiRequest<ResourceRow>('/b2b/accounts', { method: 'POST', body });
  },
  bulkCreateAccounts(body: JsonObject) {
    return apiRequest<ResourceRow>('/b2b/accounts/bulk', { method: 'POST', body });
  },
  addContact(accountId: string, body: JsonObject) {
    const safeAccountId = requireUuidPathParam(accountId, 'el UUID de la cuenta B2B');
    return apiRequest<ResourceRow>(`/b2b/accounts/${safeAccountId}/contacts`, { method: 'POST', body });
  },
  qualifyAccount(accountId: string, body: JsonObject) {
    const safeAccountId = requireUuidPathParam(accountId, 'el UUID de la cuenta B2B');
    return apiRequest<ResourceRow>(`/b2b/accounts/${safeAccountId}/qualify`, { method: 'POST', body });
  },
  listOpportunities(query?: { accountId?: string; stage?: string }) {
    return apiRequest<ResourceRow[]>('/b2b/opportunities', query ? { query } : {});
  },
  createOpportunity(body: JsonObject) {
    return apiRequest<ResourceRow>('/b2b/opportunities', { method: 'POST', body });
  },
  moveOpportunity(id: string, body: JsonObject) {
    const opportunityId = requireUuidPathParam(id, 'el UUID de la oportunidad');
    return apiRequest<ResourceRow>(`/b2b/opportunities/${opportunityId}/stage`, { method: 'PATCH', body });
  },
  createProposal(body: JsonObject) {
    return apiRequest<ResourceRow>('/b2b/proposals', { method: 'POST', body });
  },
  sendProposal(proposalId: string) {
    const safeProposalId = requireUuidPathParam(proposalId, 'el UUID de la propuesta');
    return apiRequest<ResourceRow>(`/b2b/proposals/${safeProposalId}/send`, { method: 'PATCH' });
  },
  acceptProposal(proposalId: string) {
    const safeProposalId = requireUuidPathParam(proposalId, 'el UUID de la propuesta');
    return apiRequest<ResourceRow>(`/b2b/proposals/${safeProposalId}/accept`, { method: 'PATCH' });
  },
  rejectProposal(proposalId: string) {
    const safeProposalId = requireUuidPathParam(proposalId, 'el UUID de la propuesta');
    return apiRequest<ResourceRow>(`/b2b/proposals/${safeProposalId}/reject`, { method: 'PATCH' });
  },
  decideApproval(id: string, body: JsonObject) {
    const approvalId = requireUuidPathParam(id, 'el UUID de la aprobación');
    return apiRequest<ResourceRow>(`/b2b/proposals/approvals/${approvalId}/decision`, {
      method: 'PATCH',
      body,
    });
  },
  createContractFromProposal(body: JsonObject) {
    return apiRequest<ResourceRow>('/b2b/contracts/from-proposal', { method: 'POST', body });
  },
  signAndActivateContract(contractId: string, body: JsonObject) {
    const safeContractId = requireUuidPathParam(contractId, 'el UUID del contrato');
    return apiRequest<ResourceRow>(`/b2b/contracts/${safeContractId}/sign-and-activate`, {
      method: 'PATCH',
      body,
    });
  },
  createOnboardingCase(body: JsonObject) {
    return apiRequest<ResourceRow>('/b2b/onboarding/cases', { method: 'POST', body });
  },
  listOnboardingCases() {
    return apiRequest<ResourceRow[]>('/b2b/onboarding/cases');
  },
  getOnboardingCase(onboardingCaseId: string) {
    const caseId = requireUuidPathParam(onboardingCaseId, 'el UUID del caso de onboarding');
    return apiRequest<ResourceRow>(`/b2b/onboarding/cases/${caseId}`);
  },
  createBranch(body: JsonObject) {
    return apiRequest<ResourceRow>('/b2b/onboarding/branches', { method: 'POST', body });
  },
  createMerchantUser(body: JsonObject) {
    return apiRequest<ResourceRow>('/b2b/onboarding/merchant-users', { method: 'POST', body });
  },
  updateChecklist(onboardingCaseId: string, body: JsonObject) {
    const caseId = requireUuidPathParam(onboardingCaseId, 'el UUID del caso de onboarding');
    return apiRequest<ResourceRow>(`/b2b/onboarding/cases/${caseId}/checklist`, {
      method: 'PATCH',
      body,
    });
  },
  activateOnboarding(onboardingCaseId: string, body: JsonObject) {
    const caseId = requireUuidPathParam(onboardingCaseId, 'el UUID del caso de onboarding');
    return apiRequest<ResourceRow>(`/b2b/onboarding/cases/${caseId}/activate`, {
      method: 'PATCH',
      body,
    });
  },
  registerPurchase(body: JsonObject) {
    return apiRequest<ResourceRow>('/b2b/bnpl/purchases', { method: 'POST', body });
  },
  createBillingInvoice(body: JsonObject) {
    return apiRequest<ResourceRow>('/b2b/billing/invoices', { method: 'POST', body });
  },
  postInvoiceToGl(invoiceId: string, body: JsonObject) {
    const id = requireUuidPathParam(invoiceId, 'el UUID de la factura merchant');
    return apiRequest<ResourceRow>(`/b2b/billing/invoices/${id}/post-to-gl`, { method: 'PATCH', body });
  },
  registerMerchantPayment(body: JsonObject) {
    return apiRequest<ResourceRow>('/b2b/billing/merchant-payments', { method: 'POST', body });
  },
  createPayable(body: JsonObject) {
    return apiRequest<ResourceRow>('/b2b/coverage/payables', { method: 'POST', body });
  },
  markPayablePaid(payableId: string, body: JsonObject) {
    const safePayableId = requireUuidPathParam(payableId, 'el UUID del payable');
    return apiRequest<ResourceRow>(`/b2b/coverage/payables/${safePayableId}/paid`, {
      method: 'PATCH',
      body,
    });
  },
  applyRecoveryPayment(recoveryId: string, body: JsonObject) {
    const safeRecoveryId = requireUuidPathParam(recoveryId, 'el UUID de la recuperación');
    return apiRequest<ResourceRow>(`/b2b/coverage/recoveries/${safeRecoveryId}/apply-payment`, {
      method: 'PATCH',
      body,
    });
  },
  createReconciliationRun(body: JsonObject) {
    return apiRequest<ResourceRow>('/b2b/reconciliation/runs', { method: 'POST', body });
  },
  // ---- Actividades comerciales (timeline, notas, tareas) ----
  listActivities(query: { accountId?: string; opportunityId?: string; activityType?: string; pending?: 'true' | 'false' }) {
    return apiRequest<ResourceRow[]>('/b2b/activities', { query });
  },
  createActivity(body: JsonObject) {
    return apiRequest<ResourceRow>('/b2b/activities', { method: 'POST', body });
  },
  updateActivity(id: string, body: JsonObject) {
    const activityId = requireUuidPathParam(id, 'el UUID de la actividad');
    return apiRequest<ResourceRow>(`/b2b/activities/${activityId}`, { method: 'PATCH', body });
  },
  completeActivity(id: string) {
    const activityId = requireUuidPathParam(id, 'el UUID de la actividad');
    return apiRequest<ResourceRow>(`/b2b/activities/${activityId}/complete`, { method: 'PATCH' });
  },
  deleteActivity(id: string) {
    const activityId = requireUuidPathParam(id, 'el UUID de la actividad');
    return apiRequest<ResourceRow>(`/b2b/activities/${activityId}`, { method: 'DELETE' });
  },
};
