/**
 * «Cuenta enmascarada» del QR de cobro: sólo los últimos 4 dígitos, nunca el número completo.
 *
 * El campo se llama `accountNumberMasked` y todo el sistema lo trata como ya protegido —el
 * expediente del comercio lo enseña tal cual (`PartnerDossierPanels`)—, pero aceptaba cualquier
 * texto. Quien escribía su número de cuenta entero lo dejaba guardado y a la vista en un sitio que
 * nadie protege, porque se supone que ahí no hay nada que proteger.
 *
 * Así que el navegador no confía en que el comercio lo escriba bien: si llega el número completo,
 * se enmascara aquí y se envía sólo `****` + los 4 últimos. Lo que no se puede leer como un número
 * de cuenta (letras, menos de 4 dígitos) se rechaza con un motivo. El backend debe validar lo
 * mismo: esto se puede saltar llamando a la API directamente.
 */
export const FORMATO_CUENTA_ENMASCARADA = /^\*{2,}\d{4}$/;

/** Lo que se acepta escribir: dígitos, asteriscos y los separadores habituales. */
const ESCRITURA_ADMITIDA = /^[\d*\s.\-]+$/;

export type CuentaLeida =
  | { ok: true; valor: string }
  | { ok: false; motivo: string };

/**
 * Lee lo escrito y devuelve la versión que se puede guardar.
 *
 * - Vacío → vacío: el campo es opcional.
 * - `****7890` → igual.
 * - `1234 5678 7890`, `10000-7890`, `*7890` → `****7890`.
 * - Letras o menos de cuatro dígitos → error.
 */
export function leerCuentaEnmascarada(entrada: string): CuentaLeida {
  const texto = entrada.trim();
  if (!texto) return { ok: true, valor: '' };
  // Siempre la misma forma (`****` + 4), aunque se escribiera `**7890`: así se lee igual en el expediente.
  if (FORMATO_CUENTA_ENMASCARADA.test(texto)) return { ok: true, valor: `****${texto.slice(-4)}` };
  if (!ESCRITURA_ADMITIDA.test(texto)) {
    return { ok: false, motivo: 'Escribe sólo números: los últimos cuatro dígitos de la cuenta, p. ej. ****7890.' };
  }
  const digitos = texto.replace(/\D/g, '');
  if (digitos.length < 4) {
    return { ok: false, motivo: 'Faltan dígitos: hacen falta los últimos cuatro de la cuenta, p. ej. ****7890.' };
  }
  return { ok: true, valor: `****${digitos.slice(-4)}` };
}
