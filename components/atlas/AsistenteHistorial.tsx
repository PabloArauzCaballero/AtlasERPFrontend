'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { contarMensajes, fechaRelativa } from '@/lib/asistente';
import { ERROR_LISTA, type HistorialAsistente } from '@/hooks/useHistorialAsistente';
import type { ResumenDeConversacion } from '@/services/assistService';
import { Icon } from './Icon';
import { LoadingSpinner } from '@/components/ui/LoadingIndicator';

/**
 * La vista «Historial de conversaciones» dentro del panel del asistente: título, fecha y cantidad
 * de mensajes. Tocar una conversación la abre para seguirla; borrar pide confirmación EN LA FILA,
 * sin cuadros del navegador, para no perder un hilo por un toque de más.
 */
export function AsistenteHistorial({
  historial,
  actual,
  enviando,
  alVolver,
  alAbrir,
}: Readonly<{
  historial: HistorialAsistente;
  actual: string | undefined;
  enviando: boolean;
  alVolver: () => void;
  /** Se abrió una conversación: el panel vuelve al chat con ese hilo. */
  alAbrir: () => void;
}>) {
  const { fase, items, ocupada, aviso, cargarLista, abrirConversacion, borrarConversacion } = historial;
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const raiz = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void cargarLista();
    raiz.current?.querySelector('button')?.focus();
  }, [cargarLista]);

  return (
    <div ref={raiz} className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-2">
        <h3 className="text-xs font-extrabold text-slate-900">Historial de conversaciones</h3>
        <button
          type="button"
          onClick={alVolver}
          className="inline-flex h-10 items-center gap-1.5 rounded-lg px-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
        >
          <Icon name="arrow_back" className="text-[16px]" /> Volver al chat
        </button>
      </div>

      <div className="custom-scrollbar min-h-0 flex-1 space-y-2 overflow-y-auto bg-slate-50/60 px-4 py-3">
        {aviso ? (
          <p role="alert" className="rounded-md border border-amber-200 bg-amber-50 p-2.5 text-xs leading-5 text-amber-900">{aviso}</p>
        ) : null}
        {fase === 'cargando' && items.length === 0 ? (
          <p role="status" className="flex items-center gap-2 text-xs text-slate-500">
            <LoadingSpinner label="Cargando tus conversaciones" /> Cargando tus conversaciones…
          </p>
        ) : null}
        {fase === 'error' ? (
          <div role="alert" className="space-y-2 rounded-md border border-amber-200 bg-amber-50 p-2.5 text-xs leading-5 text-amber-900">
            <p>{ERROR_LISTA}</p>
            <button
              type="button"
              onClick={() => void cargarLista()}
              className="h-9 rounded-lg border border-amber-300 bg-white px-3 font-bold hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
            >
              Reintentar
            </button>
          </div>
        ) : null}
        {fase === 'lista' && items.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-center text-xs leading-5 text-slate-600">
            Todavía no tienes conversaciones guardadas. Haz una pregunta y aparecerá aquí.
          </p>
        ) : null}
        <ul className="space-y-2">
          {items.map((item) => (
            <FilaDelHistorial
              key={item.conversationId}
              item={item}
              esActual={item.conversationId === actual}
              ocupada={ocupada === item.conversationId}
              bloqueada={ocupada !== null || enviando}
              confirmando={confirmando === item.conversationId}
              alAbrir={async () => {
                if (await abrirConversacion(item.conversationId)) alAbrir();
              }}
              alPedirBorrado={() => setConfirmando(item.conversationId)}
              alCancelar={() => setConfirmando(null)}
              alBorrar={async () => {
                await borrarConversacion(item.conversationId);
                setConfirmando(null);
              }}
            />
          ))}
        </ul>
      </div>
    </div>
  );
}

function FilaDelHistorial({
  item,
  esActual,
  ocupada,
  bloqueada,
  confirmando,
  alAbrir,
  alPedirBorrado,
  alCancelar,
  alBorrar,
}: Readonly<{
  item: ResumenDeConversacion;
  esActual: boolean;
  ocupada: boolean;
  bloqueada: boolean;
  confirmando: boolean;
  alAbrir: () => void;
  alPedirBorrado: () => void;
  alCancelar: () => void;
  alBorrar: () => void;
}>) {
  const titulo = item.title?.trim() || 'Conversación sin título';
  const detalle = [fechaRelativa(item.updatedAt), contarMensajes(item.turnCount)].filter(Boolean).join(' · ');
  return (
    <li className={cn('rounded-xl border bg-white', esActual ? 'border-primary' : 'border-slate-200')}>
      {confirmando ? (
        <div role="group" aria-label={`Borrar «${titulo}»`} className="space-y-2 px-3 py-2.5">
          <p className="text-xs leading-5 text-slate-800">¿Borrar «{titulo}»? No se puede deshacer.</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={alBorrar}
              disabled={bloqueada}
              className="h-9 rounded-lg border border-red-200 bg-red-50 px-3 text-xs font-bold text-red-700 hover:bg-red-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 disabled:opacity-60"
            >
              {ocupada ? 'Borrando…' : 'Sí, borrar'}
            </button>
            <button
              type="button"
              onClick={alCancelar}
              className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-stretch">
          <button
            type="button"
            onClick={alAbrir}
            disabled={bloqueada}
            aria-current={esActual ? 'true' : undefined}
            className="min-h-[52px] min-w-0 flex-1 rounded-l-xl px-3 py-2 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="block truncate text-xs font-bold text-slate-900">{titulo}</span>
            <span className="block text-[11px] text-slate-500">{ocupada ? 'Abriendo…' : detalle}</span>
          </button>
          <button
            type="button"
            onClick={alPedirBorrado}
            disabled={bloqueada}
            aria-label={`Borrar la conversación «${titulo}»`}
            className="grid w-11 shrink-0 place-items-center rounded-r-xl text-slate-500 hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Icon name="delete" className="text-[18px]" />
          </button>
        </div>
      )}
    </li>
  );
}
