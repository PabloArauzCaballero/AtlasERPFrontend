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
/** Ciudades de Bolivia (capitales de departamento y plazas comerciales relevantes). */
export const cityOptions: CatalogOption[] = [
  { label: 'Santa Cruz de la Sierra', value: 'Santa Cruz de la Sierra' },
  { label: 'La Paz', value: 'La Paz' },
  { label: 'El Alto', value: 'El Alto' },
  { label: 'Cochabamba', value: 'Cochabamba' },
  { label: 'Sucre', value: 'Sucre' },
  { label: 'Oruro', value: 'Oruro' },
  { label: 'Potosí', value: 'Potosí' },
  { label: 'Tarija', value: 'Tarija' },
  { label: 'Trinidad', value: 'Trinidad' },
  { label: 'Cobija', value: 'Cobija' },
  { label: 'Montero', value: 'Montero' },
  { label: 'Quillacollo', value: 'Quillacollo' },
  { label: 'Otra', value: 'Otra' },
];

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

/**
 * Cargo del contacto principal de la cuenta. Catálogo cerrado para que la cartera se pueda
 * agrupar y filtrar por tipo de interlocutor, en vez de recibir texto libre irrepetible.
 */
export const contactRoleTitleOptions: CatalogOption[] = [
  { label: 'Propietario / Dueño', value: 'PROPIETARIO' },
  { label: 'Gerente general', value: 'GERENTE_GENERAL' },
  { label: 'Gerente comercial', value: 'GERENTE_COMERCIAL' },
  { label: 'Gerente de finanzas', value: 'GERENTE_FINANZAS' },
  { label: 'Gerente de operaciones', value: 'GERENTE_OPERACIONES' },
  { label: 'Administrador', value: 'ADMINISTRADOR' },
  { label: 'Contador', value: 'CONTADOR' },
  { label: 'Encargado de sucursal', value: 'ENCARGADO_SUCURSAL' },
  { label: 'Vendedor / Cajero', value: 'VENDEDOR' },
  { label: 'Otro', value: 'OTRO' },
];

/**
 * Peso del contacto en la decisión de compra. Vocabulario clásico de venta B2B: sirve para que
 * el ejecutivo sepa a quién convencer y quién solo influye.
 */
export const decisionRoleOptions: CatalogOption[] = [
  { label: 'Decisor final', value: 'DECISOR' },
  { label: 'Influenciador', value: 'INFLUENCIADOR' },
  { label: 'Aprobador de presupuesto', value: 'APROBADOR' },
  { label: 'Usuario del servicio', value: 'USUARIO' },
  { label: 'Contacto de gestión', value: 'GESTOR' },
  { label: 'Bloqueador / Portero', value: 'BLOQUEADOR' },
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

/**
 * Categoria comercial del comercio afiliado. Antes era texto libre con un `placeholder` de ejemplo
 * («Retail, Servicios, Manufactura»): cada vendedor escribia lo que le parecia y la columna
 * `b2b_accounts.category` acababa con variantes que no agrupan ni filtran. Un dato que sirve para
 * segmentar tiene que venir de un catalogo cerrado.
 */
/*
 * Estos valores tienen que coincidir EXACTAMENTE con `PARTNER_BUSINESS_CATEGORIES` de AtlasBackend:
 * son los que el borde acepta y los que agrupan el gasto del cliente y segmentan la comisión. Una
 * etiqueta se puede retocar aquí; un `value`, no —cambiarlo por su cuenta hace que el select deje
 * de reflejar lo que hay guardado, que es como el rubro de un comercio real llegó a verse como
 * «Sin definir» teniéndolo puesto—.
 */
export const merchantCategoryOptions: CatalogOption[] = [
  { label: 'Retail / Comercio', value: 'RETAIL' },
  { label: 'Servicios profesionales', value: 'SERVICIOS' },
  { label: 'Educacion', value: 'EDUCACION' },
  { label: 'Salud y farmacia', value: 'SALUD' },
  { label: 'Alimentos y bebidas', value: 'ALIMENTOS' },
  { label: 'Tecnologia y electronica', value: 'TECNOLOGIA' },
  { label: 'Hogar y muebles', value: 'HOGAR' },
  { label: 'Vestimenta y calzado', value: 'VESTIMENTA' },
  { label: 'Automotor y repuestos', value: 'AUTOMOTOR' },
  { label: 'Construccion y ferreteria', value: 'CONSTRUCCION' },
  { label: 'Turismo y transporte', value: 'TURISMO' },
  { label: 'Otro', value: 'OTRO' },
];

/** Rubro o actividad principal. Mismo motivo que la categoria: se usa para agrupar cartera. */
export const businessLineOptions: CatalogOption[] = [
  { label: 'Venta de electrodomesticos y tecnologia', value: 'ELECTRODOMESTICOS' },
  { label: 'Supermercado y abarrotes', value: 'ABARROTES' },
  { label: 'Farmacia', value: 'FARMACIA' },
  { label: 'Restaurante y comida rapida', value: 'RESTAURANTE' },
  { label: 'Preparacion academica y cursos', value: 'PREPARACION_ACADEMICA' },
  { label: 'Colegio o instituto', value: 'INSTITUCION_EDUCATIVA' },
  { label: 'Tienda de ropa y calzado', value: 'ROPA_CALZADO' },
  { label: 'Muebleria y decoracion', value: 'MUEBLERIA' },
  { label: 'Ferreteria y materiales', value: 'FERRETERIA' },
  { label: 'Taller y repuestos', value: 'TALLER_REPUESTOS' },
  { label: 'Agencia de viajes y transporte', value: 'VIAJES_TRANSPORTE' },
  { label: 'Servicios profesionales', value: 'SERVICIOS_PROFESIONALES' },
  { label: 'Otro', value: 'OTRO' },
];

/** Helper para `StructuredActionForm` (usa `type: 'select'` + `options`). */
export function asFormOptions(options: CatalogOption[]): CatalogOption[] {
  return options;
}
