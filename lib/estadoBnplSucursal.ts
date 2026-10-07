/**
 * Si una sucursal puede vender a crédito (BNPL), dicho como se le dice al comercio.
 *
 * Una sucursal nace operativa y SIN la capacidad de originar BNPL: esa la concede Atlas por su canal interno
 * tras evaluar al comercio. La columna decía «No» para esa sucursal recién creada, como si se la hubiera
 * rechazado, cuando lo cierto es que todavía no se ha evaluado (Pablo, 2026-10-07: «algo raro sale como
 * BNPL: No»). «No» queda sólo para la sucursal dada de baja, que de verdad no puede vender.
 */
export interface EstadoBnpl {
  texto: 'Sí' | 'Por habilitar' | 'No';
  tono: 'success' | 'warning' | 'neutral';
  explicacion: string;
}

export function estadoBnplSucursal(sucursal: { canOriginateBnpl?: unknown; status?: unknown }): EstadoBnpl {
  if (sucursal.canOriginateBnpl) {
    return { texto: 'Sí', tono: 'success', explicacion: 'Esta sucursal puede vender a crédito con Atlas.' };
  }
  if (String(sucursal.status) === 'ACTIVE') {
    return {
      texto: 'Por habilitar',
      tono: 'warning',
      explicacion: 'Atlas habilita la venta a crédito en cada sucursal después de evaluar a tu comercio. Todavía no se ha habilitado.',
    };
  }
  return { texto: 'No', tono: 'neutral', explicacion: 'La sucursal está dada de baja y no puede vender a crédito.' };
}
