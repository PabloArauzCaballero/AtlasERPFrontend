'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import { newUuid } from '@/lib/uuid';
import {
  AVISO_DATOS,
  MAX_PREGUNTA,
  describirErrorDelAsistente,
  pantallaDelAsistente,
  type SuperficieAsistente,
} from '@/lib/asistente';
import { assistService } from '@/services/assistService';
import { Icon } from './Icon';
import { LoadingSpinner } from '@/components/ui/LoadingIndicator';

interface Turno {
  id: string;
  pregunta: string;
  respuesta: string | null;
  sugiereAtencion: boolean;
  sinIa: boolean;
}

type Carga = 'sin-pedir' | 'cargando' | 'lista';

/** Dónde se habla con una persona. Sólo el comercio tiene un canal real en este portal. */
const ATENCION_HUMANA: Partial<Record<SuperficieAsistente, { href: string; texto: string }>> = {
  'merchant-portal': { href: '/portal-comercio/soporte', texto: 'Hablar con soporte' },
};

const ENFOCABLES = 'a[href], button:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * El botón del asistente y su panel, en toda pantalla con sesión del ERP y del portal del comercio.
 *
 * Se monta en el armazón de cada área (`AppShell`, `MerchantPortalShell`) y no en cada pantalla:
 * así ninguna pantalla nueva nace sin él, y el inicio de sesión —que no tiene armazón— nunca lo
 * enseña. El botón NO se esconde si el asistente está apagado: el panel lo dice y deja el campo
 * deshabilitado. Esconderlo es justo lo que hacía que «no aparece en ningún portal».
 *
 * Capas: el botón va por encima del menú lateral (z-40) y por debajo de la barra superior (z-50);
 * el panel, por encima del cajón de navegación (z-60) y por debajo de las guías, los recorridos,
 * los avisos y los diálogos (z-70 en adelante).
 */
