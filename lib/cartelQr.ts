import { IMPRESO } from './coloresImpresos';
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

/** La familia real de la página (Outfit cargada por `next/font`, con su nombre con huella). */
function fuenteDeLaPagina(): string {
  const familia = typeof document === 'undefined' ? '' : getComputedStyle(document.body).fontFamily;
  return familia || 'system-ui, -apple-system, "Segoe UI", sans-serif';
}

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
  return `cuotea-qr_${limpio || 'caja'}.png`;
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
  ctx.font = `${peso} ${actual}px ${fuenteDeLaPagina()}`;
  while (ctx.measureText(texto).width > ancho && actual > 28) {
    actual -= 2;
    ctx.font = `${peso} ${actual}px ${fuenteDeLaPagina()}`;
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
  ctx.font = `600 72px ${fuenteDeLaPagina()}`;
  if (ctx.measureText(texto).width <= ancho) {
    textoQueCabe(ctx, texto, y, ancho, 72, 600, IMPRESO.tinta);
    return 0;
  }
  const palabras = texto.split(/\s+/u);
  let corte = Math.ceil(palabras.length / 2);
  if (palabras.length < 2) corte = 1;
  const primera = palabras.slice(0, corte).join(' ');
  const segunda = palabras.slice(corte).join(' ');
  textoQueCabe(ctx, primera, y - 10, ancho, 56, 600, IMPRESO.tinta);
  if (segunda) textoQueCabe(ctx, segunda, y + 52, ancho, 56, 600, IMPRESO.tinta);
  return segunda ? 62 : 0;
}

const ALTO_CABECERA = 300;
/** El logo de identidad: lienzo 760 × 320 con el cuadro de la «c» (150 × 150) en (117,08, 85). */
const LOGO = { ancho: 760, alto: 320, cuadroX: 117.08, cuadroY: 85, lado: 150 } as const;
const ESCALA_LOGO = 0.9;

/**
 * Dónde se dibuja el SVG del logo para que el cuadro de la «c» quede en x = 90 y centrado en la banda
 * (y = (300 − 150 × 0,9) / 2 = 82,5), como en la app del comercio.
 */
export function planoDelLogo(): { x: number; y: number; ancho: number; alto: number } {
  const cuadroY = (ALTO_CABECERA - LOGO.lado * ESCALA_LOGO) / 2;
  return {
    x: 90 - LOGO.cuadroX * ESCALA_LOGO,
    y: cuadroY - LOGO.cuadroY * ESCALA_LOGO,
    ancho: LOGO.ancho * ESCALA_LOGO,
    alto: LOGO.alto * ESCALA_LOGO,
  };
}

