'use client';

import { useEffect, useRef } from 'react';
import { crearSondeo, INTERVALO_SONDEO_MS } from '@/lib/sondeo';

/**
 * `crearSondeo` atado al ciclo de vida del componente y a la visibilidad de la pestaña.
 *
 * Mientras la pestaña está a la vista, `consultar` corre cada `intervaloMs`; escondida, se para; al
 * volver, consulta enseguida. Si `consultar` lanza, el siguiente intento espera el doble. Se apaga
 * al desmontar o cuando `activo` pasa a falso (p. ej. todavía no se sabe qué comercio es).
 *
 * `consultar` puede cambiar en cada render: se lee de una referencia, así que el sondeo no se
 * reinicia por eso (reiniciarlo en cada render lo convertiría en un bucle).
 */
export function useSondeo(
  consultar: () => Promise<unknown>,
  { activo = true, intervaloMs = INTERVALO_SONDEO_MS }: { activo?: boolean; intervaloMs?: number } = {},
): void {
  const ultima = useRef(consultar);
  ultima.current = consultar;

  useEffect(() => {
    if (!activo || typeof document === 'undefined') return;
    const sondeo = crearSondeo({
      consultar: () => ultima.current(),
      estaVisible: () => document.visibilityState === 'visible',
      alCambiarVisibilidad: (avisar) => {
        document.addEventListener('visibilitychange', avisar);
        return () => document.removeEventListener('visibilitychange', avisar);
      },
      intervaloMs,
    });
    return () => sondeo.detener();
  }, [activo, intervaloMs]);
}
