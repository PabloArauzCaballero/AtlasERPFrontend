import { accountingService } from './accountingService';
import { b2bService } from './b2bService';
import type { PaginatedResult, ResourceRow } from './types';

export interface Option {
  label: string;
  value: string;
}

const s = (value: unknown): string => (value === undefined || value === null ? '' : String(value));

function toOptions(rows: ResourceRow[], label: (row: ResourceRow) => string): Option[] {
  return rows.map((row) => ({ value: s(row.id), label: label(row) }));
}

function rowsOf(result: PaginatedResult<ResourceRow>): ResourceRow[] {
  return result.items ?? result.rows ?? [];
}

/** Antepone una opción vacía para campos opcionales (evita forzar un valor). */
export function withEmpty(options: Option[], label = '— Ninguno —'): Option[] {
  return [{ label, value: '' }, ...options];
}

export const loadLegalEntities = async (): Promise<Option[]> =>
  toOptions(await accountingService.listLegalEntities(), (r) => `${s(r.code)} — ${s(r.legalName)}`);

export const loadChartsOfAccounts = async (): Promise<Option[]> =>
  toOptions(await accountingService.listChartsOfAccounts(), (r) => `${s(r.code)} — ${s(r.name)} (v${s(r.versionNo)})`);

export const loadLedgers = async (): Promise<Option[]> =>
  toOptions(await accountingService.listLedgers(), (r) => `${s(r.code)} — ${s(r.name)}`);

export const loadAccountingPeriods = async (): Promise<Option[]> =>
  toOptions(await accountingService.listAccountingPeriods(), (r) => `Período ${s(r.periodNo)} · ${s(r.startDate).slice(0, 10)}`);

export const loadTaxCodes = async (): Promise<Option[]> =>
  toOptions(await accountingService.listTaxCodes(), (r) => `${s(r.code)} — ${s(r.taxType)} ${s(r.rate)}%`);

export const loadGlAccounts = async (): Promise<Option[]> =>
  toOptions(rowsOf(await accountingService.listGlAccounts({ page: 1, pageSize: 100 })), (r) => `${s(r.accountNo)} — ${s(r.name)}`);

export const loadBusinessPartners = async (): Promise<Option[]> =>
  toOptions(rowsOf(await accountingService.listBusinessPartners({ page: 1, pageSize: 100 })), (r) => `${s(r.partnerNo)} — ${s(r.legalName)}`);

export const loadContracts = async (): Promise<Option[]> =>
  toOptions(rowsOf(await accountingService.listContracts()), (r) => `${s(r.contractNo)} — ${s(r.contractType)}`);

export const loadCostCenters = async (): Promise<Option[]> =>
  toOptions(await accountingService.listCostCenters(), (r) => `${s(r.code)} — ${s(r.name)}`);

export const loadProfitCenters = async (): Promise<Option[]> =>
  toOptions(await accountingService.listProfitCenters(), (r) => `${s(r.code)} — ${s(r.name)}`);

export const loadBankAccounts = async (): Promise<Option[]> =>
  toOptions(await accountingService.listBankAccounts(), (r) => `${s(r.accountName)} (${s(r.currencyCode)})`);

export const loadAccountGroups = async (): Promise<Option[]> =>
  toOptions(rowsOf(await accountingService.listAccountGroups({ page: 1, pageSize: 100 })), (r) => `${s(r.code)} — ${s(r.name)}`);

export const loadArInvoices = async (): Promise<Option[]> =>
  toOptions(rowsOf(await accountingService.listArInvoices()), (r) => `${s(r.invoiceNo)} — ${s(r.netAmount)}`);

export const loadBillingEvents = async (): Promise<Option[]> =>
  toOptions(await accountingService.listBillingEvents(), (r) => `${s(r.eventType)} — ${s(r.baseAmount)} ${s(r.currencyCode)} (${s(r.eventTime).slice(0, 10)})`);

// ---- CRM ----
export const loadInternalUsers = async (): Promise<Option[]> =>
  toOptions(await b2bService.listInternalUsers(), (r) => `${s(r.fullName)} (${s(r.roleCode)})`);

export const loadB2BAccounts = async (): Promise<Option[]> =>
  toOptions(rowsOf(await b2bService.listAccounts({ page: 1, limit: 100 })), (r) => `${s(r.tradeName || r.legalName)}`);

export const loadB2BContracts = async (): Promise<Option[]> =>
  toOptions(await b2bService.listB2BContracts(), (r) => `${s(r.contractNumber)} — ${s(r.status)}`);

export const loadReceivables = async (): Promise<Option[]> =>
  toOptions(await b2bService.listReceivables(), (r) => `${s(r.sourceType)} — saldo ${s(r.amountOpen)} (vence ${s(r.dueDate)})`);

/**
 * Casos de onboarding, etiquetados por el NOMBRE del comercio y su estado.
 *
 * La pantalla pedia el uuid a mano porque el backend no exponia lectura. Se etiqueta con el nombre
 * y con cuantos requisitos quedan pendientes, que es lo que decide si el caso se puede activar.
 */
export const loadOnboardingCases = async (): Promise<Option[]> =>
  (await b2bService.listOnboardingCases()).map((row) => ({
    value: s(row.id),
    label: `${s(row.tradeName) || s(row.accountId)} — ${s(row.status)}${Number(row.pendingItems) > 0 ? ` (${s(row.pendingItems)} pendiente(s))` : ''}`,
  }));

/** Requisitos del caso elegido. Vacio mientras no haya caso: no hay item sin caso. */
export const loadChecklistItems = async (onboardingCaseId: string): Promise<Option[]> => {
  if (!onboardingCaseId) return [];
  const detail = await b2bService.getOnboardingCase(onboardingCaseId);
  const items = (detail.checklistItems ?? []) as Array<Record<string, unknown>>;
  return items.map((item) => ({
    value: s(item.id),
    label: `${s(item.itemType)} · ${s(item.description)} — ${s(item.status)}`,
  }));
};
