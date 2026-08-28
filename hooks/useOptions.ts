'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from '@/lib/toast';
import type { Option } from '@/services/optionLoaders';

/**
 * Lo que devuelve el hook: la lista de siempre, más por qué está vacía cuando lo está.
 *
 * Es un array de verdad —los 24 sitios que hacen `...opciones` siguen funcionando sin tocarse—
 * con dos campos colgados: `loadError`, para que una pantalla pueda pintar el motivo junto al
 * campo, y `retry`, para volver a pedirlas sin recargar la página. Se eligió así, y no un objeto
 * `{ options, error }`, porque cambiar la forma obligaba a editar 24 llamadas para arreglar un
 * fallo que está en UNA: el resultado habría sido más churn y la misma corrección.
 */
export type OptionsResult = Option[] & {
  /** Mensaje del fallo, o `null` si la carga fue bien. Vacío + `null` significa catálogo vacío de verdad. */
  loadError: string | null;
  /** Reintenta la carga. */
  retry: () => void;
};

function build(options: Option[], loadError: string | null, retry: () => void): OptionsResult {
  return Object.assign([...options], { loadError, retry });
}

/**
 * Carga opciones {label,value} desde un loader (para selects de UUID).
 *
 * ## Por qué el fallo ya no se traga
 *
 * Antes esto terminaba en `.catch(() => {})` con el comentario «select queda vacío si falla la
 * carga», y ese comentario describía exactamente el defecto: un desplegable OBLIGATORIO vacío es
 * indistinguible de un catálogo que legítimamente no tiene elementos. Quien rellenaba el
 * formulario no podía enviarlo, no sabía por qué, no podía reintentar, y lo más probable es que
 * concluyera que había que dar de alta antes la entidad del catálogo —que suele existir—.
 *
 * Ahora un fallo avisa por notificación (feedback inmediato, sin depender de que la pantalla se
 * haya acordado de pintarlo) y queda disponible en `loadError` para las pantallas que quieran
 * mostrarlo junto al campo.
 */
export function useOptions(loader: () => Promise<Option[]>): OptionsResult {
  const [options, setOptions] = useState<Option[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  // El contador descarta respuestas de una carga anterior: sin él, un reintento rápido puede
  // recibir antes la respuesta vieja y dejar en pantalla las opciones que ya se descartaron.
  const requestIdRef = useRef(0);

  const load = useCallback(() => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setLoadError(null);
    loader()
      .then((result) => {
        if (requestIdRef.current !== requestId) return;
        setOptions(result);
      })
      .catch((error: unknown) => {
        if (requestIdRef.current !== requestId) return;
        const message = error instanceof Error ? error.message : 'No se pudo contactar el servidor.';
        setOptions([]);
        setLoadError(message);
        toast.error('No se pudieron cargar las opciones', message);
      });
    // El loader se recibe como prop y rara vez es estable entre renders; la carga la gobierna el
    // efecto de abajo (una vez al montar) y este `retry`, no la identidad de la función.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
    return () => { requestIdRef.current += 1; };
  }, [load]);

  return build(options, loadError, load);
}
