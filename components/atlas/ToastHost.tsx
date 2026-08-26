'use client';

import { useEffect } from 'react';
import { Icon } from '@/components/atlas/Icon';
import { dismissToast, useToasts, type ToastTone } from '@/lib/toast';

const TONE: Record<ToastTone, { bar: string; icon: string; ring: string }> = {
  success: { bar: 'bg-emerald-500', icon: 'check_circle', ring: 'text-emerald-600' },
  danger: { bar: 'bg-red-500', icon: 'error', ring: 'text-red-600' },
  info: { bar: 'bg-sky-500', icon: 'info', ring: 'text-sky-600' },
  warning: { bar: 'bg-amber-500', icon: 'warning', ring: 'text-amber-600' },
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
    <div className="pointer-events-auto flex overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg ring-1 ring-black/5">
      <span className={`w-1.5 shrink-0 ${skin.bar}`} />
      <div className="flex flex-1 items-start gap-2.5 p-3">
        <Icon name={skin.icon} className={`mt-0.5 text-[18px] ${skin.ring}`} />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-slate-800">{title}</p>
          {message ? <p className="mt-0.5 break-words text-[11px] leading-4 text-slate-500">{message}</p> : null}
        </div>
        <button type="button" aria-label="Cerrar" className="grid h-5 w-5 shrink-0 place-items-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-600" onClick={() => dismissToast(id)}>
          <Icon name="close" className="text-[15px]" />
        </button>
      </div>
    </div>
  );
}
