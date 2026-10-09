/**
 * El destino tras el login (`?next=`) sólo puede ser una ruta de ESTE ERP.
 *
 * Antes se hacía `router.replace(searchParams.get('next'))` a ciegas, y un enlace
 * `…/login?next=https://clon.example` llevaba al personal interno —recién autenticado, con su
 * segundo factor real— a una copia del ERP que le pedía «reingresar la contraseña» (CWE-601). Una
 * redirección abierta en la pantalla de acceso es el mejor cebo posible: el usuario acaba de ver
 * el dominio legítimo y confía en lo que venga después.
 *
 * Lo que se acepta y por qué:
 *
 * - Tiene que empezar por `/`: una ruta relativa al origen. `https://…`, `javascript:…` o `data:…`
 *   quedan fuera sin tener que enumerarlos.
 * - No puede empezar por `//` ni por `/\`: el navegador los resuelve como «otro host con el mismo
 *   esquema» (`//clon.example` → `https://clon.example`), y la barra invertida la normalizan como
 *   barra normal.
 * - Sin caracteres de control ni espacios en blanco raros: el analizador de URL se SALTA tabuladores
 *   y saltos de línea, así que `/\t/clon.example` llega a ser `//clon.example` después de pasar
 *   cualquier comprobación textual.
 * - Y la prueba final, que es la que manda: resuelta contra el origen actual tiene que seguir en el
 *   mismo origen. Las reglas de arriba descartan pronto lo obvio; ésta cubre lo que se escape.
 *
 * Si no pasa, se devuelve `null` y quien llama usa la portada de su población. No se avisa al
 * usuario: quien llegó con un `next` manipulado no tiene nada que corregir.
 */
export function rutaInternaSegura(valor: string | null | undefined, origen?: string): string | null {
  if (typeof valor !== 'string' || valor === '') return null;
  if (!valor.startsWith('/')) return null;
  if (valor.startsWith('//') || valor.startsWith('/\\')) return null;
  // Controles C0, DEL y C1; más los espacios que el analizador de URL recorta o ignora.
  if (/[\u0000-\u001f\u007f-\u009f\s\\]/.test(valor)) return null;

  const base = origen ?? (typeof window === 'undefined' ? undefined : window.location.origin);
  if (!base) return null;
  try {
    const resuelta = new URL(valor, base);
    if (resuelta.origin !== new URL(base).origin) return null;
    return `${resuelta.pathname}${resuelta.search}${resuelta.hash}`;
  } catch {
    return null;
  }
}
