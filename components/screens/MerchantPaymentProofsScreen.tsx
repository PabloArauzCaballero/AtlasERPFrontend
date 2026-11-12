'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AtlasButton } from '@/components/atlas/AtlasButton';
import { FormField } from '@/components/atlas/FormField';
import { Icon } from '@/components/atlas/Icon';
import { OrigenDeCaja } from '@/components/atlas/OrigenDeCaja';
import { InlineNotice } from '@/components/atlas/InlineNotice';
import { Panel } from '@/components/atlas/Panel';
import { StatusPill } from '@/components/atlas/StatusPill';
import { WorkspaceHeader } from '@/components/atlas/WorkspaceHeader';
import { BotonPdf } from '@/components/atlas/BotonPdf';
import { tablaPdf } from '@/lib/pdf';
import { formatBob } from '@/lib/formatters';
import { merchantCreditService } from '@/services/merchantCreditService';
import type { ComprobanteDePago } from '@/services/merchantCreditService';
import { SIN_EXPEDIENTE } from '@/lib/avisosDelComercio';
import { MerchantDownPaymentsPanel } from './MerchantDownPaymentsPanel';
import type { PagoInicial } from '@/services/merchantCreditService';
import { useSondeo } from '@/hooks/useSondeo';
import { crearDetectorDeNuevos } from '@/lib/sondeo';
import { CODIGOS_DE_LISTA_VIEJA, codigoDeNegocio, mensajeParaComercio } from '@/lib/mensajesDelComercio';

const MOTIVOS = [
  { label: '— Elige el motivo —', value: '' },
  { label: 'No encuentro la transferencia en mi cuenta', value: 'NO_APARECE_EN_CUENTA' },
  { label: 'El importe no coincide', value: 'IMPORTE_NO_COINCIDE' },
  { label: 'El comprobante no se lee o no corresponde', value: 'COMPROBANTE_ILEGIBLE' },
  { label: 'La transferencia es de otra operación', value: 'OTRA_OPERACION' },
  { label: 'Otro', value: 'OTRO' },
];

/**
 * El comprobante, en pantalla.
 *
 * Sin esto el comercio decidía a ciegas: la tarjeta enseñaba el importe que el cliente DECLARÓ y la
 * referencia que el cliente ESCRIBIÓ —las dos las teclea la parte interesada— y ninguna prueba de
 * la transferencia. «Verificar y dar por pagado» registra un pago real contra el préstamo, así que
 * pulsarlo sin ver el papel no es verificar: es creer.
 *
 * La imagen se trae por `fetch` autenticado y se pinta desde un blob local. Un `<img src>` apuntando
 * a la ruta del backend daría 401 —una etiqueta `<img>` no manda `Authorization` y el token de este
 * portal vive en memoria, no en cookie— y se vería como una imagen rota, que es exactamente el fallo
 * que se lee como «el cliente no subió nada».
 */
/* A nivel de módulo a propósito: un valor por defecto escrito en el parámetro sería una función NUEVA en cada render y el efecto volvería a pedir la imagen sin parar. */
const imagenDeCuota = (socio: string, id: string) => merchantCreditService.comprobanteImagen(socio, id);

