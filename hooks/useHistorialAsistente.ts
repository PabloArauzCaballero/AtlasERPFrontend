'use client';

import { useCallback, useRef, useState, type RefObject } from 'react';
import { ApiError } from '@/lib/apiClient';
import { assistService, type ConversacionDelAsistente, type ResumenDeConversacion } from '@/services/assistService';

/**
 * El historial de conversaciones del asistente: la lista, abrir una para seguirla y borrarla.
 *
 * Es un estado aparte del hilo: si la lista no carga, el panel lo dice DENTRO de «Historial» y el
 * campo de pregunta sigue funcionando.
 */
export type FaseDelHistorial = 'sin-pedir' | 'cargando' | 'lista' | 'error';

export const ERROR_LISTA = 'No se pudo cargar el historial. Puedes seguir preguntando y volver a intentarlo en un momento.';
export const ERROR_ABRIR = 'No se pudo abrir esa conversación. Inténtalo de nuevo.';
export const ERROR_YA_NO_EXISTE = 'Esa conversación ya no existe.';
export const ERROR_BORRAR = 'No se pudo borrar la conversación. Inténtalo de nuevo.';

interface Dependencias {
  conversationId: string | undefined;
  /** Hay una pregunta al modelo en curso: no se cambia de hilo debajo de ella. */
  pensando: RefObject<boolean>;
  alAbrir: (conversacion: ConversacionDelAsistente, id: string) => void;
  alBorrarLaActual: () => void;
}

export function useHistorialAsistente({ conversationId, pensando, alAbrir, alBorrarLaActual }: Dependencias) {
  const [fase, setFase] = useState<FaseDelHistorial>('sin-pedir');
  const [items, setItems] = useState<ResumenDeConversacion[]>([]);
  const [ocupada, setOcupada] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const ficha = useRef(0);

  const cargarLista = useCallback(async () => {
    setFase('cargando');
    setAviso(null);
    try {
      setItems(await assistService.conversaciones());
      setFase('lista');
    } catch {
      setFase('error');
    }
  }, []);

  const quitar = (id: string) => setItems((actuales) => actuales.filter((item) => item.conversationId !== id));

  /** `true` si el hilo cambió (el panel vuelve al chat). */
  const abrirConversacion = useCallback(
    async (id: string): Promise<boolean> => {
      if (pensando.current) return false;
      const mia = ++ficha.current;
      setOcupada(id);
      setAviso(null);
      try {
        const conversacion = await assistService.abrir(id);
        if (mia !== ficha.current) return false;
        alAbrir(conversacion, id);
        return true;
      } catch (causa) {
        if (mia !== ficha.current) return false;
        if (causa instanceof ApiError && causa.status === 404) {
          quitar(id);
          setAviso(ERROR_YA_NO_EXISTE);
        } else setAviso(ERROR_ABRIR);
        return false;
      } finally {
        if (mia === ficha.current) setOcupada(null);
      }
    },
    [alAbrir, pensando],
  );

  const borrarConversacion = useCallback(
    async (id: string): Promise<boolean> => {
      setOcupada(id);
      setAviso(null);
      try {
        await assistService.borrar(id);
        quitar(id);
        if (id === conversationId) alBorrarLaActual();
        return true;
      } catch {
        setAviso(ERROR_BORRAR);
        return false;
      } finally {
        setOcupada(null);
      }
    },
    [alBorrarLaActual, conversationId],
  );

  return { fase, items, ocupada, aviso, cargarLista, abrirConversacion, borrarConversacion };
}

export type HistorialAsistente = ReturnType<typeof useHistorialAsistente>;
