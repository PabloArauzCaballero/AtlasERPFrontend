'use client';

import { useMemo } from 'react';
import { qrSvg } from '@/lib/qr';

/**
 * El QR de cobro, pintado en la pantalla.
 *
 * Lo que lleva dentro es el SERIAL DEL TERMINAL, que es lo que el telefono del cliente cambia por
 * el expediente del comercio contra `merchant-qr/resolve`. No lleva el nombre del negocio ni su
 * categoria a proposito: si el QR trajera esos datos, el telefono los mostraria sin que nadie los
 * hubiera verificado, y bastaria imprimir un QR con el nombre de otro para comprar «en» ese otro.
 * Aqui viaja un identificador opaco y el nombre lo pone el servidor.
 *
 * Se genera en el navegador y no se pide al backend: es una funcion pura del serial, y hacerla
 * viajar solo anadiria una imagen que puede fallar justo cuando hay que imprimir el cartel.
 */
export function QrCanvas({ value, size = 200, className }: { value: string; size?: number; className?: string }) {
  const svg = useMemo(() => {
    try {
      // El tamano del modulo se deriva del ancho pedido para que el QR salga nitido: un SVG
      // reescalado a un ancho que no es multiplo del modulo pierde el borde de cada cuadro.
      const matriz = qrSvg(value, 8);
      return matriz;
    } catch {
      return null;
    }
  }, [value]);

  if (!svg) {
    return (
      <div
        className={className}
        style={{ width: size, height: size }}
        data-testid="qr-invalido"
      >
        <div className="grid h-full w-full place-items-center rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-center text-[10px] font-semibold text-slate-500">
          No se pudo generar el código para este terminal.
        </div>
      </div>
    );
  }

  return (
    <div
      className={className}
      style={{ width: size, height: size }}
      data-testid="qr-terminal"
      data-qr-value={value}
      // El SVG lo produce `qrSvg`, que no interpola nada del contenido: los rectangulos salen de
      // coordenadas calculadas y el texto del QR nunca entra en el marcado.
      dangerouslySetInnerHTML={{ __html: svg.replace(/width="\d+" height="\d+"/, `width="${size}" height="${size}"`) }}
    />
  );
}
