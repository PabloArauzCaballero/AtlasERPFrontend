'use client';

import { useEffect, useRef } from 'react';

interface NavDrawerProps {
  open: boolean;
  onClose: () => void;
  label: string;
  children: React.ReactNode;
}

/**
 * Cajón de navegación para pantallas estrechas.
 *
 * Debajo de `lg` no cabe una columna fija de 256 px junto al contenido, y el
 * ERP resolvía eso escondiendo el menú entero: por debajo de 1024 px la consola
 * se quedaba literalmente sin forma de navegar. Éste es el menú que faltaba.
 *
 * Hace lo que un cajón modal tiene que hacer y suele faltar: cierra con Escape,
 * cierra al tocar fuera, bloquea el desplazamiento del fondo mientras está
 * abierto —si no, arrastrar dentro del menú mueve la página de detrás— y
 * devuelve el foco al botón que lo abrió.
 */
export function NavDrawer({ open, onClose, label, children }: NavDrawerProps) {
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // El primer elemento enfocable del panel, para que el teclado entre en el
    // menú en lugar de seguir en la página que hay detrás.
    panel.current?.querySelector<HTMLElement>('a, button')?.focus();
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      (opener.current as HTMLElement | null)?.focus?.();
    };
  }, [open, onClose]);

  return (
    <div
      className={`fixed inset-0 z-[60] lg:hidden ${open ? '' : 'pointer-events-none'}`}
      aria-hidden={open ? undefined : true}
    >
      <div
        className={`absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal={open ? true : undefined}
        aria-label={label}
        className={`absolute inset-y-0 left-0 flex w-[min(86vw,20rem)] flex-col border-r border-slate-200 bg-white/95 shadow-2xl backdrop-blur-xl transition-transform duration-200 ease-out ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {children}
      </div>
    </div>
  );
}
