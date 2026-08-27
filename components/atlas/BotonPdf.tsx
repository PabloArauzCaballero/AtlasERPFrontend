'use client';

import { useState } from 'react';
import { AtlasButton } from './AtlasButton';
import { descargarPdf, nombreArchivoPdf, type DocumentoPdf } from '@/lib/pdf';
import { toast } from '@/lib/toast';

interface BotonPdfProps {
  /**
   * Se llama AL PULSAR, no al pintar.
   *
   * Armar el documento en cada renderizado costaría recorrer todas las filas de la pantalla en
   * cada tecla que se escribe en un filtro, para un documento que casi nunca se pide.
   */
  documento: () => DocumentoPdf;
  label?: string | undefined;
  filename?: string | undefined;
  disabled?: boolean | undefined;
  className?: string | undefined;
  'data-testid'?: string | undefined;
}

/**
 * «Descargar PDF», en una sola pieza.
 *
 * Las pantallas del portal del comercio no comparten un componente de tabla —cada una pinta lo
 * suyo: tarjetas, listas, un QR—, así que lo que se comparte es esto: el gesto, el estado de
 * «generando», y que un fallo se cuente en vez de dejar el botón mudo.
 */
export function BotonPdf({ documento, label, filename, disabled, className, ...rest }: BotonPdfProps) {
  const [generando, setGenerando] = useState(false);

  async function descargar() {
    setGenerando(true);
    try {
      const contenido = documento();
      await descargarPdf(contenido, filename ?? nombreArchivoPdf(contenido.title));
    } catch (error) {
      toast.error(
        'No se pudo generar el PDF',
        error instanceof Error ? error.message : 'Vuelve a intentarlo en un momento.',
      );
    } finally {
      setGenerando(false);
    }
  }

  return (
    <AtlasButton
      variant="secondary"
      icon="picture_as_pdf"
      className={className}
      data-testid={rest['data-testid'] ?? 'boton-pdf'}
      loading={generando}
      disabled={disabled ?? false}
      onClick={() => void descargar()}
    >
      {label ?? 'PDF'}
    </AtlasButton>
  );
}