export function ComprobanteImagen({
  partnerId,
  claimId,
  cargar = imagenDeCuota,
}: Readonly<{ partnerId: string; claimId: string; /** De dónde sale la imagen: por defecto el aviso de una cuota; el pago inicial pasa la suya. */ cargar?: (partnerId: string, id: string) => Promise<string> }>) {
  const [url, setUrl] = useState<string | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);
  const [ampliado, setAmpliado] = useState(false);
  /* La URL viva, para revocarla al desmontar sin que el efecto dependa del estado que él mismo fija. */
  const vigente = useRef<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    setUrl(null);
    setFallo(null);
    cargar(partnerId, claimId)
      .then((blobUrl) => {
        if (cancelado) {
          URL.revokeObjectURL(blobUrl);
          return;
        }
        vigente.current = blobUrl;
        setUrl(blobUrl);
      })
      .catch((error: unknown) => {
        if (!cancelado) setFallo(mensajeParaComercio(error, 'No se pudo cargar el comprobante.'));
      });
    return () => {
      cancelado = true;
      if (vigente.current) {
        URL.revokeObjectURL(vigente.current);
        vigente.current = null;
      }
    };
  }, [partnerId, claimId, cargar]);

  if (fallo) {
    return (
      <div data-testid={`comprobante-error-${claimId}`}>
        <InlineNotice tone="warning" title="No se pudo mostrar el comprobante">
          {fallo} Puedes rechazarlo indicando que el comprobante no se lee.
        </InlineNotice>
      </div>
    );
  }

  if (!url) {
    return <div className="h-40 animate-pulse rounded-md bg-slate-100" aria-label="Cargando comprobante" />;
  }

  return (
    <figure className="space-y-2">
      <button
        type="button"
        onClick={() => setAmpliado((valor) => !valor)}
        className="block w-full overflow-hidden rounded-md border border-slate-200 bg-slate-50 p-2 text-left transition hover:border-slate-400"
        title={ampliado ? 'Reducir' : 'Ampliar'}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- es un blob local: `next/image` exige una URL que el optimizador pueda buscar. */}
        <img
          src={url}
          alt={`Comprobante de transferencia ${claimId}`}
          data-testid={`comprobante-imagen-${claimId}`}
          className={ampliado ? 'mx-auto max-h-[36rem] w-auto' : 'mx-auto max-h-56 w-auto'}
        />
      </button>
      <figcaption className="text-xs text-slate-500">
        {ampliado ? 'Pulsa la imagen para reducirla.' : 'Pulsa la imagen para ampliarla.'} Comprueba el monto, la fecha y la
        cuenta de destino antes de confirmar.
      </figcaption>
    </figure>
  );
}

interface MerchantPaymentProofsScreenProps {
  /**
   * Dentro de una pestaña de «Gestión POS»: sin cabecera propia y con el expediente ya resuelto
   * por la pantalla que la contiene. Suelta, la pantalla sigue sabiendo resolverlo ella misma.
   */
  embedded?: boolean | undefined;
  partnerId?: string | undefined;
  nombre?: string | undefined;
  /** Cuántos esperan confirmación, para el contador de la pestaña. */
  onCount?: ((total: number) => void) | undefined;
  /** Comprobantes de cuota que llegaron desde la última lectura. */
  onNuevos?: ((nuevos: ComprobanteDePago[]) => void) | undefined;
  /** Pagos iniciales que llegaron desde la última lectura. */
  onNuevosIniciales?: ((nuevos: PagoInicial[]) => void) | undefined;
}

/**
 * Los comprobantes de transferencia que esperan la palabra del comercio.
 *
 * El cliente paga al QR bancario del comercio, así que ese dinero entra en SU cuenta y no en la de
 * Atlas. Es el único que puede mirar su extracto y decir si llegó: por eso la cuota no se da por
 * pagada hasta que él lo confirma, y por eso confirmarlo es lo que registra el pago de verdad.
 *
 * Rechazar exige motivo. Quien queda sin su pago reconocido tiene derecho a saber por qué, y sin
 * motivo no hay forma de distinguir un error del cliente de uno del comercio.
 */
