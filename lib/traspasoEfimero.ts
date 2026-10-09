/**
 * Pasar un dato de una pantalla a la siguiente SIN ponerlo en la dirección.
 *
 * Lo que va en una URL se queda en el historial del navegador, en los registros de acceso del
 * proxy (Traefik/Coolify) y, en el App Router, también en la petición RSC que el cliente hace al
 * servidor al navegar. Para un correo o el texto de una búsqueda —que puede ser un CI o un NIT—
 * eso es guardar datos personales en sitios que nadie revisa ni borra.
 *
 * `sessionStorage` vive sólo en esta pestaña y muere con ella; además se BORRA al leerlo, así que
 * el dato existe el tiempo justo de cruzar de una pantalla a otra. Si el almacenamiento no está
 * (navegación privada estricta, cuota), se pierde la comodidad del prellenado y nada más: ninguna
 * pantalla depende de esto para funcionar.
 */
const PREFIJO = 'atlas:traspaso:';

export function dejarParaLaSiguientePantalla(clave: string, valor: string): void {
  try {
    if (valor) window.sessionStorage.setItem(PREFIJO + clave, valor);
    else window.sessionStorage.removeItem(PREFIJO + clave);
  } catch {
    // Sin almacenamiento sólo se pierde el prellenado.
  }
}

/** Devuelve el valor y lo borra: un segundo intento ya no lo encuentra. */
export function recogerDeLaPantallaAnterior(clave: string): string | null {
  try {
    const valor = window.sessionStorage.getItem(PREFIJO + clave);
    window.sessionStorage.removeItem(PREFIJO + clave);
    return valor;
  } catch {
    return null;
  }
}

/** Las claves en uso, juntas para que dos pantallas no pisen la misma por accidente. */
export const TRASPASO = {
  /** Login → recuperar acceso: el correo ya escrito. */
  correoARecuperar: 'correo-a-recuperar',
  /** Barra superior → «Buscar una pantalla»: lo que se tecleó. */
  busquedaGlobal: 'busqueda-global',
  /** Cierre por inactividad → login: para decir por qué se volvió a pedir la contraseña. */
  cierrePorInactividad: 'cierre-por-inactividad',
} as const;
