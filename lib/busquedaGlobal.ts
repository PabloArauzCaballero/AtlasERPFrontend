import { TRASPASO, dejarParaLaSiguientePantalla, recogerDeLaPantallaAnterior } from '@/lib/traspasoEfimero';

/**
 * El texto de la barra superior hasta «Buscar una pantalla», sin pasar por la URL.
 *
 * Dos caminos porque hay dos situaciones: si se viene de otra pantalla, la búsqueda espera en
 * `sessionStorage` a que la pantalla nueva monte; si ya se está en ella, `router.push` a la misma
 * ruta no vuelve a montar nada y hace falta avisarla con un evento.
 */
export const RUTA_BUSQUEDA_GLOBAL = '/operaciones/admin/busqueda-global';
const EVENTO = 'atlas:busqueda-global';

export function pedirBusquedaGlobal(texto: string): void {
  dejarParaLaSiguientePantalla(TRASPASO.busquedaGlobal, texto);
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent<string>(EVENTO, { detail: texto }));
}

/** Lo que dejó la barra al navegar aquí, y lo borra. */
export function busquedaPendiente(): string {
  return recogerDeLaPantallaAnterior(TRASPASO.busquedaGlobal) ?? '';
}

/** Se suscribe a las búsquedas hechas mientras la pantalla ya está abierta. Devuelve la baja. */
export function alPedirBusquedaGlobal(manejar: (texto: string) => void): () => void {
  const oyente = (evento: Event) => {
    // Ya se entrega aquí: que no quede esperando a la próxima visita.
    recogerDeLaPantallaAnterior(TRASPASO.busquedaGlobal);
    manejar((evento as CustomEvent<string>).detail ?? '');
  };
  window.addEventListener(EVENTO, oyente);
  return () => window.removeEventListener(EVENTO, oyente);
}
