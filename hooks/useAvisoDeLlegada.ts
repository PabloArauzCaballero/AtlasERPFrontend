'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const CLAVE_SONIDO = 'atlas_pos_sonido';

export interface Llegada {
  id: string;
  texto: string;
}

/**
 * Avisar de que llegó algo nuevo a una cola mientras alguien espera delante de la caja.
 *
 * - Un aviso en la página («Nueva solicitud: Bs 1 700») que se cierra a mano.
 * - El número de pendientes en el título de la pestaña («(1) Gestión POS»), para verlo desde otra
 *   pestaña o con la ventana minimizada.
 * - Un tono corto, que se puede apagar y se recuerda en este navegador. El navegador sólo deja
 *   sonar después de que la persona haya tocado la página (autoplay): si no deja, no suena y ya;
 *   el aviso visual sigue ahí.
 */
export function useAvisoDeLlegada(tituloBase: string, pendientes: number) {
  const [llegadas, setLlegadas] = useState<Llegada[]>([]);
  const [sonido, setSonido] = useState(true);
  const audio = useRef<AudioContext | null>(null);

  useEffect(() => {
    try {
      setSonido(window.localStorage.getItem(CLAVE_SONIDO) !== 'no');
    } catch {
      /* almacenamiento bloqueado: se queda encendido */
    }
  }, []);

  useEffect(() => {
    const previo = document.title;
    document.title = pendientes > 0 ? `(${pendientes}) ${tituloBase}` : tituloBase;
    return () => {
      document.title = previo;
    };
  }, [pendientes, tituloBase]);

  useEffect(() => {
    const contexto = audio;
    return () => {
      void contexto.current?.close().catch(() => undefined);
    };
  }, []);

  const sonar = useCallback(() => {
    try {
      const Contexto =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Contexto) return;
      audio.current ??= new Contexto();
      const ctx = audio.current;
      if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
      const oscilador = ctx.createOscillator();
      const volumen = ctx.createGain();
      oscilador.type = 'sine';
      oscilador.frequency.value = 880;
      volumen.gain.setValueAtTime(0.0001, ctx.currentTime);
      volumen.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.02);
      volumen.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
      oscilador.connect(volumen).connect(ctx.destination);
      oscilador.start();
      oscilador.stop(ctx.currentTime + 0.4);
    } catch {
      /* sin audio (autoplay, navegador sin WebAudio): el aviso visual basta */
    }
  }, []);

  const avisar = useCallback(
    (nuevas: Llegada[]) => {
      if (nuevas.length === 0) return;
      setLlegadas((previas) => [...nuevas, ...previas.filter((p) => !nuevas.some((n) => n.id === p.id))].slice(0, 5));
      if (sonido) sonar();
    },
    [sonido, sonar],
  );

  const alternarSonido = useCallback(() => {
    setSonido((actual) => {
      const siguiente = !actual;
      try {
        window.localStorage.setItem(CLAVE_SONIDO, siguiente ? 'si' : 'no');
      } catch {
        /* sin almacenamiento: vale para esta visita */
      }
      return siguiente;
    });
  }, []);

  const descartar = useCallback(() => setLlegadas([]), []);

  return { llegadas, avisar, descartar, sonido, alternarSonido };
}
