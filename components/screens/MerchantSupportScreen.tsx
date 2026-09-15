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
  type MotivoDeSoporte,
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
  const [motivos, setMotivos] = useState<MotivoDeSoporte[]>([]);
  /** `null` = todavía no se pulsó «Hablar»; un valor = el nivel del árbol que se está viendo. */
  const [eligiendo, setEligiendo] = useState<MotivoDeSoporte[] | null>(null);
  /** El formulario «Abrir caso» (un caso escrito, sin chat) y el caso abierto en detalle. */
  const [abriendoCaso, setAbriendoCaso] = useState(false);
  const [nuevoCaso, setNuevoCaso] = useState({ categoryCode: '', title: '', description: '' });
  const [enviandoCaso, setEnviandoCaso] = useState(false);
  const [casoAbierto, setCasoAbierto] = useState<CasoDeSoporte | null>(null);
  const [cerrando, setCerrando] = useState(false);
  const finDelHilo = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelado = false;
    merchantCreditService
      .misExpedientes()
      .then(async ({ profiles }) => {
        const propio = profiles[0];
        if (cancelado || !propio) return;
        setPartnerId(propio.partnerId);
        /*
          El catálogo se pide junto a los casos, y su fallo se DICE.

          Antes su `catch` devolvía una lista vacía «para no tumbar la pantalla», y eso escondió
          durante semanas que la pasarela del ERP no reenviaba `merchant/support/categories`: el
          panel «¿Sobre qué es?» salía siempre vacío y toda conversación nacía sin clasificar. Se
          puede seguir hablando sin motivos, pero el aviso queda a la vista para quien lo mire.
        */
        const [{ cases }, catalogo] = await Promise.all([
          supportService.listarCasos(propio.partnerId),
          supportService.listarMotivos().catch((fallo: unknown) => {
            if (!cancelado) setError('No pudimos cargar los motivos de soporte; puedes hablar igual y lo clasificamos nosotros.');
            console.warn('merchant/support/categories', fallo);
            return { categories: [] as MotivoDeSoporte[] };
          }),
        ]);
        if (cancelado) return;
        setCasos(cases);
        setMotivos(catalogo.categories);
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

  /**
   * Abrir la conversación, con el motivo si el comercio eligió uno.
   *
   * El motivo no es burocracia: decide a qué cola entra —conciliación y facturación no las atiende
   * la primera línea— y con qué plazo se mide. Sin él todo caía en `partner_l1` y el caso nacía sin
   * clasificar, así que el comercio esperaba más y nadie podía contar por qué escriben.
   */
  const abrirConversacion = async (categoryCode?: string) => {
    if (!partnerId) return;
    setEligiendo(null);
    try {
      const canal = await supportService.abrirConversacion({
        partnerProfileId: partnerId,
        ...(categoryCode ? { categoryCode } : {}),
      });
      setChannelId(canal.channelId);
      setError(canal.agentsAvailable === 0 ? 'No hay agentes libres ahora. Deja tu mensaje y te respondemos.' : null);
    } catch {
      setError('No pudimos abrir la conversación.');
    }
  };

  /**
   * Pulsar «Hablar» abre el paso del motivo; no abre la conversación todavía.
   *
   * Si el catálogo no cargó, se salta el paso y se habla directamente: preguntar por una lista vacía
   * sería un callejón sin salida justo cuando alguien necesita ayuda.
   */
  const empezar = () => {
    if (motivos.length === 0) {
      void abrirConversacion();
      return;
    }
    setEligiendo(motivos);
  };

  /**
   * Un motivo con submotivos baja un nivel; uno sin ellos abre la conversación.
   *
   * No se obliga a bajar hasta la hoja: el motivo de primer nivel ya enruta y ya se puede contar, y
   * exigir dos elecciones para pedir ayuda es fricción que acaba en una llamada al ejecutivo, donde
   * nada queda registrado.
   */
  const elegirMotivo = (motivo: MotivoDeSoporte) => {
    if (motivo.subcategories && motivo.subcategories.length > 0) {
      setEligiendo(motivo.subcategories);
      return;
    }
    void abrirConversacion(motivo.categoryCode);
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

  const recargarCasos = useCallback(async () => {
    if (!partnerId) return;
    const { cases } = await supportService.listarCasos(partnerId);
    setCasos(cases);
  }, [partnerId]);

  /**
   * Un caso ESCRITO, sin chat: para lo que no urge y conviene que quede documentado de entrada.
   *
   * `abrirCaso` existía en el servicio y nadie lo llamaba: el comercio sólo podía chatear. Un caso
   * nace con motivo, título y descripción, y se sigue desde la lista de abajo.
   */
  const enviarCaso = async () => {
    if (!partnerId || enviandoCaso) return;
    setEnviandoCaso(true);
    setError(null);
    try {
      await supportService.abrirCaso({ ...nuevoCaso, partnerProfileId: partnerId });
      setAbriendoCaso(false);
      setNuevoCaso({ categoryCode: '', title: '', description: '' });
      await recargarCasos();
    } catch {
      setError('No pudimos abrir el caso. Revisa el motivo y el título e inténtalo de nuevo.');
    } finally {
      setEnviandoCaso(false);
    }
  };

  /** El detalle de un caso: lo que el servidor sabe de él, no sólo la fila de la lista. */
  const abrirDetalle = async (caso: CasoDeSoporte) => {
    try {
      setCasoAbierto(await supportService.verCaso(caso.caseId));
    } catch {
      setError('No pudimos cargar el detalle del caso.');
    }
  };

  /**
   * Cerrar la conversación desde este lado.
   *
   * Existía en el servicio (`cerrarConversacion`) y no había botón: la única salida era que el
   * agente la cerrara o abandonarla. Cerrarla es un acto del comercio y queda en su historial.
   */
  const cerrarConversacion = async () => {
    if (!channelId || cerrando) return;
    setCerrando(true);
    try {
      await supportService.cerrarConversacion(channelId);
      setChannelId(null);
      setMensajes([]);
      await recargarCasos();
    } catch {
      setError('No pudimos cerrar la conversación.');
    } finally {
      setCerrando(false);
    }
  };

  const aplanar = (lista: MotivoDeSoporte[], prefijo = ''): Array<{ label: string; value: string }> =>
    lista.flatMap((motivo) => [
      { label: `${prefijo}${motivo.label}`, value: motivo.categoryCode },
      ...aplanar(motivo.subcategories ?? [], `${prefijo}${motivo.label} › `),
    ]);

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
          channelId ? (
            <AtlasButton variant="secondary" onClick={() => void cerrarConversacion()} loading={cerrando}>
              Cerrar conversación
            </AtlasButton>
          ) : (
            <>
              <AtlasButton variant="secondary" onClick={() => setAbriendoCaso((valor) => !valor)} disabled={!partnerId}>
                Abrir un caso
              </AtlasButton>
              <AtlasButton onClick={empezar} disabled={!partnerId}>
                Hablar con soporte
              </AtlasButton>
            </>
          )
        }
      />

      {error ? <InlineNotice tone="warning">{error}</InlineNotice> : null}

      {abriendoCaso ? (
        <Panel title="Abrir un caso" description="Cuéntanos qué pasa por escrito; lo seguimos desde tus casos.">
          <form
            className="grid gap-4"
            data-testid="formulario-abrir-caso"
            onSubmit={(evento) => {
              evento.preventDefault();
              void enviarCaso();
            }}
          >
            <FormField
              kind="select"
              label="Motivo"
              name="motivoDelCaso"
              required
              value={nuevoCaso.categoryCode}
              onChange={(evento) => setNuevoCaso((previo) => ({ ...previo, categoryCode: evento.target.value }))}
              options={aplanar(motivos)}
              hint={motivos.length === 0 ? 'El catálogo de motivos no cargó: vuelve a intentarlo o habla con soporte.' : undefined}
            />
            <FormField
              label="Título"
              name="tituloDelCaso"
              required
              value={nuevoCaso.title}
              onChange={(evento) => setNuevoCaso((previo) => ({ ...previo, title: evento.target.value }))}
              placeholder="Qué pasa, en una línea"
            />
            <FormField
              kind="textarea"
              label="Descripción"
              name="descripcionDelCaso"
              required
              value={nuevoCaso.description}
              onChange={(evento) => setNuevoCaso((previo) => ({ ...previo, description: evento.target.value }))}
              placeholder="Cuándo empezó, qué esperabas y qué pasó."
            />
            <div className="flex justify-end gap-3">
              <AtlasButton variant="secondary" onClick={() => setAbriendoCaso(false)} disabled={enviandoCaso}>
                Cancelar
              </AtlasButton>
              <AtlasButton
                type="submit"
                loading={enviandoCaso}
                disabled={!nuevoCaso.categoryCode || nuevoCaso.title.trim().length < 3 || nuevoCaso.description.trim().length < 10}
              >
                Enviar el caso
              </AtlasButton>
            </div>
          </form>
        </Panel>
      ) : null}

      {casoAbierto ? (
        <Panel title={casoAbierto.title} description={`${casoAbierto.caseNumber} · ${casoAbierto.status}`}>
          <dl className="grid gap-2 text-sm sm:grid-cols-2" data-testid="detalle-del-caso">
            <div><dt className="text-xs text-slate-500">Tipo</dt><dd>{casoAbierto.caseType}</dd></div>
            <div><dt className="text-xs text-slate-500">Dominio</dt><dd>{casoAbierto.domain}</dd></div>
            <div><dt className="text-xs text-slate-500">Abierto</dt><dd>{new Date(casoAbierto.openedAt).toLocaleString('es-BO')}</dd></div>
            <div><dt className="text-xs text-slate-500">Última actividad</dt><dd>{new Date(casoAbierto.lastActivityAt).toLocaleString('es-BO')}</dd></div>
            <div><dt className="text-xs text-slate-500">Primera respuesta</dt><dd>{casoAbierto.firstResponseAt ? new Date(casoAbierto.firstResponseAt).toLocaleString('es-BO') : 'Todavía no'}</dd></div>
            <div><dt className="text-xs text-slate-500">Resuelto</dt><dd>{casoAbierto.resolvedAt ? new Date(casoAbierto.resolvedAt).toLocaleString('es-BO') : 'Todavía no'}</dd></div>
            {casoAbierto.summary ? <div className="sm:col-span-2"><dt className="text-xs text-slate-500">Resumen</dt><dd className="whitespace-pre-wrap">{casoAbierto.summary}</dd></div> : null}
          </dl>
          <div className="mt-4 flex justify-end">
            <AtlasButton variant="ghost" onClick={() => setCasoAbierto(null)}>Cerrar el detalle</AtlasButton>
          </div>
        </Panel>
      ) : null}

      {eligiendo ? (
        <Panel title="¿Sobre qué es?" description="Así te atiende quien más sabe del tema.">
          {/*
            Identificador estable para la prueba de punta a punta.

            Sin él, «pulsa el primer motivo» se escribe como «pulsa el primer botón que no sea
            Hablar con soporte», que en un portal con barra de navegación puede caer en cualquier
            sitio. Un ancla explícita dice qué se está señalando.
          */}
          <ul className="divide-y divide-slate-200" data-testid="motivos-soporte">
            {eligiendo.map((motivo) => (
              <li key={motivo.categoryCode}>
                <button
                  type="button"
                  className="w-full px-1 py-3 text-left hover:bg-slate-50"
                  onClick={() => elegirMotivo(motivo)}
                >
                  <span className="block text-sm font-medium text-slate-900">{motivo.label}</span>
                  {motivo.description ? (
                    <span className="block text-xs text-slate-500">{motivo.description}</span>
                  ) : null}
                </button>
              </li>
            ))}
            {/*
              La salida sin motivo se queda, y a la vista. Esconderla convertiría el catálogo en un
              peaje: quien no encuentra su caso en la lista se quedaría sin poder escribir, que es el
              fallo que este paso pretende evitar.
            */}
            <li>
              <button
                type="button"
                className="w-full px-1 py-3 text-left hover:bg-slate-50"
                onClick={() => void abrirConversacion()}
              >
                <span className="block text-sm font-medium text-slate-900">
                  Ninguno de estos / prefiero contarlo
                </span>
                <span className="block text-xs text-slate-500">
                  Abrimos la conversación y la clasificamos nosotros.
                </span>
              </button>
            </li>
          </ul>
        </Panel>
      ) : null}

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
                <AtlasButton variant="ghost" onClick={() => void abrirDetalle(caso)}>
                  Ver detalle
                </AtlasButton>
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
