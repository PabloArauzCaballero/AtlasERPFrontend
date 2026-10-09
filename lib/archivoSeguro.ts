/**
 * Qué tipos de archivo se dejan PINTAR en el navegador y cuáles sólo se descargan.
 *
 * Un adjunto se trae con la sesión y se abre como `blob:`, y un `blob:` creado aquí tiene el
 * MISMO origen que el ERP. Si el servidor lo devuelve como `text/html`, `image/svg+xml` o XML —un
 * comercio que subió un HTML renombrado a `.pdf`, por ejemplo—, abrirlo en una pestaña o en un
 * `<iframe>` lo pinta como una página más del ERP: puede imitar la interfaz y, sin la CSP de la
 * página principal, ejecutar lo que traiga.
 *
 * Por eso se invierte la regla: en vez de enumerar lo peligroso, se enumera lo que de verdad se
 * guarda y se previsualiza —PDF e imágenes rasterizadas— y TODO lo demás pierde su tipo y pasa a
 * `application/octet-stream`. Con ese tipo el navegador no lo interpreta: lo descarga. Las
 * imágenes vectoriales (SVG) quedan fuera a propósito: son documentos XML con scripts.
 */
export const TIPOS_QUE_SE_PINTAN: ReadonlySet<string> = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
]);

/** El tipo sin parámetros ni mayúsculas: `Text/HTML; charset=utf-8` → `text/html`. */
export function tipoBase(tipo: string | null | undefined): string {
  return (tipo ?? '').split(';')[0]!.trim().toLowerCase();
}

export function esTipoQueSePinta(tipo: string | null | undefined): boolean {
  return TIPOS_QUE_SE_PINTAN.has(tipoBase(tipo));
}

/** El mismo contenido, pero con un tipo que el navegador ya no puede interpretar como página. */
export function blobInofensivo(blob: Blob): Blob {
  if (esTipoQueSePinta(blob.type)) return blob;
  return new Blob([blob], { type: 'application/octet-stream' });
}

/**
 * Abre en otra pestaña lo que se puede ver y DESCARGA lo demás, con su nombre.
 *
 * Sin el nombre, un `blob:` descargado se guarda como un identificador sin extensión.
 */
export function abrirODescargar(url: string, tipo: string | null | undefined, nombre: string): void {
  if (esTipoQueSePinta(tipo)) {
    window.open(url, '_blank', 'noopener');
    return;
  }
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  enlace.rel = 'noopener';
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
}
