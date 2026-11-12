/**
 * ¿Este módulo es el que se ejecutó con `node <ruta>`, o lo importó otro?
 *
 * Sustituye a `import.meta.url === \`file://${argv[1]}\``, que NUNCA es cierto en Windows
 * (`file:///C:/…` contra `file://C:\…`) ni cuando la ruta lleva espacios, `#`, `?` o `%`: la URL
 * va codificada (`%20`) y `argv[1]` no. Con esa comparación el guion no hacía NADA y salía 0, así
 * que una verificación «pasaba» sin haberse ejecutado.
 *
 * Compara rutas de sistema, no URLs, y resuelve enlaces simbólicos en los dos lados (en macOS
 * `/tmp` es `/private/tmp`).
 *
 *   import { esPrincipal } from './lib/es-principal.mjs';
 *   if (esPrincipal(import.meta.url)) await main();
 */
import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function real(ruta) {
  try {
    return realpathSync(ruta);
  } catch {
    return ruta;
  }
}

export function esPrincipal(urlDelModulo, rutaEjecutada = process.argv[1]) {
  if (!rutaEjecutada) return false;
  return real(fileURLToPath(urlDelModulo)) === real(resolve(rutaEjecutada));
}
