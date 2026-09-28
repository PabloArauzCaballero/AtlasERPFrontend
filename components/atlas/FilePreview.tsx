'use client';

import { useEffect, useState } from 'react';
import { Icon } from '@/components/atlas/Icon';
import { LoadingSpinner } from '@/components/ui/LoadingIndicator';

/**
 * Vista previa de un archivo: la miniatura de una imagen, la primera página de un PDF o, para lo
 * que el navegador no sabe pintar (Excel, CSV, XML), una ficha con su icono.
 *
 * Existe porque el ERP enseñaba el archivo elegido como un nombre suelto —«contrato_final(3).pdf»—
 * y la única forma de saber si era EL contrato firmado o el borrador era subirlo y abrirlo después.
 * Verlo antes de guardar evita adjuntar el documento equivocado a un registro que luego no se
 * puede editar (un contrato, un asiento contabilizado).
 *
 * El PDF va en un `<iframe>` y no en un `<object>`: la CSP del ERP tiene `object-src 'none'` y
 * `frame-src blob:` (ver `middleware.ts`), así que un `<object>` se quedaría en blanco sin avisar.
 */

export type TipoDeVista = 'imagen' | 'pdf' | 'otro';

/** Qué se puede pintar de un archivo, por su tipo MIME y, si falta, por su extensión. */
export function tipoDeVista(mimeType: string | undefined, nombre = ''): TipoDeVista {
  const tipo = (mimeType ?? '').toLowerCase();
  const extension = nombre.toLowerCase().split('.').pop() ?? '';
  if (tipo.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(extension)) return 'imagen';
  if (tipo === 'application/pdf' || extension === 'pdf') return 'pdf';
  return 'otro';
}

/** El icono de Material Symbols que representa el archivo en su ficha. */
export function iconoDeArchivo(mimeType: string | undefined, nombre = ''): string {
  const vista = tipoDeVista(mimeType, nombre);
  if (vista === 'imagen') return 'image';
  if (vista === 'pdf') return 'picture_as_pdf';
  const extension = nombre.toLowerCase().split('.').pop() ?? '';
  const tipo = (mimeType ?? '').toLowerCase();
  if (['xlsx', 'xls', 'csv'].includes(extension) || tipo.includes('spreadsheet') || tipo.includes('csv') || tipo.includes('excel')) return 'table_view';
  if (extension === 'xml' || tipo.includes('xml')) return 'code';
  return 'description';
}

/** Nombre corto del tipo, para la línea de detalles de la ficha: «PDF», «PNG», «Excel»… */
export function etiquetaDeTipo(mimeType: string | undefined, nombre = ''): string {
  const extension = nombre.includes('.') ? nombre.toLowerCase().split('.').pop() ?? '' : '';
  const tipo = (mimeType ?? '').toLowerCase();
  if (tipo === 'application/pdf' || extension === 'pdf') return 'PDF';
  if (tipo === 'image/png' || extension === 'png') return 'PNG';
  if (tipo === 'image/jpeg' || extension === 'jpg' || extension === 'jpeg') return 'JPEG';
  if (extension === 'xlsx' || extension === 'xls' || tipo.includes('spreadsheet') || tipo.includes('excel')) return 'Excel';
  if (extension === 'csv' || tipo.includes('csv')) return 'CSV';
  if (extension === 'xml' || tipo.includes('xml')) return 'XML';
  if (extension) return extension.toUpperCase();
  return tipo || 'Archivo';
}

export function tamanoLegible(bytes: number): string {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  const megas = bytes / (1024 * 1024);
  // «15 MB», no «15.0 MB»: los límites son números redondos y así se leen en los textos de ayuda.
  return `${Number.isInteger(megas) ? megas : megas.toFixed(1)} MB`;
}

interface FilePreviewProps {
  /** URL que el navegador puede leer sin sesión: un `blob:` local (archivo elegido o bajado con sesión). */
  url: string;
  mimeType?: string | undefined;
  nombre: string;
  /** Alto del recuadro. El de un formulario es bajo; el de un visor de documentos, alto. */
  alto?: 'bajo' | 'alto' | undefined;
}

