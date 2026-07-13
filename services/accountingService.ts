import { requireUuidPathParam } from '@/lib/apiPath';
import { apiRequest } from '@/lib/apiClient';
import { buildBackendQuery } from './query';
import type { JsonObject, PageQuery, PaginatedResult, ResourceRow } from './types';

const accountingQuery = (query: PageQuery) =>
  buildBackendQuery(query, { pageSizeKey: 'pageSize', defaultPageSize: 20 });

export const accountingService = {
  createLegalEntity(body: JsonObject) {
    return apiRequest<ResourceRow>('/accounting/financial-structure/legal-entities', {
      method: 'POST',
      body,
    });
  },
  createBranch(body: JsonObject) {
    return apiRequest<ResourceRow>('/accounting/financial-structure/branches', {
      method: 'POST',
      body,
    });
  },
  createFiscalYear(body: JsonObject) {
    return apiRequest<ResourceRow>('/accounting/financial-structure/fiscal-years', {
      method: 'POST',
      body,
    });
  },
  createPeriod(body: JsonObject) {
    return apiRequest<ResourceRow>('/accounting/financial-structure/periods', {
      method: 'POST',
      body,
    });
  },
  createLedger(body: JsonObject) {
    return apiRequest<ResourceRow>('/accounting/financial-structure/ledgers', {
      method: 'POST',
      body,
    });
  },
  createChartOfAccounts(body: JsonObject) {
    return apiRequest<ResourceRow>('/accounting/financial-structure/charts-of-accounts', {
      method: 'POST',
      body,
    });
  },
  // ---- Listados maestros (para poblar selects) ----
  listLegalEntities() { return apiRequest<ResourceRow[]>('/accounting/financial-structure/legal-entities'); },
  listBranches() { return apiRequest<ResourceRow[]>('/accounting/financial-structure/branches'); },
  listFiscalYears() { return apiRequest<ResourceRow[]>('/accounting/financial-structure/fiscal-years'); },
  listAccountingPeriods() { return apiRequest<ResourceRow[]>('/accounting/financial-structure/periods'); },
  listLedgers() { return apiRequest<ResourceRow[]>('/accounting/financial-structure/ledgers'); },
  listChartsOfAccounts() { return apiRequest<ResourceRow[]>('/accounting/financial-structure/charts-of-accounts'); },
  listTaxCodes() { return apiRequest<ResourceRow[]>('/accounting/financial-structure/tax-codes'); },
  listCostCenters() { return apiRequest<ResourceRow[]>('/accounting/financial-structure/cost-centers'); },
  listProfitCenters() { return apiRequest<ResourceRow[]>('/accounting/financial-structure/profit-centers'); },
  listBankAccounts() { return apiRequest<ResourceRow[]>('/accounting/financial-structure/bank-accounts'); },
  listGlAccounts(query: PageQuery) {
    return apiRequest<PaginatedResult<ResourceRow>>('/accounting/financial-structure/gl-accounts', {
      query: accountingQuery(query),
    });
  },
  createGlAccount(body: JsonObject) {
    return apiRequest<ResourceRow>('/accounting/financial-structure/gl-accounts', {
      method: 'POST',
      body,
    });
  },
  getGlAccount(id: string) {
    const accountId = requireUuidPathParam(id, 'el UUID de la cuenta GL');
    return apiRequest<ResourceRow>(`/accounting/financial-structure/gl-accounts/${accountId}`);
  },
  updateGlAccount(id: string, body: JsonObject) {
    const accountId = requireUuidPathParam(id, 'el UUID de la cuenta GL');
    return apiRequest<ResourceRow>(`/accounting/financial-structure/gl-accounts/${accountId}`, {
      method: 'PATCH',
      body,
    });
  },
  createTaxCode(body: JsonObject) {
    return apiRequest<ResourceRow>('/accounting/financial-structure/tax-codes', {
      method: 'POST',
      body,
    });
  },
  // ---- Grupos de cuenta (árbol contable) ----
  listAccountGroups(query: PageQuery) {
    return apiRequest<PaginatedResult<ResourceRow>>('/accounting/account-groups', {
      query: accountingQuery(query),
    });
  },
  accountGroupTree(coaId?: string) {
    return apiRequest<ResourceRow[]>(
      '/accounting/account-groups/tree',
      coaId ? { query: { coaId } } : {},
    );
  },
  createAccountGroup(body: JsonObject) {
    return apiRequest<ResourceRow>('/accounting/account-groups', { method: 'POST', body });
  },
  updateAccountGroup(id: string, body: JsonObject) {
    const groupId = requireUuidPathParam(id, 'el UUID del grupo de cuenta');
    return apiRequest<ResourceRow>(`/accounting/account-groups/${groupId}`, { method: 'PATCH', body });
  },
  // ---- Vínculos multientidad de cuentas GL ----
  listGlAccountLinks(id: string) {
    const accountId = requireUuidPathParam(id, 'el UUID de la cuenta GL');
    return apiRequest<ResourceRow[]>(`/accounting/gl-accounts/${accountId}/links`);
  },
  createGlAccountLink(id: string, body: JsonObject) {
    const accountId = requireUuidPathParam(id, 'el UUID de la cuenta GL');
    return apiRequest<ResourceRow>(`/accounting/gl-accounts/${accountId}/links`, { method: 'POST', body });
  },
  deleteGlAccountLink(linkId: string) {
    const id = requireUuidPathParam(linkId, 'el UUID del vínculo');
    return apiRequest<ResourceRow>(`/accounting/gl-account-links/${id}`, { method: 'DELETE' });
  },
  listBusinessPartners(query: PageQuery) {
    return apiRequest<PaginatedResult<ResourceRow>>('/accounting/business-partners', {
      query: accountingQuery(query),
    });
  },
  createBusinessPartner(body: JsonObject) {
    return apiRequest<ResourceRow>('/accounting/business-partners', { method: 'POST', body });
  },
  getBusinessPartner(id: string) {
    const partnerId = requireUuidPathParam(id, 'el UUID del business partner');
    return apiRequest<ResourceRow>(`/accounting/business-partners/${partnerId}`);
  },
  updateBusinessPartner(id: string, body: JsonObject) {
    const partnerId = requireUuidPathParam(id, 'el UUID del business partner');
    return apiRequest<ResourceRow>(`/accounting/business-partners/${partnerId}`, {
      method: 'PATCH',
      body,
    });
  },
  createBusinessPartnerRole(body: JsonObject) {
    return apiRequest<ResourceRow>('/accounting/business-partners/roles', { method: 'POST', body });
  },
  listPartnerDefaultAccounts(id: string) {
    const partnerId = requireUuidPathParam(id, 'el UUID del business partner');
    return apiRequest<ResourceRow[]>(`/accounting/business-partners/${partnerId}/default-accounts`);
  },
  setPartnerDefaultAccount(id: string, body: JsonObject) {
    const partnerId = requireUuidPathParam(id, 'el UUID del business partner');
    return apiRequest<ResourceRow>(`/accounting/business-partners/${partnerId}/default-accounts`, {
      method: 'PUT',
      body,
    });
  },
  createContract(body: JsonObject) {
    return apiRequest<ResourceRow>('/accounting/contracts', { method: 'POST', body });
  },
  listContracts() { return apiRequest<PaginatedResult<ResourceRow>>('/accounting/contracts'); },
  updateContract(id: string, body: JsonObject) { return apiRequest<ResourceRow>(`/accounting/contracts/${requireUuidPathParam(id, 'contrato')}`, { method: 'PATCH', body }); },
  deleteContract(id: string) { return apiRequest<ResourceRow>(`/accounting/contracts/${requireUuidPathParam(id, 'contrato')}`, { method: 'DELETE' }); },
  createContractTerm(body: JsonObject) {
    return apiRequest<ResourceRow>('/accounting/contracts/terms', { method: 'POST', body });
  },
  createDocument(body: JsonObject) {
    return apiRequest<ResourceRow>('/accounting/documents', { method: 'POST', body });
  },
  bulkCreateDocuments(body: JsonObject) {
    return apiRequest<ResourceRow>('/accounting/documents/bulk', { method: 'POST', body });
  },
  listDocuments() { return apiRequest<PaginatedResult<ResourceRow>>('/accounting/documents'); },
  getDocument(id: string) {
    const documentId = requireUuidPathParam(id, 'el UUID del documento contable');
    return apiRequest<ResourceRow>(`/accounting/documents/${documentId}`);
  },
  postDocument(id: string, _body?: JsonObject) {
    const documentId = requireUuidPathParam(id, 'el UUID del documento contable');
    return apiRequest<ResourceRow>(`/accounting/documents/${documentId}/post`, { method: 'PATCH' });
  },
  reverseDocument(id: string, body: JsonObject) {
    const documentId = requireUuidPathParam(id, 'el UUID del documento contable');
    return apiRequest<ResourceRow>(`/accounting/documents/${documentId}/reverse`, {
      method: 'POST',
      body,
    });
  },
  createBillingEvent(body: JsonObject) {
    return apiRequest<ResourceRow>('/accounting/billing/events', { method: 'POST', body });
  },
  listBillingEvents() { return apiRequest<ResourceRow[]>('/accounting/billing/events'); },
  createArInvoice(body: JsonObject) {
    return apiRequest<ResourceRow>('/accounting/billing/ar-invoices', { method: 'POST', body });
  },
  listArInvoices() { return apiRequest<PaginatedResult<ResourceRow>>('/accounting/billing/ar-invoices'); },
  updateArInvoice(id: string, body: JsonObject) { return apiRequest<ResourceRow>(`/accounting/billing/ar-invoices/${requireUuidPathParam(id, 'factura')}`, { method: 'PATCH', body }); },
  deleteArInvoice(id: string) { return apiRequest<ResourceRow>(`/accounting/billing/ar-invoices/${requireUuidPathParam(id, 'factura')}`, { method: 'DELETE' }); },
  createReceipt(body: JsonObject) {
    return apiRequest<ResourceRow>('/accounting/receipts', { method: 'POST', body });
  },
  listReceipts() { return apiRequest<PaginatedResult<ResourceRow>>('/accounting/receipts'); },
  updateReceipt(id: string, body: JsonObject) { return apiRequest<ResourceRow>(`/accounting/receipts/${requireUuidPathParam(id, 'recibo')}`, { method: 'PATCH', body }); },
  deleteReceipt(id: string) { return apiRequest<ResourceRow>(`/accounting/receipts/${requireUuidPathParam(id, 'recibo')}`, { method: 'DELETE' }); },
  closePeriod(body: JsonObject) {
    return apiRequest<ResourceRow>('/accounting/closings/periods/close', { method: 'POST', body });
  },
  reopenPeriod(body: JsonObject) {
    return apiRequest<ResourceRow>('/accounting/closings/periods/reopen', { method: 'PATCH', body });
  },
};
