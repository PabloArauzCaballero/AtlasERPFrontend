/**
 * Un UUID v4 que también funciona sin origen seguro.
 *
 * `crypto.randomUUID` sólo existe en contexto seguro (HTTPS o localhost). El ERP se sirve además
 * por HTTP plano —`http://erp.161.97.85.216.sslip.io`, `http://100.101.207.88:3010`—, y ahí la
 * propiedad no está definida: llamarla lanza `TypeError` y, dentro de un manejador de React, tumba
 * la pantalla entera con «Application error: a client-side exception has occurred». Pasó al pulsar
 * «Agregar término» en una propuesta.
 *
 * `crypto.getRandomValues` no exige contexto seguro, así que el respaldo sigue siendo un UUID v4 de
 * verdad: hay claves de idempotencia que viajan al backend y acaban en columnas `uuid`, que
 * descartarían en silencio un `erp-<ts>-<rand>`.
 */
export function newUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const b = crypto.getRandomValues(new Uint8Array(16));
    b[6] = ((b[6] ?? 0) & 0x0f) | 0x40;
    b[8] = ((b[8] ?? 0) & 0x3f) | 0x80;
    const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  }
  // Sin `crypto` no hay UUID posible; un id peor es mejor que una pantalla caída.
  return `erp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
