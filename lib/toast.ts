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

function push(tone: ToastTone, title: string, message?: string): string {
  counter += 1;
  const id = `t${counter}-${Date.now()}`;
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
