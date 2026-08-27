/**
 * ¿La imagen que el comercio eligió lleva de verdad un código QR?
 *
 * Quien MANDA es el servidor: el registro del QR decodifica la imagen y rechaza la que no lleva
 * código (`QR_IMAGE_HAS_NO_CODE`). Esto no lo sustituye —un navegador se puede saltar— sino que
 * adelanta la respuesta: sin esta comprobación, subir la foto equivocada cuesta un viaje completo
 * de subida al almacenamiento antes de recibir el rechazo, y por el camino queda un objeto huérfano
 * que nadie va a usar.
 *
 * Se apoya en `BarcodeDetector`, que trae el propio navegador (Chrome, Edge). Donde no exista, esto
 * responde «no se pudo comprobar» y NO bloquea: el que decide sigue siendo el servidor, y una
 * comprobación que no se puede hacer no debe convertirse en una puerta cerrada.
 */

export type ComprobacionQr = 'con-codigo' | 'sin-codigo' | 'no-se-pudo-comprobar';

interface DetectorDeCodigos {
  detect(origen: ImageBitmapSource): Promise<Array<{ rawValue: string }>>;
}

interface ConstructorDeDetector {
  new (opciones?: { formats?: string[] }): DetectorDeCodigos;
  getSupportedFormats?: () => Promise<string[]>;
}

function detectorDisponible(): ConstructorDeDetector | null {
  if (typeof window === 'undefined') return null;
  const candidato = (window as unknown as { BarcodeDetector?: ConstructorDeDetector }).BarcodeDetector;
  return typeof candidato === 'function' ? candidato : null;
}

export async function imagenTieneQr(file: File): Promise<ComprobacionQr> {
  const Detector = detectorDisponible();
  if (!Detector || typeof createImageBitmap !== 'function') return 'no-se-pudo-comprobar';

  try {
    if (Detector.getSupportedFormats) {
      const formatos = await Detector.getSupportedFormats();
      if (!formatos.includes('qr_code')) return 'no-se-pudo-comprobar';
    }
    const bitmap = await createImageBitmap(file);
    try {
      const encontrados = await new Detector({ formats: ['qr_code'] }).detect(bitmap);
      return encontrados.length > 0 ? 'con-codigo' : 'sin-codigo';
    } finally {
      bitmap.close();
    }
  } catch {
    // Un fallo del detector no es un veredicto: se deja pasar y responde el servidor.
    return 'no-se-pudo-comprobar';
  }
}

/** El mismo texto en las dos pantallas que suben QR, para que el comercio lea siempre lo mismo. */
export const AVISO_SIN_QR =
  'Esa imagen no contiene ningún código QR. Sube la imagen del código que te dio tu banco, no una foto del local ni una captura de la pantalla.';
