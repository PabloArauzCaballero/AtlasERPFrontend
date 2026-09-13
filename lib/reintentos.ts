/**
 * Cuándo se repite una petición que falló porque el backend no estaba, y cuánto se espera.
 *
 * ## Por qué existe
 *
 * Cada despliegue del backend del ERP deja el API sin servir mientras Coolify cambia los contenedores:
 * para los viejos antes de levantar los nuevos, y entre medias nadie responde a `erp`. En ese hueco la
 * petición del navegador la contesta lo que hay delante: la reescritura de `next.config.ts` con un
 * `Internal Server Error` en texto plano, o Traefik con `404 page not found` si el que se despliega es
 * este portal. Medido en AtlasBackend el 2026-09-13 con el mismo mecanismo: 77 s antes de ajustar el
 * compose, 12-36 s después.
 *
 * Sin esto, las pantallas pintaban «Error HTTP 500» o «Endpoint no encontrado» —que manda a revisar
 * prefijos que están bien—. Y si el token caducaba en ese momento, el refresco fallaba y `apiRequest`
 * borraba la sesión: un despliegue sacaba al operador y al comercio del portal.
 *
 * ## Cómo se sabe que contestó la pasarela
 *
 * Por el tipo del cuerpo. El backend responde SIEMPRE los errores en JSON (`HttpExceptionFilter`,
 * global): hasta una ruta inexistente vuelve con `{ success: false, error }`. Un 404/5xx que no es JSON
 * no lo escribió el backend.
 *
 * ## Qué se repite
 *
 *  - GET: ante cualquier fallo transitorio, incluido el corte de red y el plazo agotado.
 *  - Cualquier otro método: sólo si la pasarela contestó 404/500/502/503. Nunca ante un plazo
 *    agotado, un corte o un 504: ahí la petición pudo llegar y ejecutarse sin que volviera respuesta.
 */

export const PRESUPUESTO_REINTENTOS_MS = 45_000;

const ESPERAS_MS = [1_000, 2_000, 3_000, 5_000, 8_000];

/** Dispersión de cada espera: al acabar un despliegue no vuelven todas las pestañas a la vez. */
const DISPERSION = 0.25;

const DE_PASARELA = new Set([404, 500, 502, 503, 504]);

/** Sin el 504: un plazo agotado en la pasarela no dice si el backend llegó a recibir la petición. */
const NO_LLEGO = new Set([404, 500, 502, 503]);

export type Repeticion = 'segura' | 'solo-si-no-llego';

export function repeticionDe(method: string | undefined): Repeticion {
  return (method ?? 'GET').toUpperCase() === 'GET' ? 'segura' : 'solo-si-no-llego';
}

/** La respuesta la produjo lo que está delante del backend, no el backend. */
export function esRespuestaDePasarela(response: Response): boolean {
  if (!DE_PASARELA.has(response.status)) return false;
  return !(response.headers.get('content-type') ?? '').includes('json');
}

/** Lo que devuelve un intento: la respuesta, o el fallo de transporte (sin respuesta: `status` 0). */
export type Resultado = { response: Response } | { error: unknown; sinRespuesta: boolean };

export function merecePrueba(resultado: Resultado, repeticion: Repeticion): boolean {
  if ('response' in resultado) {
    if (!esRespuestaDePasarela(resultado.response)) return false;
    return repeticion === 'segura' || NO_LLEGO.has(resultado.response.status);
  }
  return repeticion === 'segura' && resultado.sinRespuesta;
}

export function esperaAntesDelIntento(n: number, azar: () => number = Math.random): number {
  const base = ESPERAS_MS[Math.min(n - 1, ESPERAS_MS.length - 1)] as number;
  return Math.round(base * (1 - DISPERSION + azar() * DISPERSION * 2));
}

/**
 * Ejecuta `intento` y lo repite mientras el resultado lo merezca y quede presupuesto.
 *
 * Al agotarse devuelve la ÚLTIMA respuesta —o relanza el último error— para que el flujo de siempre la
 * convierta en el mensaje que la pantalla ya sabe pintar.
 */
export async function conReintentos(
  intento: () => Promise<Response>,
  opciones: {
    repeticion: Repeticion;
    esSinRespuesta: (error: unknown) => boolean;
    presupuestoMs?: number;
    ahora?: () => number;
    dormir?: (ms: number) => Promise<void>;
  },
): Promise<Response> {
  const ahora = opciones.ahora ?? Date.now;
  const dormir = opciones.dormir ?? ((ms: number) => new Promise<void>((listo) => setTimeout(listo, ms)));
  const limite = ahora() + (opciones.presupuestoMs ?? PRESUPUESTO_REINTENTOS_MS);

  for (let n = 1; ; n++) {
    let resultado: Resultado;
    try {
      resultado = { response: await intento() };
    } catch (error) {
      resultado = { error, sinRespuesta: opciones.esSinRespuesta(error) };
    }

    const espera = esperaAntesDelIntento(n);
    if (!merecePrueba(resultado, opciones.repeticion) || ahora() + espera > limite) {
      if ('response' in resultado) return resultado.response;
      throw resultado.error;
    }
    await dormir(espera);
  }
}