/** Dibuja el cartel y lo devuelve como PNG. */
export async function dibujarCartel(datos: DatosCartel, urlLogo = '/marca/cuotea-logo-amarillo.svg'): Promise<Blob> {
  if (!datos.codigoManual) throw new Error('Esta caja todavía no tiene código manual: recarga la pantalla e inténtalo de nuevo.');
  if (typeof document !== 'undefined' && document.fonts?.ready) await document.fonts.ready.catch(() => undefined);

  const lienzo = document.createElement('canvas');
  lienzo.width = ANCHO;
  lienzo.height = ALTO;
  const ctx = lienzo.getContext('2d');
  if (!ctx) throw new Error('Este navegador no puede dibujar el cartel.');

  // Fondo blanco: un PNG transparente se imprime sobre el color del papel y deja de leerse.
  ctx.fillStyle = IMPRESO.papel;
  ctx.fillRect(0, 0, ANCHO, ALTO);

  // Cabecera con la marca: banda amarilla (el único bloque amarillo) y el logo tal cual lo entrega la
  // identidad (760 × 320), entero y sin recolorear. Mismo plano que el cartel de la app del comercio
  // (PLAN-06, fase 4): escala 0,9 y el cuadro de la «c» con su esquina en (90, 82,5), así el margen
  // libre (≥ alto de la «c») se cumple y la web y la app imprimen el mismo cartel. Sin eslogan: la
  // identidad no define ninguno.
  ctx.fillStyle = IMPRESO.amarillo;
  ctx.fillRect(0, 0, ANCHO, ALTO_CABECERA);
  const logo = await cargarImagen(urlLogo);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = IMPRESO.tinta;
  if (logo) {
    const { x, y, ancho, alto } = planoDelLogo();
    ctx.drawImage(logo, x, y, ancho, alto);
  } else {
    // Sin logo el cartel sale igual, con la marca escrita: el QR es lo que no puede faltar.
    ctx.font = `600 92px ${fuenteDeLaPagina()}`;
    ctx.fillText('Cuotea', 90, 180);
  }

  // A quién pertenece.
  const baja = nombreDelComercio(ctx, datos.comercio, 410);
  textoQueCabe(ctx, `${datos.sucursal} · ${datos.caja}`, 470 + baja, ANCHO - 160, 42, 600, IMPRESO.tintaSuave);

  // El QR, con su zona tranquila de 4 módulos: sin ella un lector pegado a un borde no lo encuentra.
  const matriz = qrMatrix(datos.serial);
  const quiet = 4;
  const modulos = matriz.length + quiet * 2;
  const modulo = Math.floor(680 / modulos);
  const lado = modulo * modulos;
  const x0 = Math.round((ANCHO - lado) / 2);
  const y0 = 530 + baja;
  const marco = 28;
  rectanguloRedondeado(ctx, x0 - marco, y0 - marco, lado + marco * 2, lado + marco * 2, 44);
  ctx.fillStyle = IMPRESO.papel;
  ctx.fill();
  rectanguloRedondeado(ctx, x0 - marco, y0 - marco, lado + marco * 2, lado + marco * 2, 44);
  ctx.lineWidth = 6;
  ctx.strokeStyle = IMPRESO.tinta;
  ctx.stroke();
  ctx.fillStyle = IMPRESO.papel;
  ctx.fillRect(x0, y0, lado, lado);
  ctx.fillStyle = IMPRESO.tinta;
  for (let fila = 0; fila < matriz.length; fila += 1) {
    for (let col = 0; col < matriz.length; col += 1) {
      if (matriz[fila]![col]) ctx.fillRect(x0 + (col + quiet) * modulo, y0 + (fila + quiet) * modulo, modulo, modulo);
    }
  }

  const finQr = y0 + lado + marco;
  ctx.fillStyle = IMPRESO.tinta;
  ctx.textAlign = 'center';
  ctx.font = `600 54px ${fuenteDeLaPagina()}`;
  ctx.fillText('Escanea con la app Cuotea', ANCHO / 2, finQr + 100);

  // El código que se teclea.
  const yCaja = finQr + 160;
  rectanguloRedondeado(ctx, 110, yCaja, ANCHO - 220, 330, 40);
  ctx.fillStyle = IMPRESO.hundido;
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = IMPRESO.bordeFuerte;
  ctx.setLineDash([18, 12]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = IMPRESO.tintaSuave;
  ctx.font = `600 36px ${fuenteDeLaPagina()}`;
  ctx.fillText('¿La cámara no lee el QR? Escribe este código en la app', ANCHO / 2, yCaja + 72);
  ctx.fillStyle = IMPRESO.tinta;
  let tamanoCodigo = 150;
  ctx.font = `600 ${tamanoCodigo}px ${MONO}`;
  while (ctx.measureText(datos.codigoManual).width > ANCHO - 320 && tamanoCodigo > 60) {
    tamanoCodigo -= 4;
    ctx.font = `600 ${tamanoCodigo}px ${MONO}`;
  }
  ctx.fillText(datos.codigoManual, ANCHO / 2, yCaja + 230);
  ctx.fillStyle = IMPRESO.tintaSuave;
  ctx.font = `500 30px ${fuenteDeLaPagina()}`;
  ctx.fillText('Escanear → Ingresar el código a mano', ANCHO / 2, yCaja + 290);

  // Pie.
  textoQueCabe(ctx, `Caja ${datos.serial}`, ALTO - 50, ANCHO - 160, 26, 500, IMPRESO.tintaSuave);

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
