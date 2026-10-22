'use client';

/**
 * Las piezas del chat de soporte del portal del comercio.
 *
 * ## Rediseño (2026-10-22)
 *
 * Es el mismo lenguaje que el chat de las apps móviles (`AtlasFrontend/apps/consumer-app/src/ui/chat-kit.tsx`):
 *
 * - **Quién responde.** Una cabecera con el equipo, su presencia («En línea», «Reconectando…») y qué
 *   esperar. Quien escribe con un problema necesita saber que hay una persona del otro lado.
 * - **Lo mío en el color de marca, lo del equipo en blanco**, agrupado: hora y estado solo en el
 *   último mensaje de cada grupo, y un separador por día («Hoy», «Ayer», «12 de octubre»).
 * - **Empezar es un clic.** El hilo vacío ofrece temas frecuentes que escriben la primera frase.
 * - **Enter envía, Shift+Enter salta de línea**, como en cualquier chat de escritorio.
 * - **La seguridad, a la vista**: nadie de Atlas pide la contraseña ni los códigos.
 */
import { useRef, type KeyboardEvent } from 'react';
import { Icon } from '@/components/atlas/Icon';

export type LadoDelMensaje = 'mio' | 'suyo' | 'sistema';

export type EntradaDelHilo<M> =
  | { tipo: 'dia'; clave: string; etiqueta: string }
  | { tipo: 'mensaje'; clave: string; mensaje: M; lado: LadoDelMensaje; primeroDelGrupo: boolean; ultimoDelGrupo: boolean };

/** Dos mensajes del mismo lado separados por más de esto empiezan grupo nuevo. */
export const PAUSA_ENTRE_GRUPOS_MS = 300_000; // cinco minutos

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function claveDeDia(fecha: Date): string {
  return `${fecha.getFullYear()}-${fecha.getMonth()}-${fecha.getDate()}`;
}

export function etiquetaDeDia(fecha: Date, ahora: Date = new Date()): string {
  if (claveDeDia(fecha) === claveDeDia(ahora)) return 'Hoy';
  const ayer = new Date(ahora);
  ayer.setDate(ahora.getDate() - 1);
  if (claveDeDia(fecha) === claveDeDia(ayer)) return 'Ayer';
  const base = `${fecha.getDate()} de ${MESES[fecha.getMonth()]}`;
  return fecha.getFullYear() === ahora.getFullYear() ? base : `${base} de ${fecha.getFullYear()}`;
}

export function armarHilo<M extends { messageId: string; createdAt: string }>(
  mensajes: readonly M[],
  ladoDe: (mensaje: M) => LadoDelMensaje,
  ahora: Date = new Date(),
): EntradaDelHilo<M>[] {
  const salida: EntradaDelHilo<M>[] = [];
  let diaAnterior: string | null = null;
  const mismoGrupo = (a: M | undefined, b: M | undefined) => {
    if (!a || !b || ladoDe(a) === 'sistema' || ladoDe(a) !== ladoDe(b)) return false;
    const ta = new Date(a.createdAt).getTime();
    const tb = new Date(b.createdAt).getTime();
    if (Number.isNaN(ta) || Number.isNaN(tb)) return true;
    return claveDeDia(new Date(ta)) === claveDeDia(new Date(tb)) && Math.abs(tb - ta) <= PAUSA_ENTRE_GRUPOS_MS;
  };

  mensajes.forEach((mensaje, indice) => {
    const fecha = new Date(mensaje.createdAt);
    const valida = !Number.isNaN(fecha.getTime());
    const dia = valida ? claveDeDia(fecha) : diaAnterior;
    if (valida && dia !== diaAnterior) salida.push({ tipo: 'dia', clave: `dia-${dia}`, etiqueta: etiquetaDeDia(fecha, ahora) });
    diaAnterior = dia;
    salida.push({
      tipo: 'mensaje',
      clave: mensaje.messageId,
      mensaje,
      lado: ladoDe(mensaje),
      primeroDelGrupo: !mismoGrupo(mensajes[indice - 1], mensaje),
      ultimoDelGrupo: !mismoGrupo(mensaje, mensajes[indice + 1]),
    });
  });
  return salida;
}

