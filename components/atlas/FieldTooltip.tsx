'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@/components/atlas/Icon';

/**
 * La burbuja de ayuda de un campo: qué poner y por qué importa.
 *
 * Se abre al pasar el ratón por el icono ⓘ, al enfocarlo con el teclado y —vía `useFieldHelp`—
 * al enfocar el propio control. Se cierra al salir, al perder el foco y con Escape sin mover el
 * ratón (WCAG 1.4.13). Va en un portal con posición fija, así que no la recorta ningún `overflow`
 * ni la tapa un modal (`z-[130]` > `z-[120]` del `Modal`).
 *
 * El texto también vive en un `<span>` visualmente oculto al que apunta el `aria-describedby` del
 * control, así que el lector de pantalla lo lee aunque la burbuja esté cerrada. El botón NO va
 * dentro de la `<label>` del campo, y su nombre accesible sale de `title`, no de `aria-label`:
 * `getByLabel('Ciudad')` busca por `aria-label` y encontraría el botón «Ayuda: Ciudad» además del
 * control (medido: rompía `partner-dossier.spec.ts`).
 */

const GAP = 6;
const EDGE = 8;
const MAX_WIDTH = 288;

interface Position {
  top: number;
  left: number;
  placement: 'above' | 'below';
}

function positionFor(anchor: DOMRect, bubble: DOMRect): Position {
  const width = Math.min(MAX_WIDTH, window.innerWidth - EDGE * 2);
  let left = anchor.left + anchor.width / 2 - width / 2;
  left = Math.max(EDGE, Math.min(left, window.innerWidth - width - EDGE));
  const above = anchor.top - GAP - bubble.height;
  if (above >= EDGE) return { top: above, left, placement: 'above' };
  return { top: anchor.bottom + GAP, left, placement: 'below' };
}

interface FieldTooltipProps {
  /** El texto de ayuda. Sin él no se pinta nada. */
  text: string;
  /** Etiqueta del campo, para el nombre accesible del botón («Ayuda: Moneda»). */
  label: string;
  /** `id` del `<span>` oculto con el texto; el control lo referencia con `aria-describedby`. */
  describedById: string;
  /** Se abre también desde fuera (el control enfocado). */
  forceOpen?: boolean | undefined;
}

export function FieldTooltip(props: FieldTooltipProps) {
  const [hover, setHover] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const bubbleId = useId();
  const open = hover || Boolean(props.forceOpen);

  const place = useCallback(() => {
    const anchor = buttonRef.current?.getBoundingClientRect();
    const bubble = bubbleRef.current?.getBoundingClientRect();
    if (anchor && bubble) setPosition(positionFor(anchor, bubble));
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setHover(false);
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        title={`Ayuda: ${props.label}`}
        aria-describedby={bubbleId}
        data-testid="ayuda-campo"
        className="ml-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-[#006a61] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#006a61]/40"
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onFocus={() => setHover(true)}
        onBlur={() => setHover(false)}
        onClick={() => setHover((current) => !current)}
      >
        <Icon name="info" className="text-[16px]" />
      </button>
      <span id={props.describedById} className="sr-only">
        {props.text}
      </span>
      {open && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={bubbleRef}
              id={bubbleId}
              role="tooltip"
              data-placement={position?.placement ?? 'above'}
              style={{
                position: 'fixed',
                top: position?.top ?? -9999,
                left: position?.left ?? -9999,
                width: Math.min(MAX_WIDTH, typeof window !== 'undefined' ? window.innerWidth - EDGE * 2 : MAX_WIDTH),
              }}
              className="pointer-events-none z-[130] rounded-md bg-slate-900 px-3 py-2 text-xs leading-relaxed text-white shadow-lg"
            >
              {props.text}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

/**
 * Estado compartido entre la etiqueta y el control: el `id` del texto oculto y si el control
 * tiene el foco (para abrir la burbuja al entrar con el teclado).
 */
export function useFieldHelp(tooltip: string | undefined) {
  const id = useId();
  const [focused, setFocused] = useState(false);
  return {
    describedById: tooltip ? `${id}-ayuda` : undefined,
    focused,
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
  };
}
