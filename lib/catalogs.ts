/**
 * Catálogos estáticos para campos normalizados que antes eran texto libre.
 * Se exponen como arrays `{ label, value }` listos para `FormField kind="select"`
 * o el `type: 'select'` de `StructuredActionForm`. LatAm-first donde aplica.
 */

export interface CatalogOption {
  label: string;
  value: string;
}

/** ISO 4217 — BOB/USD primero por ser los de uso corriente en el ERP. */
export const currencyOptions: CatalogOption[] = [
  { label: 'BOB — Boliviano', value: 'BOB' },
  { label: 'USD — Dólar estadounidense', value: 'USD' },
  { label: 'EUR — Euro', value: 'EUR' },
  { label: 'ARS — Peso argentino', value: 'ARS' },
  { label: 'BRL — Real brasileño', value: 'BRL' },
  { label: 'CLP — Peso chileno', value: 'CLP' },
  { label: 'PEN — Sol peruano', value: 'PEN' },
  { label: 'PYG — Guaraní paraguayo', value: 'PYG' },
  { label: 'UYU — Peso uruguayo', value: 'UYU' },
  { label: 'COP — Peso colombiano', value: 'COP' },
  { label: 'MXN — Peso mexicano', value: 'MXN' },
];

/** ISO 3166-1 alpha-2 — Bolivia primero. */
export const countryOptions: CatalogOption[] = [
  { label: 'Bolivia', value: 'BO' },
  { label: 'Argentina', value: 'AR' },
  { label: 'Brasil', value: 'BR' },
  { label: 'Chile', value: 'CL' },
  { label: 'Colombia', value: 'CO' },
  { label: 'Ecuador', value: 'EC' },
  { label: 'México', value: 'MX' },
  { label: 'Paraguay', value: 'PY' },
  { label: 'Perú', value: 'PE' },
  { label: 'Uruguay', value: 'UY' },
  { label: 'Estados Unidos', value: 'US' },
  { label: 'España', value: 'ES' },
];

/** IANA time zones — lista corta LatAm-first. */
export const timezoneOptions: CatalogOption[] = [
  { label: 'La Paz (GMT-4)', value: 'America/La_Paz' },
  { label: 'Buenos Aires (GMT-3)', value: 'America/Argentina/Buenos_Aires' },
  { label: 'São Paulo (GMT-3)', value: 'America/Sao_Paulo' },
  { label: 'Santiago (GMT-3/-4)', value: 'America/Santiago' },
  { label: 'Bogotá (GMT-5)', value: 'America/Bogota' },
  { label: 'Lima (GMT-5)', value: 'America/Lima' },
  { label: 'Asunción (GMT-3/-4)', value: 'America/Asuncion' },
  { label: 'Montevideo (GMT-3)', value: 'America/Montevideo' },
  { label: 'Ciudad de México (GMT-6)', value: 'America/Mexico_City' },
  { label: 'Madrid (GMT+1/+2)', value: 'Europe/Madrid' },
  { label: 'UTC', value: 'UTC' },
];

export const kybStatusOptions: CatalogOption[] = [
  { label: 'Pendiente', value: 'PENDING' },
  { label: 'En revisión', value: 'IN_REVIEW' },
  { label: 'Aprobado', value: 'APPROVED' },
  { label: 'Rechazado', value: 'REJECTED' },
];

export const recordStatusOptions: CatalogOption[] = [
  { label: 'Activo', value: 'ACTIVE' },
  { label: 'Inactivo', value: 'INACTIVE' },
  { label: 'Archivado', value: 'ARCHIVED' },
];

export const partnerTypeOptions: CatalogOption[] = [
  { label: 'Persona', value: 'PERSON' },
  { label: 'Empresa', value: 'COMPANY' },
  { label: 'Banco', value: 'BANK' },
  { label: 'Entidad del grupo', value: 'GROUP_ENTITY' },
];

export const glAccountTypeOptions: CatalogOption[] = [
  { label: 'Activo', value: 'ASSET' },
  { label: 'Pasivo', value: 'LIABILITY' },
  { label: 'Patrimonio', value: 'EQUITY' },
  { label: 'Ingreso', value: 'REVENUE' },
  { label: 'Gasto', value: 'EXPENSE' },
  { label: 'Contra-activo', value: 'CONTRA_ASSET' },
];

