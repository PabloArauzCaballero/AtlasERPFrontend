'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Saca el overlay del árbol donde se declara y lo cuelga de `<body>`.
 *
 * No es una preferencia de estilo: `main` lleva `relative z-10` para pintarse
 * sobre el fondo ambiental, y eso crea un CONTEXTO DE APILADO. Un panel
 * declarado dentro —el botón de ayuda vive en la cabecera de cada pantalla—
 * compite dentro de ese contexto, no contra la página, así que por mucho
 * `z-index` que se le ponga queda por debajo de la barra superior. Se veía: el
 * encabezado del panel salía tapado.
 *
 * El portal lo resuelve de raíz en vez de subir números hasta que «se vea»,
 * que es la solución que vuelve a romperse en cuanto alguien añade otra capa.
 *
 * Monta sólo tras hidratar: `document` no existe en el servidor, y renderizar
 * distinto en cliente y servidor haría que React descartara el árbol servido.
 */
export function TutorialPortal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}
