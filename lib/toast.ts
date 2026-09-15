'use client';

import { useSyncExternalStore } from 'react';

export type ToastTone = 'success' | 'danger' | 'info' | 'warning';
export interface Toast {
  id: string;
  tone: ToastTone;
  title: string;
  message?: string | undefined;
}

/**
 * Store mínimo de notificaciones (toasts), independiente de React-context para poder dispararse
 * desde cualquier sitio —un handler de página, un servicio— con `toast.success(...)`.
 */
let toasts: Toast[] = [];
const listeners = new Set<() => void>();
let counter = 0;

function emit() {
  for (const listener of listeners) listener();
}

/**
 * Un aviso REPETIDO no se apila.
 *
 * Una pantalla puede pedir varios catálogos a la vez y todos fallan por lo mismo —el servidor no
 * contesta—: salían seis avisos idénticos, uno por campo, tapando media pantalla. El primero dice
 * todo lo que hay que decir; los siguientes sólo estorban. Se ignoran los que repiten tono, título y
 * mensaje dentro de esta ventana; pasada, un fallo nuevo vuelve a avisar.
 */
const VENTANA_SIN_REPETIR_MS = 5_000;
const ultimos = new Map<string, { id: string; at: number }>();

function push(tone: ToastTone, title: string, message?: string): string {
  const clave = `${tone}|${title}|${message ?? ''}`;
  const ahora = Date.now();
  const previo = ultimos.get(clave);
  if (previo && ahora - previo.at < VENTANA_SIN_REPETIR_MS) return previo.id;

  counter += 1;
  const id = `t${counter}-${ahora}`;
  ultimos.set(clave, { id, at: ahora });
  for (const [otra, valor] of ultimos) if (ahora - valor.at > VENTANA_SIN_REPETIR_MS) ultimos.delete(otra);
  toasts = [...toasts, { id, tone, title, message }];
  emit();
  return id;
}

export function dismissToast(id: string) {
  toasts = toasts.filter((toast) => toast.id !== id);
  emit();
}

export const toast = {
  success: (title: string, message?: string) => push('success', title, message),
  error: (title: string, message?: string) => push('danger', title, message),
  info: (title: string, message?: string) => push('info', title, message),
  warning: (title: string, message?: string) => push('warning', title, message),
};

export function useToasts(): Toast[] {
  return useSyncExternalStore(
    (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
    () => toasts,
    () => toasts,
  );
}
