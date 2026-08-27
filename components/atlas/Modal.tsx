'use client';

import { useEffect } from 'react';
import { Icon } from './Icon';

interface ModalProps {
  open: boolean;
  title: string;
  description?: string | undefined;
  icon?: string | undefined;
  /** `lg` para formularios de varias columnas; `md` para tres o cuatro campos. */
  width?: 'md' | 'lg' | undefined;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode | undefined;
}

/**
 * Ventana modal genérica para formularios.
 *
 * `ConfirmDialog` sólo sabe preguntar sí/no. Crear y editar necesitan campos dentro, y hacerlo en
 * un panel que empuja la tabla hacia abajo obliga a perder de vista la fila que se está tocando:
 * el modal deja la tabla donde está y devuelve al mismo sitio al cerrarse.
 */
export function Modal(props: ModalProps) {
  const { open, onClose } = props;
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = previous; };
  }, [open, onClose]);

  if (!open) return null;
  const width = props.width === 'md' ? 'w-[min(94vw,560px)]' : 'w-[min(94vw,860px)]';

  return (
    <div className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto p-4 sm:items-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]" onClick={onClose} />
      <div className={`relative my-auto ${width} rounded-xl border border-slate-200 bg-white shadow-2xl`}>
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            {props.icon ? (
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 text-slate-700">
                <Icon name={props.icon} className="text-[19px]" />
              </span>
            ) : null}
            <div className="min-w-0">
              <h2 className="truncate text-sm font-bold text-slate-900">{props.title}</h2>
              {props.description ? <p className="mt-0.5 text-xs text-slate-500">{props.description}</p> : null}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800">
            <Icon name="close" className="text-[18px]" />
          </button>
        </header>
        <div className="px-5 py-4">{props.children}</div>
        {props.footer ? <footer className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50/60 px-5 py-3">{props.footer}</footer> : null}
      </div>
    </div>
  );
}
