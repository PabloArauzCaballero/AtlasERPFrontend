import { requireUuidPathParam } from '@/lib/apiPath';
import { apiRequest } from '@/lib/apiClient';
import { buildBackendQuery } from './query';
import type { JsonObject, PageQuery, PaginatedResult, ResourceRow } from './types';

const b2bListKeys = ['status', 'search', 'category', 'businessLine', 'tag', 'includeArchived', 'sortBy', 'sortOrder'] as const;
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
  /** Archivado reversible: la cuenta sale de los listados pero no se borra. */
  archiveAccount(accountId: string) {
    const safeAccountId = requireUuidPathParam(accountId, 'el UUID de la cuenta B2B');
    return apiRequest<ResourceRow>(`/b2b/accounts/${safeAccountId}/archive`, { method: 'PATCH' });
  },
  restoreAccount(accountId: string) {
    const safeAccountId = requireUuidPathParam(accountId, 'el UUID de la cuenta B2B');
    return apiRequest<ResourceRow>(`/b2b/accounts/${safeAccountId}/restore`, { method: 'PATCH' });
  },
  listMerchantInvoices() {
    return apiRequest<ResourceRow[]>('/b2b/billing/invoices');
  },
  /** Detalle con líneas y comercio: lo que hace falta para imprimir la factura. */
  getMerchantInvoice(invoiceId: string) {
    const id = requireUuidPathParam(invoiceId, 'el UUID de la factura merchant');
    return apiRequest<ResourceRow>(`/b2b/billing/invoices/${id}`);
  },
  listInstallments() {
    return apiRequest<ResourceRow[]>('/b2b/coverage/installments');
  },
  listPayables() {
    return apiRequest<ResourceRow[]>('/b2b/coverage/payables');
  },
  listRecoveries() {
    return apiRequest<ResourceRow[]>('/b2b/coverage/recoveries');
  },
  listProposals() {
    return apiRequest<ResourceRow[]>('/b2b/proposals');
  },
  listApprovals(onlyPending = true) {
    return apiRequest<ResourceRow[]>('/b2b/proposals/approvals', { query: { onlyPending: onlyPending ? 'true' : 'false' } });
  },
  /** Reglas de comision (MDR). No habia endpoint: solo se creaban por SQL. */
  listMdrRules(contractVersionId?: string) {
    return apiRequest<ResourceRow[]>('/b2b/contracts/mdr-rules', contractVersionId ? { query: { contractVersionId } } : {});
  },
  createMdrRule(body: JsonObject) {
    return apiRequest<ResourceRow>('/b2b/contracts/mdr-rules', { method: 'POST', body });
  },
  updateMdrRule(ruleId: string, body: JsonObject) {
    const id = requireUuidPathParam(ruleId, 'el UUID de la regla');
    return apiRequest<ResourceRow>(`/b2b/contracts/mdr-rules/${id}`, { method: 'PATCH', body });
  },
  listContracts() {
    return apiRequest<ResourceRow[]>('/b2b/contracts');
  },
  // ---- Tags de clasificación de cuentas ----
  /*
   * El catálogo de tags dejó de ser un efecto secundario del alta de cuentas: hasta que existieron
   * estos endpoints, un tag sólo nacía al teclearlo en el formulario de una cuenta y no había forma
   * de verlos todos, corregir uno mal escrito ni retirar el que ya nadie usa.
   */
  listAccountTags() { return apiRequest<ResourceRow[]>('/b2b/tags'); },
  createAccountTag(body: JsonObject) { return apiRequest<ResourceRow>('/b2b/tags', { method: 'POST', body }); },
  updateAccountTag(tagId: string, body: JsonObject) {
    const id = requireUuidPathParam(tagId, 'el UUID del tag');
    return apiRequest<ResourceRow>(`/b2b/tags/${id}`, { method: 'PATCH', body });
  },
  /** `force` confirma que se acepta quitar el tag de las cuentas que lo llevaban. */
  deleteAccountTag(tagId: string, force = false) {
    const id = requireUuidPathParam(tagId, 'el UUID del tag');
    return apiRequest<ResourceRow>(`/b2b/tags/${id}`, { method: 'DELETE', query: force ? { force: 'true' } : {} });
  },
  // ---- Calificación de riesgo de la cartera B2B ----
  /** Distribución por categoría, con la política que la produjo. */
  getRatingPortfolioSummary() { return apiRequest<ResourceRow>('/b2b/credit-rating/portfolio-summary'); },
  /** Calificación vigente de una cuenta, con las deudas que la produjeron. */
  getAccountRating(accountId: string) {
    const id = requireUuidPathParam(accountId, 'el UUID de la cuenta B2B');
    return apiRequest<ResourceRow>(`/b2b/credit-rating/accounts/${id}`);
  },
  getAccountRatingHistory(accountId: string, limit = 12) {
    const id = requireUuidPathParam(accountId, 'el UUID de la cuenta B2B');
    return apiRequest<ResourceRow>(`/b2b/credit-rating/accounts/${id}/history`, { query: { limit } });
  },
  rateAccount(accountId: string) {
    const id = requireUuidPathParam(accountId, 'el UUID de la cuenta B2B');
    return apiRequest<ResourceRow>(`/b2b/credit-rating/accounts/${id}/rate`, { method: 'POST' });
  },
  /** Recalifica toda la cartera. Finanzas lo necesita antes de un cierre. */
  sweepRatings(limit?: number) {
    return apiRequest<ResourceRow>('/b2b/credit-rating/sweep', { method: 'POST', body: limit ? { limit } : {} });
  },
  // ---- Segmentos comerciales (clientes solicitantes de crédito y partners) ----
  /** No confundir con `adsService.listSegments`: aquello es audiencia publicitaria. */
  listCrmSegments(query?: { subject?: string; status?: string }) {
    return apiRequest<ResourceRow[]>('/b2b/segments', query ? { query } : {});
  },
  /** Qué atributos admite cada sujeto. Se pide al backend para que la pantalla no los duplique. */
  listCrmSegmentVocabulary() { return apiRequest<ResourceRow[]>('/b2b/segments/vocabulary'); },
  createCrmSegment(body: JsonObject) {
    return apiRequest<ResourceRow>('/b2b/segments', { method: 'POST', body });
  },
  updateCrmSegment(segmentId: string, body: JsonObject) {
    const id = requireUuidPathParam(segmentId, 'el UUID del segmento');
    return apiRequest<ResourceRow>(`/b2b/segments/${id}`, { method: 'PATCH', body });
  },
  deleteCrmSegment(segmentId: string) {
    const id = requireUuidPathParam(segmentId, 'el UUID del segmento');
    return apiRequest<ResourceRow>(`/b2b/segments/${id}`, { method: 'DELETE' });
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
  /*
   * El rechazo LLEVA MOTIVO. El backend valida `reason` (3..500) y esta llamada iba sin cuerpo:
   * cada intento de rechazar una propuesta volvia como error de validacion sin decir de que campo.
   */
  rejectProposal(proposalId: string, reason: string) {
    const safeProposalId = requireUuidPathParam(proposalId, 'el UUID de la propuesta');
    return apiRequest<ResourceRow>(`/b2b/proposals/${safeProposalId}/reject`, { method: 'PATCH', body: { reason } });
  },
  /** Correccion de la cabecera mientras la propuesta sigue siendo borrador. */
  updateProposal(proposalId: string, body: JsonObject) {
    const safeProposalId = requireUuidPathParam(proposalId, 'el UUID de la propuesta');
    return apiRequest<ResourceRow>(`/b2b/proposals/${safeProposalId}`, { method: 'PATCH', body });
  },
  /** Retirada de una propuesta que nunca se envio, o que ya fue rechazada. */
  deleteProposal(proposalId: string) {
    const safeProposalId = requireUuidPathParam(proposalId, 'el UUID de la propuesta');
    return apiRequest<ResourceRow>(`/b2b/proposals/${safeProposalId}`, { method: 'DELETE' });
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
  updateBranch(branchId: string, body: JsonObject) {
    const id = requireUuidPathParam(branchId, 'el UUID de la sucursal');
    return apiRequest<ResourceRow>(`/b2b/onboarding/branches/${id}`, { method: 'PATCH', body });
  },
  /** Alta y baja. No hay borrado: una sucursal cerrada tiene que seguir siendo consultable. */
  setBranchStatus(branchId: string, body: JsonObject) {
    const id = requireUuidPathParam(branchId, 'el UUID de la sucursal');
    return apiRequest<ResourceRow>(`/b2b/onboarding/branches/${id}/status`, { method: 'PATCH', body });
  },
  /** Faltaba: las sucursales se creaban y no se podían volver a leer desde el ERP. */
  listBranches(query?: { accountId?: string; status?: string }) {
    return apiRequest<ResourceRow[]>('/b2b/onboarding/branches', query ? { query } : {});
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