export type EstadoDePresencia = 'en_linea' | 'reconectando' | 'cerrado';

const PRESENCIA: Record<EstadoDePresencia, { texto: string; punto: string }> = {
  en_linea: { texto: 'En línea', punto: 'bg-success' },
  reconectando: { texto: 'Reconectando…', punto: 'bg-warning' },
  cerrado: { texto: 'Conversación cerrada', punto: 'bg-slate-400' },
};

export function PresenciaDeSoporte({ estado }: { estado: EstadoDePresencia }) {
  const { texto, punto } = PRESENCIA[estado];
  return (
    <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3" data-testid="presencia-de-soporte">
      <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-on-primary">
        A
        <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-white ${punto}`} aria-hidden />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-900">Equipo de soporte Atlas</p>
        <p className="text-xs text-slate-500">
          {texto} · Te responde una persona del equipo de comercios, por lo general en pocos minutos.
        </p>
      </div>
    </div>
  );
}

export function SeparadorDeDia({ dia }: { dia: string }) {
  return (
    <div className="my-2 flex justify-center" role="separator" aria-label={dia}>
      <span className="rounded-full bg-slate-200/70 px-3 py-1 text-[11px] font-medium text-slate-600">{dia}</span>
    </div>
  );
}

export function AvisoDelSistema({ texto }: { texto: string }) {
  return (
    <div className="mx-auto my-1 flex max-w-[85%] items-start gap-2 rounded-lg bg-warning-wash px-3 py-2 text-xs text-warning ring-1 ring-warning/20">
      <Icon name="shield" className="text-[16px]" />
      <span>{texto}</span>
    </div>
  );
}

export function BurbujaDeChat({
  mio,
  primeroDelGrupo,
  ultimoDelGrupo,
  hora,
  leido,
  nota,
  cuerpo,
}: {
  mio: boolean;
  primeroDelGrupo: boolean;
  ultimoDelGrupo: boolean;
  hora: string;
  leido: boolean;
  nota?: string | null;
  cuerpo: string;
}) {
  const ladoDeLaCola = mio ? 'rounded-br-md' : 'rounded-bl-md';
  const cola = ultimoDelGrupo ? ladoDeLaCola : '';
  const color = mio ? 'bg-primary text-on-primary' : 'bg-white text-slate-900 ring-1 ring-slate-200';
  return (
    <div className={`flex ${mio ? 'justify-end' : 'justify-start'} ${primeroDelGrupo ? 'mt-2' : 'mt-0.5'}`} data-testid={mio ? 'burbuja-mia' : 'burbuja-suya'}>
      <div className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm shadow-sm ${color} ${cola}`}>
        <p className="whitespace-pre-wrap break-words">{cuerpo}</p>
        {nota ? <p className={`mt-1 text-xs ${mio ? 'text-white/80' : 'text-slate-500'}`}>{nota}</p> : null}
        {ultimoDelGrupo ? (
          <p className={`mt-1 flex items-center justify-end gap-1 text-[11px] ${mio ? 'text-white/80' : 'text-slate-500'}`}>
            {hora}
            {mio ? (
              <span className="inline-flex items-center" aria-label={leido ? 'Leído' : 'Enviado'} title={leido ? 'Leído' : 'Enviado'}>
                <Icon name={leido ? 'done_all' : 'check'} className="text-[14px]" />
              </span>
            ) : null}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function Escribiendo() {
  return (
    <div className="mt-2 flex justify-start" aria-live="polite">
      <div className="flex items-center gap-2 rounded-2xl rounded-bl-md bg-white px-4 py-2 text-xs text-slate-500 ring-1 ring-slate-200">
        <span className="flex gap-1" aria-hidden>
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
        </span>
        Atlas está escribiendo…
      </div>
    </div>
  );
}

/** Lo que más le pasa a un comercio. Un clic escribe la primera frase; se completa con el caso. */
export const SUGERENCIAS_DEL_COMERCIO = [
  'Un cliente no puede pagar con Atlas',
  'Tengo una duda sobre una liquidación',
  'El QR de cobro no funciona',
  'Necesito ayuda con Gestión POS',
] as const;

export function InicioDeChat({ onElegir }: { onElegir: (texto: string) => void }) {
  return (
    <div className="m-auto flex max-w-md flex-col items-center gap-2 py-6 text-center" data-testid="inicio-de-chat">
      <div className="mb-1 flex h-14 w-14 items-center justify-center rounded-full bg-primary-soft text-primary">
        <Icon name="forum" className="text-[28px]" />
      </div>
      <p className="text-base font-semibold text-slate-900">¿En qué te ayudamos?</p>
      <p className="text-sm text-slate-600">
        Cuéntanos qué pasa con tu negocio. Te respondemos por aquí mismo y la conversación queda en tus casos.
      </p>
      <p className="mt-3 text-[11px] font-medium uppercase tracking-wide text-slate-500">Temas frecuentes</p>
      <div className="flex w-full flex-col gap-2">
        {SUGERENCIAS_DEL_COMERCIO.map((texto) => (
          <button
            key={texto}
            type="button"
            onClick={() => onElegir(texto)}
            className="flex w-full items-center justify-between gap-2 rounded-md bg-white px-4 py-3 text-left text-sm text-slate-900 ring-1 ring-slate-200 transition hover:bg-primary-wash hover:ring-primary/30"
            aria-label={`Empezar con: ${texto}`}
          >
            {texto}
            <Icon name="chevron_right" className="text-[18px] text-slate-400" />
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * El compositor: campo que crece y botón redondo. Enter envía; Shift+Enter salta de línea.
 * El nombre accesible del campo es «Tu mensaje» y el del botón «Enviar», los mismos de antes.
 */
export function CompositorDeChat({
  texto,
  onChange,
  onEnviar,
  deshabilitado = false,
}: {
  texto: string;
  onChange: (valor: string) => void;
  onEnviar: () => void;
  deshabilitado?: boolean;
}) {
  const campo = useRef<HTMLTextAreaElement>(null);
  const puedeEnviar = texto.trim().length > 0 && !deshabilitado;
  const alTeclear = (evento: KeyboardEvent<HTMLTextAreaElement>) => {
    if (evento.key === 'Enter' && !evento.shiftKey && !evento.nativeEvent.isComposing) {
      evento.preventDefault();
      if (puedeEnviar) onEnviar();
    }
  };
  return (
    <div className="border-t border-slate-200 bg-white px-4 py-3">
      <div className="flex items-end gap-2">
        <label htmlFor="mensajeDeSoporte" className="sr-only">
          Tu mensaje
        </label>
        <textarea
          ref={campo}
          id="mensajeDeSoporte"
          name="mensajeDeSoporte"
          rows={1}
          value={texto}
          disabled={deshabilitado}
          onChange={(evento) => onChange(evento.target.value)}
          onKeyDown={alTeclear}
          placeholder={deshabilitado ? 'La conversación está cerrada' : 'Escribe tu mensaje…'}
          title="Tu respuesta o aclaración para el equipo de soporte. Enter envía; Shift+Enter salta de línea."
          className="max-h-40 min-h-[44px] flex-1 resize-none rounded-[22px] border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/20 disabled:opacity-60 [field-sizing:content]"
        />
        <button
          type="button"
          onClick={onEnviar}
          disabled={!puedeEnviar}
          aria-label="Enviar"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary transition hover:bg-primary-container disabled:bg-slate-200 disabled:text-slate-400"
        >
          <Icon name="send" className="text-[20px]" />
        </button>
      </div>
      <p className="mt-2 flex items-center justify-center gap-1 text-[11px] text-slate-500">
        <Icon name="lock" className="text-[13px]" />
        Nadie de Atlas te pedirá tu contraseña ni los códigos de verificación.
      </p>
    </div>
  );
}
