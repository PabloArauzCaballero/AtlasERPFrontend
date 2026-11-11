/**
 * Recibe los errores del navegador (`lib/erroresCliente.ts`) y los reenvía al núcleo.
 *
 * Por qué una ruta del propio portal: el navegador no puede llamar al núcleo (la CSP sólo deja
 * `connect-src 'self'` y la API del ERP, CORS, y el filtro web de la red de Pablo). Igual que
 * `/almacen/subida`, el navegador habla con ESTE origen y el servidor de Next da el salto.
 *
 * No exige sesión a propósito: un error en la pantalla de login también tiene que llegar. Por eso
 * el único freno es este archivo:
 *  - Sólo JSON de hasta 16 KB (413 si es más); tipos y tamaños del contrato (400 si no).
 *  - `surface` y `release` los fija el SERVIDOR; lo que diga el cliente no cuenta. `route` se recorta
 *    al pathname (sin query ni hash).
 *  - Límite en memoria por IP: 30 por minuto (429).
 *  - Al núcleo va SÓLO el JSON validado: ni cookies, ni Authorization, ni cabeceras del cliente. El
 *    destino sale de `CLIENT_ERRORS_FORWARD_URL` (servidor, en tiempo de ejecución) o del alias del
 *    núcleo en la red compartida `coolify`.
 *  - Plazo de 3 s. Si el núcleo no responde, 202 igual: el capturador no reintenta.
 */
import {
  DESTINO_POR_DEFECTO,
  PLAZO_MS,
  TAMANO_MAXIMO,
  excedeLimite,
  ipDe,
  leerConTope,
  respuesta,
  validar,
} from '@/lib/reenvioErroresCliente';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  if (excedeLimite(ipDe(request))) return respuesta(429, { error: { message: 'Demasiados reportes.' } });

  const declarado = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(declarado) && declarado > TAMANO_MAXIMO) return respuesta(413, { error: { message: 'Reporte demasiado grande.' } });
  const texto = await leerConTope(request.body, TAMANO_MAXIMO).catch(() => '');
  if (texto === null) return respuesta(413, { error: { message: 'Reporte demasiado grande.' } });

  let crudo: unknown;
  try {
    crudo = JSON.parse(texto);
  } catch {
    return respuesta(400, { error: { message: 'Reporte fuera de contrato.' } });
  }
  const reporte = validar(crudo);
  if (!reporte) return respuesta(400, { error: { message: 'Reporte fuera de contrato.' } });

  const destino = process.env.CLIENT_ERRORS_FORWARD_URL?.trim() || DESTINO_POR_DEFECTO;
  try {
    const r = await fetch(destino, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(reporte),
      redirect: 'manual',
      cache: 'no-store',
      signal: AbortSignal.timeout(PLAZO_MS),
    });
    await r.body?.cancel().catch(() => undefined);
  } catch {
    // El núcleo caído o lento no es asunto del navegador: 202 igual, sin reintento.
  }
  return respuesta(202);
}
