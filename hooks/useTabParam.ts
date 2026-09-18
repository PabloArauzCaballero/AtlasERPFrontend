'use client';

import { useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/**
 * La pestaña abierta, escrita en la URL (`?tab=`).
 *
 * Existe porque desde que el portal del comercio agrupa varias pantallas en una sola vista, «la
 * pestaña Sucursales» tiene que ser un sitio al que se pueda llegar: la redirección de la ruta
 * vieja, el enlace de un aviso y el recorrido de un tutorial necesitan apuntar a una pestaña
 * concreta, no a la primera. Con la pestaña sólo en el estado de React, todos esos enlaces
 * aterrizaban en la pestaña por defecto y el usuario tenía que buscar a mano lo que le habían
 * enlazado.
 *
 * Se escribe con `replace` y sin desplazar la página: cambiar de sección no es navegar a otro
 * sitio, así que no debe llenar el historial ni mover el contenido bajo el cursor. Un `?tab=` que
 * no existe cae en el de por defecto en vez de dejar la vista en blanco: la URL la escribe
 * cualquiera.
 */
export function useTabParam(fallback: string, validos: readonly string[]): [string, (id: string) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const pedida = params.get('tab') ?? '';
  const activa = validos.includes(pedida) ? pedida : fallback;

  const elegir = useCallback(
    (id: string) => {
      const siguientes = new URLSearchParams(params.toString());
      siguientes.set('tab', id);
      router.replace(`${pathname}?${siguientes.toString()}`, { scroll: false });
    },
    [params, pathname, router],
  );

  return [activa, elegir];
}
