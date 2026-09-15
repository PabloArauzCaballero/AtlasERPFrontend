'use client';

import { useEffect, useState } from 'react';
import { AtlasButton } from './AtlasButton';
import { FormField } from './FormField';
import { Icon } from './Icon';
import {
  activarTranscripcion,
  alCambiarTranscripcion,
  desactivarTranscripcion,
  normalizarSerie,
  transcripcionActiva,
  type Transcripcion,
} from '@/lib/transcripcion';

function useTranscripcion(): Transcripcion | null {
  const [estado, setEstado] = useState<Transcripcion | null>(null);
  useEffect(() => {
    setEstado(transcripcionActiva());
    return alCambiarTranscripcion(() => setEstado(transcripcionActiva()));
  }, []);
  return estado;
}

/**
 * La chapa de la barra superior: mientras se transcribe un papel, se ve en TODAS las pantallas.
 *
 * Quien pasa treinta papeles seguidos no puede tener que acordarse de si el modo sigue activo; y
 * quien se sienta después en el mismo navegador tiene que ver que lo está antes de teclear nada.
 */
export function TranscripcionChapa() {
  const activa = useTranscripcion();
  if (!activa) return null;
  return (
    <button
      type="button"
      onClick={desactivarTranscripcion}
      title="Estás transcribiendo un papel. Pulsa para salir del modo."
      className="hidden h-9 items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 text-xs font-bold text-amber-800 hover:bg-amber-100 md:flex"
      data-testid="transcripcion-chapa"
    >
      <Icon name="print" className="text-[17px]" />
      Papel {activa.serial}
      <Icon name="close" className="text-[15px]" />
    </button>
  );
}

/** El panel para activar el modo: pide la serie del papel y, si se conoce, el código del formulario. */
export function TranscripcionPanel() {
  const activa = useTranscripcion();
  const [error, setError] = useState<string | null>(null);

  function activar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const datos = new FormData(event.currentTarget);
    const serial = normalizarSerie(String(datos.get('serial') ?? ''));
    if (!serial) {
      setError('El número de serie está al pie de cada página del formulario: «DOC-» y doce letras o números.');
      return;
    }
    const form = String(datos.get('form') ?? '').trim().toUpperCase();
    const [formCode, formVersion] = form.split('@');
    setError(null);
    activarTranscripcion({ serial, ...(formCode ? { formCode } : {}), ...(formVersion ? { formVersion } : {}) });
  }

  if (activa) {
    return (
      <div className="flex flex-col gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm sm:flex-row sm:items-center sm:justify-between" data-testid="transcripcion-activa">
        <div>
          <p className="font-bold text-amber-900">Estás transcribiendo el papel {activa.serial}</p>
          <p className="text-xs text-amber-800">
            {activa.formCode ? `Formulario ${activa.formCode}${activa.formVersion ? ` · versión ${activa.formVersion}` : ''}. ` : ''}
            Todo lo que guardes ahora queda marcado como nacido en papel. Desactívalo al terminar.
          </p>
        </div>
        <AtlasButton variant="secondary" icon="close" onClick={desactivarTranscripcion} data-testid="transcripcion-desactivar">Terminar</AtlasButton>
      </div>
    );
  }

  return (
    <form onSubmit={activar} className="grid gap-3 rounded-md border border-slate-200 bg-white p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end" data-testid="transcripcion-form">
      <FormField label="Estoy transcribiendo un papel · número de serie" name="serial" placeholder="DOC-4F3A9C2E7B10" required hint="Está al pie de cada página del formulario impreso." />
      <FormField label="Código del formulario (opcional)" name="form" placeholder="ERP-CRM-CUENTA-CREAR@a91f3c2e" hint="Aparece en la cabecera del papel, con su versión." />
      <AtlasButton type="submit" icon="print" data-testid="transcripcion-activar">Activar</AtlasButton>
      {error ? <p className="text-xs text-red-700 md:col-span-3">{error}</p> : null}
    </form>
  );
}
