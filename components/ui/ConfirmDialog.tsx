'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AtlasButton } from '@/components/atlas/AtlasButton';
import { Icon } from '@/components/atlas/Icon';

interface ConfirmDialogProps {
  title: string;
  /** Qué va a pasar, en una frase. No «¿Está seguro?». */
  body: string;
  confirmLabel: string;
  tone?: 'danger' | 'primary';
  /** Si se define, se exige un motivo escrito antes de poder confirmar. */
  reasonLabel?: string | undefined;
  reasonPlaceholder?: string | undefined;
  /** Longitud mínima del motivo. El botón queda inhabilitado hasta alcanzarla. */
  minReasonLength?: number | undefined;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

/**
 * Diálogo de confirmación de la aplicación, en lugar de `window.confirm`.
 *
 * Tres razones, y ninguna es estética. La primera es que el diálogo del
 * navegador CONGELA la página: bloquea el hilo, así que nada de lo que hay
 * detrás —una carga en curso, un aviso de error— puede seguir. La segunda es que
 * no puede decir qué se va a borrar: `confirm` sólo acepta una cadena, así que
 * acaba preguntando «¿está seguro?» sin nombrar el registro, que es justo el dato
 * que evita el error. La tercera es que no admite un campo, y hay decisiones
 * —perder una oportunidad, revocar un acceso— que EXIGEN motivo escrito.
 *
 * Va en un portal por lo mismo que el resto de capas de esta aplicación: el
 * contenido vive dentro de `main`, que tiene su propio contexto de apilado.
 */
export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  tone = 'danger',
  reasonLabel,
  reasonPlaceholder,
  minReasonLength = 1,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [reason, setReason] = useState('');
  const [mounted, setMounted] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted) return;
    opener.current = document.activeElement;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel.current?.querySelector<HTMLElement>('input, textarea, button')?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
      (opener.current as HTMLElement | null)?.focus?.();
    };
  }, [mounted, onCancel]);

  if (!mounted) return null;

  const needsReason = Boolean(reasonLabel);
  const missing = Math.max(0, minReasonLength - reason.trim().length);
  const canConfirm = !needsReason || missing === 0;

  return createPortal(
    <div
      className="fixed inset-0 z-[75] grid place-items-center bg-slate-900/45 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        ref={panel}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-2xl"
      >
        <div className="flex items-start gap-3">
          <span
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${tone === 'danger' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-[#006a61]'}`}
          >
            <Icon name={tone === 'danger' ? 'warning' : 'help'} className="text-[21px]" />
          </span>
          <div className="min-w-0">
            <h2 id="confirm-title" className="text-sm font-bold text-slate-900">{title}</h2>
            <p className="mt-1 text-xs leading-5 text-slate-600">{body}</p>
          </div>
        </div>

        {needsReason ? (
          <label className="mt-4 block">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{reasonLabel}</span>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              placeholder={reasonPlaceholder}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-xs outline-none focus:border-[#006a61]"
            />
            {/* El motivo no es un trámite: es lo único que queda cuando alguien
                revisa la decisión meses después. Y si falta, se DICE cuánto
                falta: descartar en silencio un motivo demasiado corto —que es lo
                que hacía el `prompt`— se lee como que el sistema no responde. */}
            <span className="mt-1 block text-[11px] text-slate-500">
              {missing > 0
                ? `Faltan ${missing} caracteres para poder confirmar. Queda registrado junto a la operación.`
                : 'Queda registrado junto a la operación.'}
            </span>
          </label>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <AtlasButton variant="secondary" type="button" onClick={onCancel}>Cancelar</AtlasButton>
          <AtlasButton
            variant={tone === 'danger' ? 'danger' : 'primary'}
            type="button"
            disabled={!canConfirm}
            onClick={() => onConfirm(reason.trim())}
          >
            {confirmLabel}
          </AtlasButton>
        </div>
      </div>
    </div>,
    document.body,
  );
}