export const normalBalanceOptions: CatalogOption[] = [
  { label: 'Débito', value: 'D' },
  { label: 'Crédito', value: 'C' },
];

export const statementTypeOptions: CatalogOption[] = [
  { label: 'Balance General', value: 'BALANCE_SHEET' },
  { label: 'Estado de Resultados', value: 'INCOME_STATEMENT' },
  { label: 'Flujo de Efectivo', value: 'CASH_FLOW' },
  { label: 'Cambios en el Patrimonio', value: 'EQUITY_CHANGES' },
  { label: 'Memorándum / Orden', value: 'MEMORANDUM' },
];

export const accountClassificationOptions: CatalogOption[] = [
  { label: 'Activo', value: 'ASSET' },
  { label: 'Pasivo', value: 'LIABILITY' },
  { label: 'Patrimonio', value: 'EQUITY' },
  { label: 'Ingreso', value: 'REVENUE' },
  { label: 'Gasto', value: 'EXPENSE' },
];

/** Vocabulario controlado para el rol de un vínculo multientidad de cuenta. */
export const entityLinkRelationOptions: CatalogOption[] = [
  { label: 'Por defecto', value: 'DEFAULT' },
  { label: 'Cuenta por cobrar (control)', value: 'AR_CONTROL' },
  { label: 'Cuenta por pagar (control)', value: 'AP_CONTROL' },
  { label: 'Anticipos', value: 'ADVANCE' },
  { label: 'Recargos', value: 'SURCHARGE' },
  { label: 'Ingreso', value: 'REVENUE' },
  { label: 'Impuesto', value: 'TAX' },
];

export const partnerAccountPurposeOptions: CatalogOption[] = [
  { label: 'Cuentas por cobrar (control)', value: 'AR_CONTROL' },
  { label: 'Cuentas por pagar (control)', value: 'AP_CONTROL' },
  { label: 'Anticipos de cliente', value: 'CUSTOMER_ADVANCES' },
  { label: 'Anticipos a proveedor', value: 'SUPPLIER_ADVANCES' },
  { label: 'Recargos', value: 'SURCHARGES' },
  { label: 'Descuentos', value: 'DISCOUNTS' },
  { label: 'Retenciones', value: 'WITHHOLDINGS' },
];

export function purposeLabel(value: string): string {
  return partnerAccountPurposeOptions.find((option) => option.value === value)?.label ?? value;
}

export const entityLinkTypeOptions: CatalogOption[] = [
  { label: 'Business Partner', value: 'BUSINESS_PARTNER' },
  { label: 'Centro de costo', value: 'COST_CENTER' },
  { label: 'Centro de beneficio', value: 'PROFIT_CENTER' },
  { label: 'Contrato', value: 'CONTRACT' },
  { label: 'Entidad legal', value: 'LEGAL_ENTITY' },
  { label: 'Código de impuesto', value: 'TAX_CODE' },
  { label: 'Cuenta bancaria', value: 'BANK_ACCOUNT' },
  { label: 'Ledger', value: 'LEDGER' },
  { label: 'Sucursal', value: 'BRANCH' },
  { label: 'Documento contable', value: 'ACCOUNTING_DOCUMENT' },
  { label: 'Otro', value: 'OTHER' },
];

export const riskTierOptions: CatalogOption[] = [
  { label: 'Bajo', value: 'LOW' },
  { label: 'Medio', value: 'MEDIUM' },
  { label: 'Alto', value: 'HIGH' },
  { label: 'Crítico', value: 'CRITICAL' },
];

export const industryOptions: CatalogOption[] = [
  { label: 'Retail / Comercio', value: 'RETAIL' },
  { label: 'Servicios', value: 'SERVICES' },
  { label: 'Manufactura', value: 'MANUFACTURING' },
  { label: 'Tecnología', value: 'TECHNOLOGY' },
  { label: 'Finanzas', value: 'FINANCE' },
  { label: 'Salud', value: 'HEALTHCARE' },
  { label: 'Educación', value: 'EDUCATION' },
  { label: 'Transporte y logística', value: 'LOGISTICS' },
  { label: 'Alimentos y bebidas', value: 'FOOD_BEVERAGE' },
  { label: 'Otro', value: 'OTHER' },
];

/** Helper para `StructuredActionForm` (usa `type: 'select'` + `options`). */
export function asFormOptions(options: CatalogOption[]): CatalogOption[] {
  return options;
}
