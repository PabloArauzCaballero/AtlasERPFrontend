'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AtlasButton } from '@/components/atlas/AtlasButton';
import { FormField } from '@/components/atlas/FormField';
import { InlineNotice } from '@/components/atlas/InlineNotice';
import { Panel } from '@/components/atlas/Panel';
import { StatusPill } from '@/components/atlas/StatusPill';
import { WorkspaceHeader } from '@/components/atlas/WorkspaceHeader';
import { merchantCreditService } from '@/services/merchantCreditService';
import {
  supportService,
  suscribirseAlChat,
  type CasoDeSoporte,
  type EstadoDeLectura,
  type MensajeDeSoporte,
} from '@/services/supportService';

/**
 * Soporte del comercio.
 *
 * ## Por qué el chat vive aquí y no en un widget flotante
 *
 * Porque lo que el comercio consulta —una conciliación que no cuadra, un QR que no carga— exige
 * mirar sus propios datos mientras habla. Un widget que tapa la pantalla obliga a elegir entre ver
 * el problema y describirlo.
 *
 * ## Por qué el hilo es en vivo y no un refresco
 *
 * El navegador sostiene la conexión sin coste mientras la pestaña está abierta, que es justo cómo
 * trabaja un comercio: la deja puesta toda la mañana. Con refresco cada N segundos, la respuesta del
 * agente tarda en aparecer lo que tarde el próximo ciclo, y esa espera es exactamente lo que hace
 * que la gente escriba «hola?» tres veces.
 */