export function AtlasAssist({ surface }: Readonly<{ surface: SuperficieAsistente }>) {
  const pathname = usePathname();
  const [abierto, setAbierto] = useState(false);
  const [carga, setCarga] = useState<Carga>('sin-pedir');
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [texto, setTexto] = useState('');
  const [pensando, setPensando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apagado, setApagado] = useState(false);
  const pendiente = useRef<{ prompt: string; id: string } | null>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLTextAreaElement>(null);
  const fin = useRef<HTMLDivElement>(null);
  const tituloId = useId();
  const atencion = ATENCION_HUMANA[surface];

  const cerrar = useCallback(() => {
    setAbierto(false);
    boton.current?.focus();
  }, []);

  // Navegar cierra el panel: una respuesta sobre «Cartera» no debe quedar tapando «Mi empresa».
  useEffect(() => setAbierto(false), [pathname]);

  // El historial se pide al abrir por primera vez; la conversación sigue viva mientras la pestaña.
  useEffect(() => {
    if (!abierto || carga !== 'sin-pedir') return;
    setCarga('cargando');
    assistService
      .conversacion()
      .then((conversacion) => {
        if (conversacion?.conversationId) setConversationId(conversacion.conversationId);
        setTurnos(
          (conversacion?.turns ?? []).map((turno) => ({
            id: turno.turnId,
            pregunta: turno.prompt,
            respuesta: turno.reply,
            sugiereAtencion: turno.suggestHandoff,
            sinIa: turno.mode === 'sin-ia',
          })),
        );
      })
      .catch((causa: unknown) => {
        const descrito = describirErrorDelAsistente(causa);
        setApagado(descrito.apagado);
        // Sin historial se puede preguntar igual: sólo se avisa si el asistente está apagado.
        if (descrito.apagado) setError(descrito.mensaje);
      })
      .finally(() => setCarga('lista'));
  }, [abierto, carga]);

  // Foco al abrir, Escape para cerrar y Tab atrapado dentro del panel.
  useEffect(() => {
    if (!abierto) return;
    const primero = campo.current && !campo.current.disabled ? campo.current : panel.current?.querySelector<HTMLElement>(ENFOCABLES);
    primero?.focus();
    const alTeclear = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') {
        evento.stopPropagation();
        cerrar();
        return;
      }
      if (evento.key !== 'Tab' || !panel.current) return;
      const enfocables = Array.from(panel.current.querySelectorAll<HTMLElement>(ENFOCABLES));
      if (enfocables.length === 0) return;
      const inicial = enfocables[0] as HTMLElement;
      const final = enfocables[enfocables.length - 1] as HTMLElement;
      if (evento.shiftKey && document.activeElement === inicial) {
        evento.preventDefault();
        final.focus();
      } else if (!evento.shiftKey && document.activeElement === final) {
        evento.preventDefault();
        inicial.focus();
      }
    };
    document.addEventListener('keydown', alTeclear);
    return () => document.removeEventListener('keydown', alTeclear);
  }, [abierto, cerrar]);

  useEffect(() => {
    fin.current?.scrollIntoView?.({ block: 'end' });
  }, [turnos, pensando, abierto]);

  async function enviar() {
    const prompt = texto.trim();
    if (!prompt || pensando || apagado) return;
    // Si la anterior falló sin saberse si llegó, la misma pregunta sale con la MISMA llave: Core
    // devuelve la respuesta ya generada en vez de otra.
    const id = pendiente.current?.prompt === prompt ? pendiente.current.id : newUuid();
    pendiente.current = { prompt, id };
    setError(null);
    setPensando(true);
    try {
      const respuesta = await assistService.preguntar({
        prompt,
        clientMessageId: id,
        ...(conversationId ? { conversationId } : {}),
        screen: pantallaDelAsistente(pathname, surface),
      });
      pendiente.current = null;
      setConversationId(respuesta.conversationId);
      setTurnos((previos) => [
        ...previos,
        {
          id: respuesta.turnId || id,
          pregunta: prompt,
          respuesta: respuesta.reply,
          sugiereAtencion: respuesta.suggestHandoff,
          sinIa: respuesta.mode === 'sin-ia',
        },
      ]);
      setTexto('');
    } catch (causa) {
      const descrito = describirErrorDelAsistente(causa);
      setApagado(descrito.apagado);
      setError(descrito.mensaje);
    } finally {
      setPensando(false);
      campo.current?.focus();
    }
  }

  const bloqueado = apagado || pensando;

  return (
    <>
      <button
        ref={boton}
        type="button"
        onClick={() => (abierto ? cerrar() : setAbierto(true))}
        aria-label="Asistente de Atlas"
        aria-expanded={abierto}
        aria-haspopup="dialog"
        title="Preguntale al asistente"
        data-testid="asistente-boton"
        className={cn(
          'fixed bottom-4 right-4 z-[45] grid h-14 w-14 place-items-center rounded-full border border-white/20 bg-[#006a61] text-white shadow-lg transition sm:bottom-6 sm:right-6',
          'hover:-translate-y-0.5 hover:bg-[#00544d] hover:shadow-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30',
          abierto && 'max-sm:hidden',
        )}
      >
        <Icon name={abierto ? 'close' : 'chat_bubble'} className="text-[26px]" />
      </button>

      {abierto ? (
        <div
          ref={panel}
          role="dialog"
          aria-modal="true"
          aria-labelledby={tituloId}
          data-testid="asistente-panel"
          className={cn(
            'fixed inset-x-2 bottom-2 top-16 z-[65] flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl',
            'sm:inset-x-auto sm:bottom-24 sm:right-6 sm:top-auto sm:h-[min(36rem,calc(100dvh-8rem))] sm:w-[26rem]',
          )}
        >
          <header className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
              <Icon name="chat_bubble" className="text-[20px]" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 id={tituloId} className="truncate text-sm font-extrabold text-slate-900">Asistente de Atlas</h2>
              <p className="truncate text-[11px] text-slate-500">Dudas sobre cómo usar {surface === 'merchant-portal' ? 'el portal' : 'el ERP'}</p>
            </div>
            <button
              type="button"
              onClick={cerrar}
              aria-label="Cerrar el asistente"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
            >
              <Icon name="close" className="text-[20px]" />
            </button>
          </header>

          <div className="custom-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain bg-slate-50/60 px-4 py-3" aria-live="polite">
            {carga === 'cargando' ? (
              <p className="flex items-center gap-2 text-xs text-slate-500"><LoadingSpinner label="Cargando la conversación" /> Cargando la conversación…</p>
            ) : null}
            {carga === 'lista' && turnos.length === 0 && !apagado ? (
              <p className="rounded-lg border border-dashed border-slate-300 bg-white p-3 text-xs leading-5 text-slate-600">
                Pregúntame cómo hacer algo en {surface === 'merchant-portal' ? 'el portal' : 'el ERP'}: dónde está una pantalla, qué significa un estado o qué pasos seguir.
              </p>
            ) : null}
            {turnos.map((turno) => (
              <div key={turno.id} className="space-y-2">
                <p className="ml-auto w-fit max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-slate-900 px-3 py-2 text-xs leading-5 text-white">{turno.pregunta}</p>
                {turno.respuesta ? (
                  <div className="w-fit max-w-[92%] rounded-2xl rounded-bl-sm border border-slate-200 bg-white px-3 py-2 text-xs leading-5 text-slate-800 shadow-sm">
                    <p className="whitespace-pre-wrap">{turno.respuesta}</p>
                    {turno.sinIa ? <p className="mt-1.5 text-[10px] text-slate-500">Respuesta sin IA: texto de la guía.</p> : null}
                    {turno.sugiereAtencion && atencion ? (
                      <Link
                        href={atencion.href}
                        onClick={() => setAbierto(false)}
                        className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary-wash px-2.5 py-1.5 text-[11px] font-bold text-primary hover:bg-primary-soft"
                      >
                        <Icon name="support_agent" className="text-[16px]" /> {atencion.texto}
                      </Link>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ))}
            {pensando ? (
              <div className="space-y-2">
                <p className="ml-auto w-fit max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-slate-900/80 px-3 py-2 text-xs leading-5 text-white">{texto.trim()}</p>
                <p className="flex w-fit items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500" role="status">
                  <LoadingSpinner label="Pensando" /> Pensando…
                </p>
              </div>
            ) : null}
            {error ? (
              <p role="alert" className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-2.5 text-xs leading-5 text-amber-900">
                <Icon name={apagado ? 'power_settings_new' : 'warning'} className="mt-0.5 text-[16px]" />
                <span>{error}</span>
              </p>
            ) : null}
            <div ref={fin} />
          </div>

          <form
            className="border-t border-slate-200 bg-white px-3 pb-3 pt-2"
            onSubmit={(evento) => {
              evento.preventDefault();
              void enviar();
            }}
          >
            <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold text-slate-500">
              <Icon name="lock" className="text-[14px]" /> {AVISO_DATOS}
            </p>
            <div className="flex items-end gap-2">
              <label className="sr-only" htmlFor={`${tituloId}-campo`}>Tu pregunta</label>
              <textarea
                id={`${tituloId}-campo`}
                ref={campo}
                value={texto}
                onChange={(evento) => setTexto(evento.target.value.slice(0, MAX_PREGUNTA))}
                onKeyDown={(evento) => {
                  if (evento.key === 'Enter' && !evento.shiftKey && !evento.nativeEvent.isComposing) {
                    evento.preventDefault();
                    void enviar();
                  }
                }}
                maxLength={MAX_PREGUNTA}
                rows={2}
                disabled={bloqueado}
                placeholder={apagado ? 'El asistente no está disponible' : 'Escribe tu pregunta'}
                className="max-h-32 min-h-[44px] flex-1 resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs leading-5 text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15 disabled:cursor-not-allowed disabled:bg-slate-100"
              />
              <button
                type="submit"
                disabled={bloqueado || !texto.trim()}
                aria-label="Enviar pregunta"
                className="atlas-tap grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-slate-900 text-white transition hover:bg-slate-950 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pensando ? <LoadingSpinner label="Enviando" /> : <Icon name="send" className="text-[18px]" />}
              </button>
            </div>
            <p className="mt-1 text-right text-[10px] text-slate-400">
              Enter para enviar · Shift+Enter para otra línea · {texto.length}/{MAX_PREGUNTA}
            </p>
          </form>
        </div>
      ) : null}
    </>
  );
}
