import { accountingService } from './accountingService';
import { adsService } from './adsService';
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

/**
 * Los atributos que un segmento comercial puede mirar, prefijados por su sujeto.
 *
 * El prefijo es lo que evita el error que este desplegable invita a cometer: elegir «Cuotas en
 * mora» en un segmento de partners. El backend lo rechaza igual —el vocabulario es por sujeto—,
 * pero verlo antes de enviar ahorra el viaje.
 */
export const loadSegmentAttributes = async (): Promise<Option[]> => {
  const vocabulary = await b2bService.listCrmSegmentVocabulary();
  return vocabulary.flatMap((entry) => {
    const attributes = Array.isArray(entry.attributes) ? entry.attributes : [];
    return (attributes as ResourceRow[]).map((attribute) => ({
      value: s(attribute.name),
      label: `${s(entry.subjectName)} · ${s(attribute.label)}`,
    }));
  });
};

/** Sucursales de comercio, para elegir dónde se origina una venta a plazos. */
export const loadMerchantBranches = async (): Promise<Option[]> =>
  toOptions(await b2bService.listBranches(), (r) => `${s(r.name)} — ${s(r.city) || 'sin ciudad'}`);

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

/** Propuestas, etiquetadas por su numero y el comercio: es por lo que se las busca. */
export const loadProposals = async (): Promise<Option[]> =>
  (await b2bService.listProposals()).map((row) => ({
    value: s(row.id),
    label: `${s(row.proposalNumber)} — ${s(row.tradeName) || s(row.accountId)} (${s(row.status)})`,
  }));

/** Aprobaciones esperando decision. Sin este listado la cola no se podia ni leer. */
export const loadPendingApprovals = async (): Promise<Option[]> =>
  (await b2bService.listApprovals(true)).map((row) => ({
    value: s(row.id),
    label: `${s(row.approvalType)} — ${s(row.reason).slice(0, 60) || 'sin motivo'}`,
  }));

/** Contratos vivos, por numero y comercio. */
export const loadContracts2 = async (): Promise<Option[]> =>
  (await b2bService.listContracts()).map((row) => ({
    value: s(row.id),
    label: `${s(row.contractNumber)} — ${s(row.tradeName) || s(row.accountId)} (${s(row.status)})`,
  }));

/** Oportunidades del pipeline, por nombre y etapa. */
export const loadOpportunities = async (): Promise<Option[]> =>
  (await b2bService.listOpportunities()).map((row) => ({
    value: s(row.id),
    label: `${s(row.name)} — ${s(row.stage)}`,
  }));

// ---- Ads ----
/** Anunciantes registrados. El bloque de Ads ya los expone; la pantalla pedia su uuid a mano. */
export const loadAdvertisers = async (): Promise<Option[]> =>
  toOptions(rowsOf(await adsService.listAdvertisers({ page: 1, pageSize: 100 })), (r) => `${s(r.name || r.legalName)}`);

/** Campanas, por nombre y estado. */
export const loadCampaigns = async (): Promise<Option[]> =>
  toOptions(rowsOf(await adsService.listCampaigns({ page: 1, pageSize: 100 })), (r) => `${s(r.name)} — ${s(r.status)}`);

/** Segmentos de audiencia. */
export const loadSegments = async (): Promise<Option[]> =>
  toOptions(rowsOf(await adsService.listSegments({ page: 1, pageSize: 100 })), (r) => `${s(r.name)}`);

/** Anos fiscales. Ya existia `GET /accounting/financial-structure/fiscal-years`. */
export const loadFiscalYears = async (): Promise<Option[]> =>
  toOptions(await accountingService.listFiscalYears(), (r) => `${s(r.code || r.name)} (${s(r.status)})`);

/** Documentos contables, por numero y fecha. */
export const loadAccountingDocuments = async (): Promise<Option[]> =>
  toOptions(rowsOf(await accountingService.listAccountingDocuments()), (r) => `${s(r.documentNo || r.id)} — ${s(r.postingDate).slice(0, 10)}`);

/** Cuotas BNPL, por vencimiento e importe: es como las reconoce quien concilia. */
export const loadInstallments = async (): Promise<Option[]> =>
  (await b2bService.listInstallments()).map((row) => ({
    value: s(row.id),
    label: `Cuota ${s(row.installmentNumber)} — vence ${s(row.dueDate).slice(0, 10)} — ${s(row.amount)} (${s(row.status)})`,
  }));

/** Pagos pendientes al comercio. */
export const loadPayables = async (): Promise<Option[]> =>
  (await b2bService.listPayables()).map((row) => ({
    value: s(row.id),
    label: `${s(row.amount)} — ${s(row.status)} (programado ${s(row.scheduledPaymentDate).slice(0, 10)})`,
  }));

/** Recuperaciones abiertas, por mora e importe cubierto. */
export const loadRecoveries = async (): Promise<Option[]> =>
  (await b2bService.listRecoveries()).map((row) => ({
    value: s(row.id),
    label: `${s(row.recoveryStatus)} — cubierto ${s(row.amountCoveredByAtlas)} — ${s(row.daysPastDue)} dias de mora`,
  }));

/** Conjuntos de anuncios, por nombre y modelo de compra (CPM o CPC). */
export const loadAdSets = async (): Promise<Option[]> =>
  (await adsService.listAdSets()).map((row) => ({
    value: s((row as ResourceRow).id),
    label: `${s((row as ResourceRow).name)} — ${s((row as ResourceRow).buyingModel)}`,
  }));

/** Creatividades disponibles. */
export const loadCreatives = async (): Promise<Option[]> =>
  (await adsService.listCreatives()).map((row) => ({
    value: s((row as ResourceRow).id),
    label: `${s((row as ResourceRow).name)} — ${s((row as ResourceRow).creativeType)}`,
  }));

/** Espacios publicitarios donde se puede entregar. */
export const loadPlacements = async (): Promise<Option[]> =>
  (await adsService.listPlacements()).map((row) => ({
    value: s((row as ResourceRow).id),
    label: `${s((row as ResourceRow).code)} — ${s((row as ResourceRow).surface)}`,
  }));

/** Facturas de comercio, por numero y estado. */
export const loadMerchantInvoices = async (): Promise<Option[]> =>
  (await b2bService.listMerchantInvoices()).map((row) => ({
    value: s(row.id),
    label: `${s(row.invoiceNumber)} — ${s(row.totalAmount)} (${s(row.status)})`,
  }));

/**
 * Eventos de entrega recientes, para corregir su elegibilidad de facturacion.
 *
 * El monitor de arriba ya los lista; lo que faltaba era poder ELEGIR uno. Pedir «el UUID exacto del
 * evento seleccionado en el monitor» obligaba a copiarlo a mano de una tabla a un campo de texto.
 */
export const loadDeliveryEvents = async (): Promise<Option[]> =>
  toOptions(rowsOf(await adsService.getDeliveryMonitor({ page: 1, pageSize: 100 })), (r) =>
    `${s(r.eventType)} — ${s(r.occurredAt).slice(0, 16).replace('T', ' ')} — ${s(r.billableStatus)}`);
