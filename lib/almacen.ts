/**
 * La subida de un archivo al almacén (MinIO) con el permiso firmado que emite AtlasBackend.
 *
 * ## Por qué el navegador ya no va DIRECTO al almacén
 *
 * El permiso trae la dirección PÚBLICA del almacén, y esa dirección es de otro origen. El
 * 2026-09-26 el ERP de TEST se servía por `https://atlas.erp.test.arauzsoftware.com` y el permiso
 * apuntaba a `http://minio.161.97.85.216.sslip.io`: el navegador bloqueó el PUT por contenido mixto
 * («Mixed Content … must be served over HTTPS») y NINGÚN documento se podía subir. Aunque hubiera
 * sido https, `*.sslip.io` lo bloquea el filtro web de la red de Pablo.
 *
 * Cada una de esas cosas es configuración de un entorno —esquema, dominio, certificado, filtro— y
 * basta con que una no case con la del portal para que vuelva a pasar. Por eso el navegador habla
 * SÓLO con este mismo origen (`/almacen/subida`, `app/almacen/subida/route.ts`) y el salto al
 * almacén lo da el servidor de Next, donde ni el contenido mixto ni el filtro existen.
 *
 * Sigue sin llevar la sesión del ERP: el reenvío copia sólo las cabeceras que firma el permiso.
 */
import { conReintentos } from './reintentos';

export const RUTA_SUBIDA_AL_ALMACEN = '/almacen/subida';
export const CABECERA_DESTINO = 'x-almacen-destino';

export interface PermisoDeSubida {
  uploadUrl: string;
  method: 'PUT';
  requiredHeaders: Record<string, string>;
}

export async function subirAlAlmacen(permiso: PermisoDeSubida, file: File): Promise<void> {
  // Repetible: un PUT a la misma URL firmada deja el mismo objeto, y el almacén se despliega junto a
  // AtlasBackend, así que puede no estar unos segundos. Ver `lib/reintentos.ts`. Un error del propio
  // almacén (XML, p. ej. la firma vencida) no es de pasarela y no se repite.
  const response = await conReintentos(
    () =>
      fetch(RUTA_SUBIDA_AL_ALMACEN, {
        method: permiso.method,
        headers: { ...permiso.requiredHeaders, [CABECERA_DESTINO]: permiso.uploadUrl },
        body: file,
      }),
    { repeticion: 'segura', esSinRespuesta: (error) => error instanceof TypeError },
  );
  if (!response.ok) {
    throw new Error(`El almacenamiento rechazó la subida del archivo (${response.status}).`);
  }
}