function nuevoClientMessageId(): string {
  return `erp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function MerchantSupportScreen() {
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [casos, setCasos] = useState<CasoDeSoporte[]>([]);
  const [channelId, setChannelId] = useState<string | null>(null);
  const [mensajes, setMensajes] = useState<MensajeDeSoporte[]>([]);
  const [readState, setReadState] = useState<EstadoDeLectura[]>([]);
  const [texto, setTexto] = useState('');
  const [escribiendo, setEscribiendo] = useState(false);
  const [conectado, setConectado] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const finDelHilo = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelado = false;
    merchantCreditService
      .misExpedientes()
      .then(async ({ profiles }) => {
        const propio = profiles[0];
        if (cancelado || !propio) return;
        setPartnerId(propio.partnerId);
        const { cases } = await supportService.listarCasos(propio.partnerId);
        if (!cancelado) setCasos(cases);
      })
      .catch(() => {
        if (!cancelado) setError('No pudimos cargar tus casos de soporte.');
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });
    return () => {
      cancelado = true;
    };
  }, []);

  const cargarConversacion = useCallback(async (canal: string) => {
    const transcripcion = await supportService.leerConversacion(canal);
    setMensajes(transcripcion.messages);
    setReadState(transcripcion.readState);
    const ultima = transcripcion.messages.at(-1)?.sequence;
    if (ultima) void supportService.marcarLeido(canal, ultima).catch(() => undefined);
  }, []);

  /**
   * El hilo en vivo.
   *
   * `message.created` inserta sin volver a pedir la conversación entera; `agent.typing` enciende el
   * aviso un par de segundos. La suscripción se cierra al cambiar de canal o al salir: dejarla viva
   * acumularía una conexión por cada navegación.
   */
  useEffect(() => {
    if (!channelId) return undefined;
    void cargarConversacion(channelId).catch(() => setError('No pudimos cargar la conversación.'));

    let temporizador: ReturnType<typeof setTimeout> | undefined;
    const cerrar = suscribirseAlChat(
      channelId,
      (evento) => {
        if (evento.type === 'message.created') {
          const llegado = evento.data as unknown as MensajeDeSoporte;
          setMensajes((previos) =>
            previos.some((mensaje) => mensaje.sequence === llegado.sequence) ? previos : [...previos, llegado],
          );
          void supportService.marcarLeido(channelId, String(llegado.sequence)).catch(() => undefined);
        }
        if (evento.type === 'agent.typing') {
          setEscribiendo(true);
          if (temporizador) clearTimeout(temporizador);
          temporizador = setTimeout(() => setEscribiendo(false), 3000);
        }
        if (evento.type === 'message.read') {
          const leido = evento.data as { actorType?: string; upToSequence?: string };
          setReadState((previos) =>
            previos.map((estado) =>
              estado.actorType === leido.actorType
                ? { ...estado, lastReadSequence: String(leido.upToSequence ?? estado.lastReadSequence) }
                : estado,
            ),
          );
        }
      },
      setConectado,
    );

    return () => {
      if (temporizador) clearTimeout(temporizador);
      cerrar();
    };
  }, [channelId, cargarConversacion]);

  useEffect(() => {
    finDelHilo.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes.length]);

  const abrirConversacion = async () => {
    if (!partnerId) return;
    try {
      const canal = await supportService.abrirConversacion({ partnerProfileId: partnerId });
      setChannelId(canal.channelId);
      setError(canal.agentsAvailable === 0 ? 'No hay agentes libres ahora. Deja tu mensaje y te respondemos.' : null);
    } catch {
      setError('No pudimos abrir la conversación.');
    }
  };

  const enviar = async () => {
    const cuerpo = texto.trim();
    if (!cuerpo || !channelId) return;
    setTexto('');
    try {
      const enviado = await supportService.enviarMensaje(channelId, { clientMessageId: nuevoClientMessageId(), body: cuerpo });
      setMensajes((previos) => (previos.some((m) => m.sequence === enviado.sequence) ? previos : [...previos, enviado]));
    } catch {
      setTexto(cuerpo);
      setError('No pudimos enviar tu mensaje.');
    }
  };

  /** El doble tic: sólo tiene sentido sobre lo que mandó este comercio. */
  const fueLeido = (mensaje: MensajeDeSoporte) =>
    mensaje.senderActorType === 'PARTNER_USER' &&
    readState.some((estado) => Number(estado.lastReadSequence) >= Number(mensaje.sequence));

  return (
    <div className="space-y-6">
      <WorkspaceHeader
        title="Soporte"
        description="Habla con Atlas y sigue tus casos abiertos."
        actions={
          channelId ? null : (
            <AtlasButton onClick={() => void abrirConversacion()} disabled={!partnerId}>
              Hablar con soporte
            </AtlasButton>
          )
        }
      />

      {error ? <InlineNotice tone="warning">{error}</InlineNotice> : null}

      {channelId ? (
        <Panel
          title="Conversación"
          description={conectado ? 'En vivo' : 'Reconectando…'}
        >
          <div className="flex h-[420px] flex-col gap-3 overflow-y-auto rounded-lg bg-slate-50 p-4">
            {mensajes.map((mensaje) => {
              const mio = mensaje.senderActorType === 'PARTNER_USER';
              const delSistema = mensaje.senderActorType === 'SYSTEM' || mensaje.visibility === 'SYSTEM';

              if (delSistema) {
                return (
                  <div key={mensaje.messageId} className="mx-auto max-w-[80%] rounded-lg bg-amber-50 p-3 text-xs text-amber-800 ring-1 ring-amber-200">
                    {mensaje.body}
                  </div>
                );
              }

              return (
                <div key={mensaje.messageId} className={mio ? 'flex justify-end' : 'flex justify-start'}>
                  <div className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ring-1 ${mio ? 'bg-emerald-50 text-slate-900 ring-emerald-200' : 'bg-white text-slate-900 ring-slate-200'}`}>
                    <p className="whitespace-pre-wrap">{mensaje.body}</p>
                    {mensaje.redacted ? (
                      <p className="mt-1 text-xs text-slate-500">Ocultamos un dato sensible por seguridad.</p>
                    ) : null}
                    <p className="mt-1 text-right text-[11px] text-slate-500">
                      {new Date(mensaje.createdAt).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}
                      {mio ? <span className="ml-2">{fueLeido(mensaje) ? 'Leído' : 'Enviado'}</span> : null}
                    </p>
                  </div>
                </div>
              );
            })}

            {escribiendo ? <p className="text-xs text-slate-500">Atlas está escribiendo…</p> : null}
            <div ref={finDelHilo} />
          </div>

          <div className="mt-4 flex items-end gap-3">
            <div className="flex-1">
              <FormField
                label="Tu mensaje"
                name="mensajeDeSoporte"
                value={texto}
                onChange={(evento) => {
                  setTexto(evento.target.value);
                  if (evento.target.value.length === 1 && channelId) {
                    void supportService.avisarEscribiendo(channelId).catch(() => undefined);
                  }
                }}
                placeholder="Escribe aquí…"
              />
            </div>
            <AtlasButton onClick={() => void enviar()} disabled={texto.trim().length === 0}>
              Enviar
            </AtlasButton>
          </div>
        </Panel>
      ) : null}

      <Panel title="Mis casos" description={cargando ? 'Cargando…' : `${casos.length} caso(s)`}>
        {casos.length === 0 && !cargando ? (
          <p className="text-sm text-slate-500">Todavía no abriste ningún caso. El botón de arriba abre una conversación.</p>
        ) : null}

        <ul className="divide-y divide-slate-200">
          {casos.map((caso) => (
            <li key={caso.caseId} className="flex items-center justify-between gap-4 py-3">
              <div>
                <p className="text-sm font-medium">{caso.title}</p>
                <p className="text-xs text-slate-500">
                  {caso.caseNumber} · abierto el {new Date(caso.openedAt).toLocaleDateString('es-BO')}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <StatusPill tone={caso.closedAt ? 'neutral' : caso.resolvedAt ? 'success' : 'info'}>{caso.status}</StatusPill>
                {caso.channels?.find((canal) => !['CLOSED', 'ABANDONED'].includes(canal.status)) ? (
                  <AtlasButton
                    variant="ghost"
                    onClick={() => {
                      const vivo = caso.channels?.find((canal) => !['CLOSED', 'ABANDONED'].includes(canal.status));
                      if (vivo) setChannelId(vivo.channelId);
                    }}
                  >
                    Ver conversación
                  </AtlasButton>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
