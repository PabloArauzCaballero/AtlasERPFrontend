/**
 * Tope de filas que devuelven varios listados del ERP (facturas, cobertura, pipeline, contratos,
 * reglas MDR, cuentas por cobrar). El servidor los corta a 200 con un orden fijo y sin paginar;
 * la pantalla lo dice al llegar al tope en vez de rotularlos «todo».
 */
export const TOPE_LISTADO = 200;

export function tope(texto: string): { max: number; texto: string } {
  return { max: TOPE_LISTADO, texto };
}
