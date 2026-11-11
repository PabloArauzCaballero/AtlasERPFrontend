'use client';

import { useEffect } from 'react';
import './tema.css';
import './globals.css';
import { reportarError } from '@/lib/erroresCliente';

/**
 * Último recurso: un error de render que nadie más atrapó. Sustituye al layout raíz entero, así que
 * trae su propio `<html>` y sus estilos, y no depende de la sesión ni de ningún contexto.
 *
 * Reporta el error (`kind: 'boundary'`) por la misma vía que el capturador global, y ofrece
 * reintentar la pantalla; no enseña el mensaje técnico al usuario.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportarError('boundary', error);
  }, [error]);

  return (
    <html lang="es-BO">
      <body className="bg-canvas">
        <main className="grid min-h-[100dvh] place-items-center p-6">
          <div className="max-w-md rounded-lg border border-border-strong bg-surface p-6 text-center">
            <h1 className="text-lg font-semibold text-slate-900">Algo salió mal en esta pantalla</h1>
            <p className="mt-2 text-sm text-slate-600">
              Ya quedó registrado para que el equipo lo revise. Puedes volver a intentarlo; si se repite, avisa a soporte.
            </p>
            <button
              type="button"
              onClick={reset}
              className="mt-4 inline-flex h-9 items-center justify-center rounded-md border border-brand bg-brand px-3 text-xs font-semibold text-on-brand hover:bg-brand-strong"
            >
              Volver a intentar
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
