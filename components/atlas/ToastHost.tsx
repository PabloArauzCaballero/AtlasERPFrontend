'use client';

import { useEffect } from 'react';
import { Icon } from '@/components/atlas/Icon';
import { dismissToast, useToasts, type ToastTone } from '@/lib/toast';

const TONE: Record<ToastTone, { bar: string; icon: string; ring: string }> = {
  success: { bar: 'bg-success', icon: 'check_circle', ring: 'text-success' },
  danger: { bar: 'bg-danger', icon: 'error', ring: 'text-danger' },
  info: { bar: 'bg-primary', icon: 'info', ring: 'text-primary' },
  warning: { bar: 'bg-warning', icon: 'warning', ring: 'text-warning' },
};

/** Pila de notificaciones flotantes (arriba a la derecha). Cada una se autocierra a los 5 s. */
export function ToastHost() {
  const toasts = useToasts();
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-[min(92vw,380px)] flex-col gap-2">
      {toasts.map((toast) => <ToastCard key={toast.id} id={toast.id} tone={toast.tone} title={toast.title} message={toast.message} />)}
    </div>
  );
}

function ToastCard({ id, tone, title, message }: { id: string; tone: ToastTone; title: string; message?: string | undefined }) {
  useEffect(() => {
    const timer = setTimeout(() => dismissToast(id), 5000);
    return () => clearTimeout(timer);
  }, [id]);
  const skin = TONE[tone];
  return (
    <div className="pointer-events-auto flex overflow-hidden rounded-lg border border-border-strong bg-white">
      <span className={`w-1.5 shrink-0 ${skin.bar}`} />
      <div className="flex flex-1 items-start gap-2.5 p-3">
        <Icon name={skin.icon} className={`mt-0.5 text-[18px] ${skin.ring}`} />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-slate-900">{title}</p>
          {message ? <p className="mt-0.5 break-words text-xs leading-4 text-slate-600">{message}</p> : null}
        </div>
        <button type="button" aria-label="Cerrar" className="grid h-5 w-5 shrink-0 place-items-center rounded text-slate-500 hover:bg-surface-sunken hover:text-slate-900" onClick={() => dismissToast(id)}>
          <Icon name="close" className="text-[15px]" />
        </button>
      </div>
    </div>
  );
}
