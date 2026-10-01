'use client';

import { useRef } from 'react';
import { AtlasButton } from '@/components/atlas/AtlasButton';
import { Icon } from '@/components/atlas/Icon';
import { contentTypeDeArchivo } from '@/services/filesService';

const TAMANO_MAXIMO = 15 * 1024 * 1024;

/** Valida PDF/JPEG/PNG de hasta 15 MB; devuelve el motivo si no sirve. */
export function motivoDeRechazo(file: File): string | null {
  if (!contentTypeDeArchivo(file)) return 'Sólo se admiten PDF, JPEG o PNG.';
  if (file.size > TAMANO_MAXIMO) return `Pesa ${(file.size / (1024 * 1024)).toFixed(1)} MB; el máximo es 15 MB.`;
  return null;
}

/**
 * El archivo de UN requisito, elegido al abrir el caso. No sube nada: el caso aún no existe, y el
 * archivo cuelga de él. La pantalla lo sube cuando el caso ya está creado.
 */
export function RequisitoArchivoCampo({
  archivo,
  error,
  disabled,
  label,
  onChange,
}: Readonly<{ archivo: File | null; error?: string | null; disabled?: boolean; label: string; onChange: (file: File | null, error: string | null) => void }>) {
  const entrada = useRef<HTMLInputElement>(null);
  return (
    <div className="min-w-0">
      <input
        ref={entrada}
        type="file"
        accept="application/pdf,image/png,image/jpeg"
        className="sr-only"
        tabIndex={-1}
        aria-label={label}
        data-testid="requisito-archivo"
        disabled={disabled}
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null;
          if (!file) return onChange(null, null);
          const motivo = motivoDeRechazo(file);
          if (motivo) { event.target.value = ''; return onChange(null, motivo); }
          onChange(file, null);
        }}
      />
      <div className="flex min-h-9 flex-wrap items-center gap-2">
        <Icon name={archivo ? (archivo.type === 'application/pdf' ? 'picture_as_pdf' : 'image') : 'attach_file'} className={`text-[18px] ${archivo ? 'text-slate-700' : 'text-slate-400'}`} />
        <span className={`min-w-0 flex-1 truncate text-xs ${archivo ? 'font-bold text-slate-800' : 'text-slate-500'}`} title={archivo?.name}>
          {archivo ? archivo.name : 'Sin archivo todavía (PDF, JPEG o PNG, hasta 15 MB)'}
        </span>
        <AtlasButton variant="secondary" icon={archivo ? 'swap_horiz' : 'folder_open'} disabled={disabled} onClick={() => entrada.current?.click()}>
          {archivo ? 'Cambiar' : 'Adjuntar archivo'}
        </AtlasButton>
        {archivo ? (
          <button type="button" className="grid h-9 w-9 place-items-center rounded text-slate-500 hover:bg-slate-100" disabled={disabled} aria-label={`Quitar el archivo: ${label}`} onClick={() => { if (entrada.current) entrada.current.value = ''; onChange(null, null); }}>
            <Icon name="close" className="text-[18px]" />
          </button>
        ) : null}
      </div>
      {error ? <p className="mt-1 text-[11px] text-red-700" role="alert">{error}</p> : null}
    </div>
  );
}
