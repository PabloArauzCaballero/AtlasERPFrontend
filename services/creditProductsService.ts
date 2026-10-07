import { apiRequest } from '@/lib/apiClient';
import type { JsonObject, ResourceRow } from './types';

/**
 * Los productos de crédito que Atlas ofrece, vistos y configurados desde el ERP.
 *
 * Reenvío fino a AtlasBackend (`/credit-products` del ERP → `operations/credit/products`): el Core valida los
 * rangos, el código único y las transiciones de estado. No hay «editar» ni «borrar» porque el Core no las ofrece:
 * un producto equivocado se retira y se crea otro.
 */
export type EstadoDeProducto = 'draft' | 'active' | 'suspended' | 'retired';

export interface ProductoDeCredito extends ResourceRow {
  id: string;
  productCode: string;
  productName: string;
  currencyCode: string;
  minAmount: string | number;
  maxAmount: string | number;
  minTermMonths: number;
  maxTermMonths: number;
  annualInterestRate: string | number | null;
  status: EstadoDeProducto | string;
}

const RUTA = '/credit-products';

/** El código del producto sale del nombre: es un identificador del sistema y nadie debería tener que inventarlo. */
export function codigoDeProducto(nombre: string, ahora = Date.now()): string {
  const base = nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '_')
    .replace(/^_+|_+$/gu, '')
    .slice(0, 40);
  // El sufijo evita choque con un producto retirado que se llamaba igual (el código es único y no se reutiliza).
  return `${base || 'producto'}_${ahora.toString(36)}`.slice(0, 60);
}

export const creditProductsService = {
  async list(): Promise<ProductoDeCredito[]> {
    const respuesta = await apiRequest<{ products?: ProductoDeCredito[] }>(RUTA);
    return respuesta.products ?? [];
  },
  create(payload: JsonObject) {
    return apiRequest<ProductoDeCredito>(RUTA, { method: 'POST', body: payload });
  },
  changeStatus(productId: string, status: EstadoDeProducto, reasonCode = 'CAMBIO_DESDE_ERP') {
    return apiRequest<ProductoDeCredito>(`${RUTA}/${encodeURIComponent(productId)}/status`, {
      method: 'PATCH',
      body: { status, reasonCode },
    });
  },
};

/**
 * ¿Hay algún producto ACTIVO que admita esta parte financiada? Es exactamente lo que pregunta la app antes de
 * pedir el crédito; sin respuesta afirmativa la compra no avanza.
 */
export function productoQueAdmite(productos: readonly ProductoDeCredito[], financiado: number): ProductoDeCredito | null {
  return (
    productos.find((p) => p.status === 'active' && financiado >= Number(p.minAmount) && financiado <= Number(p.maxAmount)) ?? null
  );
}

/** El tramo de lo financiado que NINGÚN producto activo cubre, dicho en una frase para el aviso de la pantalla. */
export function avisoDeCobertura(productos: readonly ProductoDeCredito[]): string | null {
  const activos = productos.filter((p) => p.status === 'active');
  if (activos.length === 0) {
    return 'No hay ningún producto activo. Mientras no lo haya, ninguna compra de la app puede financiarse: el cliente verá «este monto no tiene un crédito disponible». Crea uno y actívalo.';
  }
  const minimo = Math.min(...activos.map((p) => Number(p.minAmount)));
  const maximo = Math.max(...activos.map((p) => Number(p.maxAmount)));
  const ordenados = [...activos].sort((a, b) => Number(a.minAmount) - Number(b.minAmount));
  let cubiertoHasta = Number(ordenados[0]!.maxAmount);
  for (const p of ordenados.slice(1)) {
    if (Number(p.minAmount) > cubiertoHasta + 0.01) {
      return `Hay un hueco: lo financiado entre Bs ${cubiertoHasta} y Bs ${p.minAmount} no lo admite ningún producto activo.`;
    }
    cubiertoHasta = Math.max(cubiertoHasta, Number(p.maxAmount));
  }
  // La compra financia el 40 %: el monto de compra mínimo que se podrá hacer es minimo / 0,4.
  return minimo > 0
    ? `Los productos activos cubren lo financiado desde Bs ${minimo} hasta Bs ${maximo}. Como la app financia el 40 % de la compra, las compras menores de Bs ${Math.ceil(minimo / 0.4)} no tienen crédito.`
    : null;
}

/** Lo que el formulario manda al Core: el código sale del nombre y la tasa vacía no viaja. */
export function cuerpoDeProducto(payload: JsonObject): JsonObject {
  const cuerpo: JsonObject = {
    productCode: codigoDeProducto(String(payload.productName ?? '')),
    productName: payload.productName,
    currencyCode: payload.currencyCode,
    minAmount: payload.minAmount,
    maxAmount: payload.maxAmount,
    minTermMonths: payload.minTermMonths,
    maxTermMonths: payload.maxTermMonths,
    requiresManualReview: false,
  };
  if (payload.annualInterestRate !== undefined && payload.annualInterestRate !== null && payload.annualInterestRate !== '') {
    cuerpo.annualInterestRate = payload.annualInterestRate;
  }
  if (payload.description) cuerpo.description = payload.description;
  return cuerpo;
}
