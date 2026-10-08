/**
 * La guía en PDF de cada población: el manual de procesos paso a paso, con la captura de cada
 * pantalla y el sitio exacto donde hacer clic.
 *
 * Son archivos estáticos (`public/guias/`) y no un documento que se genera al pedirlo: una guía es
 * la misma para todos, se descarga sin esperar y sigue disponible si el generador de PDF no responde.
 *
 * Una población sin entrada aquí no ve el botón. Ofrecer una descarga que da 404 es peor que no
 * ofrecerla: quien la busca ya venía con una duda.
 */
export interface GuiaPdf {
  href: string;
  archivo: string;
  titulo: string;
  detalle: string;
}

export const GUIAS_PDF: Readonly<Partial<Record<'internal' | 'merchant', GuiaPdf>>> = {
  internal: {
    href: '/guias/ATLAS-Guia-del-ERP.pdf',
    archivo: 'ATLAS-Guia-del-ERP.pdf',
    titulo: 'Guía del ERP, paso a paso',
    detalle: 'Registrar un negocio hasta que opera, dar de alta a sus usuarios y llevar la contabilidad: cada proceso con la pantalla, el sitio donde hacer clic y sus reglas.',
  },
  merchant: {
    href: '/guias/ATLAS-Guia-del-portal-del-comercio.pdf',
    archivo: 'ATLAS-Guia-del-portal-del-comercio.pdf',
    titulo: 'Guía del portal, paso a paso',
    detalle: 'Aceptar compras, confirmar pagos, seguir tu cartera y mantener tu empresa: cada pantalla con la imagen de dónde hacer clic y la regla que se cumple.',
  },
};

export function guiaPdfDe(audience: 'internal' | 'merchant'): GuiaPdf | null {
  return GUIAS_PDF[audience] ?? null;
}