/**
 * Pinta la vista previa de una URL ya legible.
 *
 * Con el tipo desconocido (un archivo guardado del que el backend no dice qué es) se usa también
 * el `<iframe>`: el navegador pinta dentro tanto una imagen como un PDF, que es lo único que se
 * guarda en el almacén de evidencia.
 */
export function FilePreview({ url, mimeType, nombre, alto = 'bajo' }: FilePreviewProps) {
  const vista = mimeType ? tipoDeVista(mimeType, nombre) : tipoDeVista(undefined, nombre);
  const altura = alto === 'alto' ? 'h-[28rem] max-h-[60vh]' : 'h-44 sm:h-52';
  if (vista === 'imagen') {
    return (
      // `max-h-full` sobre un alto FIJO del contenedor: con `h-full` en una rejilla de alto automático
      // la imagen tomaba su tamaño natural y tapaba la ficha de debajo.
      <div className={`flex items-center justify-center overflow-hidden bg-slate-100 p-2 ${altura}`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- es un blob local: `next/image` exige una URL que el optimizador pueda buscar. */}
        <img src={url} alt={`Vista previa de ${nombre}`} className="max-h-full max-w-full rounded object-contain shadow-sm" />
      </div>
    );
  }
  if (vista === 'pdf' || !mimeType) {
    /*
     * `#toolbar=0&view=FitH`: la primera página a lo ancho, sin la barra del visor, que en un
     * recuadro de este tamaño taparía media página. Quien quiera hojearlo lo abre en otra pestaña.
     */
    const fuente = vista === 'pdf' ? `${url}#toolbar=0&navpanes=0&view=FitH` : url;
    return <iframe src={fuente} title={`Vista previa de ${nombre}`} className={`block w-full border-0 bg-slate-100 ${altura}`} />;
  }
  return null;
}

interface StoredFilePreviewProps {
  /** Trae el archivo con la sesión y devuelve un `blob:` (p. ej. `filesService.contentUrl`). */
  cargar: () => Promise<string>;
  mimeType?: string | undefined;
  nombre: string;
  alto?: 'bajo' | 'alto' | undefined;
}

/**
 * La vista previa de un archivo YA guardado.
 *
 * Los adjuntos no tienen URL pública —se leen con la sesión, como un blob—, así que se piden al
 * abrir la vista y el blob se libera al cerrarla: dejarlo vivo retendría en memoria cada PDF que
 * se miró durante la sesión.
 */
export function StoredFilePreview({ cargar, mimeType, nombre, alto }: StoredFilePreviewProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    let creada: string | null = null;
    setUrl(null);
    setError(null);
    cargar()
      .then((obtenida) => {
        if (!vigente) { URL.revokeObjectURL(obtenida); return; }
        creada = obtenida;
        setUrl(obtenida);
      })
      .catch((fallo: unknown) => {
        if (vigente) setError(fallo instanceof Error ? fallo.message : 'No se pudo abrir el archivo.');
      });
    return () => {
      vigente = false;
      if (creada) URL.revokeObjectURL(creada);
    };
    // `cargar` suele ser una flecha nueva en cada render; lo que decide qué archivo es, es el nombre.
  }, [nombre]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) {
    return (
      <div className="flex items-center gap-2 bg-red-50 px-3 py-3 text-[11px] text-red-700" role="alert">
        <Icon name="error" className="text-[18px]" />
        {error}
      </div>
    );
  }
  if (!url) {
    return (
      <div className="flex h-24 items-center justify-center gap-2 bg-slate-50 text-[11px] text-slate-500" role="status">
        <LoadingSpinner label="Cargando la vista previa" />
        Cargando la vista previa…
      </div>
    );
  }
  if (tipoDeVista(mimeType, nombre) === 'otro' && mimeType) {
    return (
      <div className="flex items-center gap-2 bg-slate-50 px-3 py-3 text-[11px] text-slate-600">
        <Icon name={iconoDeArchivo(mimeType, nombre)} className="text-[18px] text-slate-500" />
        Este tipo de archivo no tiene vista previa.{' '}
        <a href={url} download={nombre} className="font-bold text-[#006a61] hover:underline">Descargarlo</a>
      </div>
    );
  }
  return <FilePreview url={url} mimeType={mimeType} nombre={nombre} alto={alto} />;
}
