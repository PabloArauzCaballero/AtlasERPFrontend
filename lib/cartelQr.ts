import { qrMatrix } from '@/lib/qr';

/**
 * El cartel de una caja: lo que el comercio imprime y pega en el mostrador.
 *
 * Lleva tres cosas y las tres son la misma caja: el QR (que la cámara de la app lee), el código
 * corto debajo (que se teclea cuando la cámara no puede: reflejo, cartel gastado, cámara sin permiso)
 * y el nombre del local y de la caja, para que quien lo pega sepa en qué mostrador va. Un QR suelto
 * obligaba a adivinar cuál era de cuál.
 *
 * Se dibuja en un `<canvas>` en el navegador y no se pide al backend, por la misma razón que el QR:
 * es una función pura de sus datos, y un cartel que dependa de la red puede fallar justo cuando hay
 * que imprimirlo. El contenido del QR sigue siendo el serial —lo ya impreso no se invalida—.
 */

export interface DatosCartel {
  /** Lo que lleva el QR: el serial de la caja. */
  serial: string;
  /** El código que se teclea, ya con su guion (`K7M2-9QXD`). Sin él no se puede imprimir el cartel. */
  codigoManual: string;
  /** Nombre de fachada del comercio. */
  comercio: string;
  sucursal: string;
  caja: string;
}

const ANCHO = 1200;
const ALTO = 1900;

/* Los colores del logo y del portal: el azul noche del icono, su verde menta y el verde azulado del acento. */
const NOCHE = '#06121f';
const MENTA = '#2ee6b0';
const ACENTO = '#006a61';
const LAVADO = '#f0f8f7';
const TINTA = '#1d1d1f';
const TENUE = '#5a5a63';

const FUENTE = 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif';
const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';

/** Un nombre de archivo que cualquier sistema acepte: sin tildes, sin espacios, sin signos. */
export function nombreArchivoCartel(datos: Pick<DatosCartel, 'comercio' | 'sucursal' | 'caja'>): string {
  const limpio = [datos.comercio, datos.sucursal, datos.caja]
    .map((parte) =>
      parte
        .normalize('NFD')
        .replace(/[̀-ͯ]/gu, '')
        .replace(/[^A-Za-z0-9]+/gu, '-')
        .replace(/^-+|-+$/gu, ''),
    )
    .filter(Boolean)
    .join('_');
  return `atlas-qr_${limpio || 'caja'}.png`;
}

function cargarImagen(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolver) => {
    const imagen = new Image();
    imagen.onload = () => resolver(imagen);
    // Sin logo el cartel sale igual, con la marca escrita: el QR es lo que no puede faltar.
    imagen.onerror = () => resolver(null);
    imagen.src = url;
  });
}

function rectanguloRedondeado(ctx: CanvasRenderingContext2D, x: number, y: number, ancho: number, alto: number, radio: number) {
  ctx.beginPath();
  ctx.moveTo(x + radio, y);
  ctx.arcTo(x + ancho, y, x + ancho, y + alto, radio);
  ctx.arcTo(x + ancho, y + alto, x, y + alto, radio);
  ctx.arcTo(x, y + alto, x, y, radio);
  ctx.arcTo(x, y, x + ancho, y, radio);
  ctx.closePath();
}

/** Texto centrado que encoge hasta caber: un nombre de comercio largo no puede salirse del cartel. */
function textoQueCabe(ctx: CanvasRenderingContext2D, texto: string, y: number, maximo: number, tamano: number, peso: number, color: string, ancho = ANCHO - 160) {
  let actual = tamano;
  ctx.font = `${peso} ${actual}px ${FUENTE}`;
  while (ctx.measureText(texto).width > ancho && actual > 28) {
    actual -= 2;
    ctx.font = `${peso} ${actual}px ${FUENTE}`;
  }
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  let mostrado = texto;
  while (ctx.measureText(mostrado).width > ancho && mostrado.length > 4) mostrado = `${mostrado.slice(0, -2)}…`;
  ctx.fillText(mostrado, ANCHO / 2, y, maximo);
}

/**
 * El nombre del comercio en una o dos líneas, sin cortarlo con puntos suspensivos: una razón social
 * larga se parte por palabras en la mitad y cada línea encoge hasta caber. Devuelve cuánto bajó el
 * resto del cartel.
 */
function nombreDelComercio(ctx: CanvasRenderingContext2D, texto: string, y: number): number {
  const ancho = ANCHO - 160;
  ctx.font = `800 72px ${FUENTE}`;
  if (ctx.measureText(texto).width <= ancho) {
    textoQueCabe(ctx, texto, y, ancho, 72, 800, TINTA);
    return 0;
  }
  const palabras = texto.split(/\s+/u);
  let corte = Math.ceil(palabras.length / 2);
  if (palabras.length < 2) corte = 1;
  const primera = palabras.slice(0, corte).join(' ');
  const segunda = palabras.slice(corte).join(' ');
  textoQueCabe(ctx, primera, y - 10, ancho, 56, 800, TINTA);
  if (segunda) textoQueCabe(ctx, segunda, y + 52, ancho, 56, 800, TINTA);
  return segunda ? 62 : 0;
}

