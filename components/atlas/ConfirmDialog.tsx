'use client';

import { useEffect } from 'react';
import { AtlasButton } from '@/components/atlas/AtlasButton';
import { Icon } from '@/components/atlas/Icon';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string | undefined;
  cancelLabel?: string | undefined;
  tone?: 'danger' | 'primary' | undefined;
  loading?: boolean | undefined;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Modal de confirmación (reemplaza a `window.confirm`) para acciones irreversibles o sensibles. */
export function ConfirmDialog(props: ConfirmDialogProps) {
  useEffect(() => {
    if (!props.open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') props.onCancel(); };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = previous; };
  }, [props.open, props]);

  if (!props.open) return null;
  const danger = props.tone !== 'primary';
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]" onClick={props.onCancel} />
      <div className="relative w-[min(92vw,420px)] rounded-xl border border-slate-200 bg-white p-5 shadow-2xl">
        <div className="flex items-start gap-3">
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${danger ? 'bg-red-50 text-red-600' : 'bg-primary-wash text-primary'}`}>
            <Icon name={danger ? 'warning' : 'help'} className="text-[22px]" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-800">{props.title}</h2>
            <p className="mt-1 text-xs leading-5 text-slate-600">{props.message}</p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <AtlasButton variant="secondary" onClick={props.onCancel} disabled={props.loading ?? false}>{props.cancelLabel ?? 'Cancelar'}</AtlasButton>
          <AtlasButton variant={danger ? 'danger' : 'primary'} onClick={props.onConfirm} loading={props.loading ?? false}>{props.confirmLabel ?? 'Confirmar'}</AtlasButton>
        </div>
      </div>
    </div>
  );
}