export function MerchantPaymentProofsScreen({ embedded = false, partnerId: partnerIdProp, nombre: nombreProp, onCount, onNuevos, onNuevosIniciales }: MerchantPaymentProofsScreenProps = {}) {
  const [partnerIdPropio, setPartnerIdPropio] = useState('');
  const [nombrePropio, setNombrePropio] = useState('');
  const partnerId = partnerIdProp ?? partnerIdPropio;
  const nombre = nombreProp ?? nombrePropio;
  const [comprobantes, setComprobantes] = useState<ComprobanteDePago[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ tono: 'success' | 'danger'; texto: string } | null>(null);
  const [rechazando, setRechazando] = useState<string | null>(null);
  const [motivo, setMotivo] = useState('');
  const [ocupado, setOcupado] = useState<string | null>(null);

  const detectarNuevos = useRef(crearDetectorDeNuevos<ComprobanteDePago>((comprobante) => comprobante.claimId));

  const recargar = useCallback(
    /** `silencioso`: la relectura periódica no pinta «Cargando…» y deja que el sondeo espere más si falla. */
    async (id: string, silencioso = false) => {
      if (!silencioso) setCargando(true);
      try {
        const resultado = await merchantCreditService.listarComprobantes(id);
        const filas = resultado.claims ?? [];
        setComprobantes(filas);
        onCount?.(filas.length);
        setError(null);
        const nuevos = detectarNuevos.current(filas);
        if (nuevos.length) onNuevos?.(nuevos);
      } catch (fallo) {
        setError(mensajeParaComercio(fallo, 'No fue posible leer los comprobantes. Volvemos a intentarlo solos en unos segundos.'));
        if (silencioso) throw fallo;
      } finally {
        if (!silencioso) setCargando(false);
      }
    },
    [onCount, onNuevos],
  );

  /* Quien avisó que transfirió puede estar esperando en la caja: se relee sola mientras se ve. */
  useSondeo(() => recargar(partnerId, true), { activo: Boolean(partnerId) });

  /* Ver `MerchantRequestsScreen`: embebida, el expediente lo resuelve una sola vez el padre. */
  useEffect(() => {
    if (partnerIdProp !== undefined) {
      if (partnerIdProp) void recargar(partnerIdProp);
      /*
       * Cadena vacía = quien contiene la pantalla resolvió que NO hay expediente. Sin esto la cola
       * se quedaba en «Cargando…» para siempre, que se lee como «el sistema está pensando» cuando
       * lo que pasa es que no hay nada que pedir. El motivo lo explica el aviso de la cabecera.
       */
      else setCargando(false);
      return;
    }
    let cancelado = false;
    merchantCreditService
      .misExpedientes()
      .then((resultado) => {
        if (cancelado) return;
        const perfiles = resultado.profiles ?? [];
        const propio = perfiles.find((perfil) => perfil.status === 'approved') ?? perfiles[0];
        if (!propio) {
          setError(SIN_EXPEDIENTE);
          setCargando(false);
          return;
        }
        setPartnerIdPropio(propio.partnerId);
        setNombrePropio(propio.tradeName ?? propio.legalName ?? '');
        void recargar(propio.partnerId);
      })
      .catch((fallo: unknown) => {
        if (cancelado) return;
        setError(mensajeParaComercio(fallo, 'No fue posible identificar tu comercio.'));
        setCargando(false);
      });
    return () => { cancelado = true; };
  }, [partnerIdProp, recargar]);

  async function decidir(comprobante: ComprobanteDePago, verificado: boolean) {
    if (!verificado && !motivo) return;
    setOcupado(comprobante.claimId);
    try {
      await merchantCreditService.verificarComprobante(partnerId, comprobante.claimId, {
        verified: verificado,
        ...(verificado ? {} : { reason: motivo }),
      });
      setAviso({
        tono: verificado ? 'success' : 'danger',
        texto: verificado
          ? `Confirmaste el pago de ${formatBob(Number(comprobante.claimedAmount))}. La cuota queda saldada.`
          : `Rechazaste el comprobante ${comprobante.claimCode}.`,
      });
      setRechazando(null);
      setMotivo('');
      await recargar(partnerId);
    } catch (fallo) {
      setAviso({ tono: 'danger', texto: mensajeParaComercio(fallo, 'No fue posible registrar la decisión. Vuelve a intentarlo.') });
      const codigo = codigoDeNegocio(fallo);
      if (codigo && CODIGOS_DE_LISTA_VIEJA.has(codigo)) void recargar(partnerId).catch(() => undefined);
    } finally {
      setOcupado(null);
    }
  }

  const acciones = (
          <>
            <BotonPdf
              label="Descargar PDF"
              data-testid="pdf-comprobantes"
              disabled={cargando || !comprobantes.length}
              documento={() => ({
                title: 'Comprobantes por verificar',
                subtitle: nombre ? `Portal del comercio · ${nombre}` : 'Portal del comercio',
                summary: [{ label: 'Comprobantes', value: comprobantes.length }],
                sections: [
                  {
                    title: 'Comprobantes recibidos',
                    description: 'Transferencias que los clientes declaran haber hecho a la cuenta del comercio.',
                    table: tablaPdf(
                      [
                        { key: 'claimCode', label: 'Código' },
                        { key: 'submittedAt', label: 'Avisado' },
                        { key: 'claimedAmount', label: 'Importe' },
                        { key: 'payerReference', label: 'Referencia' },
                        { key: 'status', label: 'Estado' },
                        { key: 'decidedAt', label: 'Resuelto' },
                      ],
                      comprobantes as unknown as Array<Record<string, unknown>>,
                    ),
                  },
                ],
              })}
            />
            <AtlasButton variant="secondary" icon="refresh" disabled={!partnerId} loading={cargando} onClick={() => partnerId && void recargar(partnerId)}>Actualizar</AtlasButton>
          </>
  );

  return (
    <div className="space-y-5">
      {embedded ? null : (
        <WorkspaceHeader
          breadcrumbs={[{ label: 'Portal comercio' }, { label: 'Comprobantes' }]}
          title="Comprobantes por verificar"
          description="Tus clientes avisaron que transfirieron a tu cuenta. Confirma lo que ya viste entrar; la cuota se da por pagada sólo entonces."
          actions={acciones}
        />
      )}

      {error ? <InlineNotice tone="danger">{error}</InlineNotice> : null}
      {aviso ? <InlineNotice tone={aviso.tono}>{aviso.texto}</InlineNotice> : null}

      {partnerId ? <MerchantDownPaymentsPanel partnerId={partnerId} onNuevos={onNuevosIniciales} /> : null}

      <Panel
        data-tutorial-id="comprobantes-cola"
        title="Esperando tu confirmación"
        description="Comprueba en tu extracto que el dinero entró antes de confirmar."
        icon="fact_check"
        action={embedded ? acciones : undefined}
      >
        {cargando ? (
          <p className="py-8 text-center text-xs text-slate-500">Cargando…</p>
        ) : comprobantes.length === 0 ? (
          <div className="py-10 text-center">
            <Icon name="check_circle" className="text-[28px] text-emerald-600" />
            <p className="mt-2 text-xs font-semibold">No hay comprobantes esperando</p>
            <p className="mt-1 text-xs text-slate-500">Cuando un cliente avise que transfirió, aparecerá aquí con su comprobante.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {comprobantes.map((comprobante) => (
              <article key={comprobante.claimId} className="rounded-md border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold">{comprobante.claimCode}</h3>
                      <StatusPill tone="warning">POR VERIFICAR</StatusPill>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      Avisado el {new Date(comprobante.submittedAt).toLocaleString('es-BO')}
                    </p>
                    {/* La caja de la compra de este crédito: dos cuotas iguales pueden ser de cajas distintas. */}
                    <OrigenDeCaja origen={comprobante} />
                    <p className="mt-1 text-xs text-slate-600">
                      Referencia del banco: <b>{comprobante.payerReference ?? 'sin referencia'}</b>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold text-slate-500">Importe declarado</p>
                    <p className="text-2xl font-semibold">{formatBob(Number(comprobante.claimedAmount))}</p>
                    <p className="text-xs text-slate-500">{comprobante.currencyCode}</p>
                  </div>
                </div>

                {comprobante.proofEvidenceId ? (
                  <div className="mt-4">
                    <ComprobanteImagen partnerId={partnerId} claimId={comprobante.claimId} />
                  </div>
                ) : (
                  <div className="mt-4">
                    <InlineNotice tone="warning" title="Sin comprobante adjunto">
                      El cliente avisó del pago pero no subió ninguna imagen. Búscalo en tu extracto por la referencia
                      antes de confirmar.
                    </InlineNotice>
                  </div>
                )}

                {rechazando === comprobante.claimId ? (
                  <div className="mt-4 space-y-3 rounded-md bg-slate-50 p-3">
                    <FormField tooltip="Por qué se rechaza el comprobante; el cliente lo lee."
                      kind="select"
                      label="Motivo del rechazo"
                      name="reason"
                      required
                      value={motivo}
                      onChange={(evento) => setMotivo(evento.target.value)}
                      options={MOTIVOS}
                      hint="El cliente verá que su aviso fue rechazado; el motivo es lo que le permite corregirlo."
                    />
                    <div className="flex gap-2">
                      <AtlasButton variant="danger" icon="close" disabled={!motivo} loading={ocupado === comprobante.claimId} onClick={() => void decidir(comprobante, false)}>Confirmar rechazo</AtlasButton>
                      <AtlasButton variant="secondary" onClick={() => { setRechazando(null); setMotivo(''); }}>Cancelar</AtlasButton>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 flex gap-2">
                    <AtlasButton variant="success" icon="check" loading={ocupado === comprobante.claimId} onClick={() => void decidir(comprobante, true)}>Verificar y dar por pagado</AtlasButton>
                    <AtlasButton variant="secondary" icon="close" onClick={() => setRechazando(comprobante.claimId)}>Rechazar</AtlasButton>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </Panel>

      <InlineNotice tone="info" title="Por qué lo confirmas tú">
        El cliente transfiere al QR bancario de tu comercio, así que ese dinero entra en tu cuenta y
        no en la de Cuotea. Un comprobante es evidencia de que alguien hizo una transferencia, no de
        que tú la recibiste: por eso la cuota se salda cuando tú lo ves en tu extracto.
      </InlineNotice>
    </div>
  );
}