/** Dibuja el cartel y lo devuelve como PNG. */
export async function dibujarCartel(datos: DatosCartel, urlLogo = '/logo.png'): Promise<Blob> {
  if (!datos.codigoManual) throw new Error('Esta caja todavía no tiene código manual: recarga la pantalla e inténtalo de nuevo.');
  if (typeof document !== 'undefined' && document.fonts?.ready) await document.fonts.ready.catch(() => undefined);

  const lienzo = document.createElement('canvas');
  lienzo.width = ANCHO;
  lienzo.height = ALTO;
  const ctx = lienzo.getContext('2d');
  if (!ctx) throw new Error('Este navegador no puede dibujar el cartel.');

  // Fondo blanco: un PNG transparente se imprime sobre el color del papel y deja de leerse.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, ANCHO, ALTO);

  // Cabecera con la marca.
  ctx.fillStyle = NOCHE;
  ctx.fillRect(0, 0, ANCHO, 300);
  const logo = await cargarImagen(urlLogo);
  if (logo) {
    ctx.save();
    rectanguloRedondeado(ctx, 90, 70, 160, 160, 36);
    ctx.clip();
    ctx.drawImage(logo, 90, 70, 160, 160);
    ctx.restore();
  }
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ffffff';
  ctx.font = `800 92px ${FUENTE}`;
  ctx.fillText('ATLAS', logo ? 290 : 90, 160);
  ctx.fillStyle = MENTA;
  ctx.font = `600 38px ${FUENTE}`;
  ctx.fillText('Compra ahora, paga en cuotas', logo ? 292 : 92, 216);
  // Filete de acento bajo la cabecera.
  ctx.fillStyle = MENTA;
  ctx.fillRect(0, 300, ANCHO, 10);

  // A quién pertenece.
  const baja = nombreDelComercio(ctx, datos.comercio, 410);
  textoQueCabe(ctx, `${datos.sucursal} · ${datos.caja}`, 470 + baja, ANCHO - 160, 42, 600, TENUE);

  // El QR, con su zona tranquila de 4 módulos: sin ella un lector pegado a un borde no lo encuentra.
  const matriz = qrMatrix(datos.serial);
  const quiet = 4;
  const modulos = matriz.length + quiet * 2;
  const modulo = Math.floor(680 / modulos);
  const lado = modulo * modulos;
  const x0 = Math.round((ANCHO - lado) / 2);
  const y0 = 530 + baja;
  const marco = 28;
  ctx.save();
  ctx.shadowColor = 'rgba(6,18,31,0.16)';
  ctx.shadowBlur = 36;
  ctx.shadowOffsetY = 12;
  rectanguloRedondeado(ctx, x0 - marco, y0 - marco, lado + marco * 2, lado + marco * 2, 44);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.restore();
  rectanguloRedondeado(ctx, x0 - marco, y0 - marco, lado + marco * 2, lado + marco * 2, 44);
  ctx.lineWidth = 6;
  ctx.strokeStyle = ACENTO;
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x0, y0, lado, lado);
  ctx.fillStyle = '#0f172a';
  for (let fila = 0; fila < matriz.length; fila += 1) {
    for (let col = 0; col < matriz.length; col += 1) {
      if (matriz[fila]![col]) ctx.fillRect(x0 + (col + quiet) * modulo, y0 + (fila + quiet) * modulo, modulo, modulo);
    }
  }

  const finQr = y0 + lado + marco;
  ctx.fillStyle = TINTA;
  ctx.textAlign = 'center';
  ctx.font = `800 54px ${FUENTE}`;
  ctx.fillText('Escanea con la app Atlas', ANCHO / 2, finQr + 100);

  // El código que se teclea.
  const yCaja = finQr + 160;
  rectanguloRedondeado(ctx, 110, yCaja, ANCHO - 220, 330, 40);
  ctx.fillStyle = LAVADO;
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = ACENTO;
  ctx.setLineDash([18, 12]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = TENUE;
  ctx.font = `600 36px ${FUENTE}`;
  ctx.fillText('¿La cámara no lee el QR? Escribe este código en la app', ANCHO / 2, yCaja + 72);
  ctx.fillStyle = ACENTO;
  let tamanoCodigo = 150;
  ctx.font = `800 ${tamanoCodigo}px ${MONO}`;
  while (ctx.measureText(datos.codigoManual).width > ANCHO - 320 && tamanoCodigo > 60) {
    tamanoCodigo -= 4;
    ctx.font = `800 ${tamanoCodigo}px ${MONO}`;
  }
  ctx.fillText(datos.codigoManual, ANCHO / 2, yCaja + 230);
  ctx.fillStyle = TENUE;
  ctx.font = `500 30px ${FUENTE}`;
  ctx.fillText('Escanear → Ingresar el código a mano', ANCHO / 2, yCaja + 290);

  // Pie.
  textoQueCabe(ctx, `Caja ${datos.serial}`, ALTO - 50, ANCHO - 160, 26, 500, TENUE);

  return new Promise<Blob>((resolver, rechazar) => {
    lienzo.toBlob((blob) => (blob ? resolver(blob) : rechazar(new Error('No se pudo generar la imagen del cartel.'))), 'image/png');
  });
}

/** Dibuja el cartel y lo entrega al navegador como descarga. */
export async function descargarCartel(datos: DatosCartel): Promise<void> {
  const blob = await dibujarCartel(datos);
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombreArchivoCartel(datos);
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  // Revocar en el mismo ciclo puede cortar la descarga en algunos navegadores.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
