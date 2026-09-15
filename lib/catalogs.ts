/**
 * Listas geográficas e ISO: moneda, país, ciudad y zona horaria. LatAm-first.
 *
 * Aquí NO vive vocabulario de negocio. Los estados, tipos, rubros y demás dominios cerrados los
 * publica el backend en `GET /catalog/domains` y se piden con `optionsSource: 'domain:…'`; tenerlos
 * también aquí era la copia que se separaba el día que el backend añadía un valor. Estas listas se
 * quedan porque no pertenecen a ningún módulo del backend: se leen con `optionsSource: 'catalog:…'`.
 */

export interface CatalogOption {
  label: string;
  value: string;
  description?: string | undefined;
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
