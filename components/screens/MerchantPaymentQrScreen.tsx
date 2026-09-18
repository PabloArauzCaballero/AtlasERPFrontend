'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AtlasButton } from '@/components/atlas/AtlasButton';
import { FormField } from '@/components/atlas/FormField';
import { Icon } from '@/components/atlas/Icon';
import { OptionSelect } from '@/components/atlas/OptionSelect';
import { InlineNotice } from '@/components/atlas/InlineNotice';
import { MetricCard } from '@/components/atlas/MetricCard';
import { Panel } from '@/components/atlas/Panel';
import { StatusPill } from '@/components/atlas/StatusPill';
import { WorkspaceHeader } from '@/components/atlas/WorkspaceHeader';
import { BotonPdf } from '@/components/atlas/BotonPdf';
import { tablaPdf } from '@/lib/pdf';
import { merchantCreditService } from '@/services/merchantCreditService';
import { partnerOnboardingService, uploadQrFile, type PartnerQrCode } from '@/services/partnerOnboardingService';
import { AVISO_SIN_QR, imagenTieneQr } from '@/lib/qrImagen';
import { useOptions } from '@/hooks/useOptions';
import { domainLoader } from '@/services/domains';
import { withEmpty } from '@/services/optionLoaders';

/**
 * Los estados del expediente en los que AtlasBackend admite subir o cambiar el QR
 * (`PAYMENT_QR_EDITABLE_STATUSES`). Fuera de ellos responde 422, y es mejor decirlo ANTES de que el
 * comercio gaste la subida que después con un error rojo.
 */
const ESTADOS_QUE_ADMITEN_QR = new Set(['draft', 'contact_verified', 'documents_submitted', 'approved']);

function motivoSinSubida(estadoExpediente: string): string | null {
  if (!estadoExpediente || ESTADOS_QUE_ADMITEN_QR.has(estadoExpediente)) return null;
  if (estadoExpediente === 'under_review') {
    return 'Atlas está revisando su expediente. Mientras dure la revisión no se puede cambiar el QR de cobro.';
  }
  if (estadoExpediente === 'rejected') {
    return 'Su expediente fue rechazado. Corrija lo que se le indicó y vuelva a enviarlo antes de subir un QR.';
  }
  return `Con el expediente en «${estadoExpediente}» no se admite cambiar el QR de cobro.`;
}

/** Lo que significa cada estado del QR para el comercio, sin la clave interna. */
const ESTADO_QR: Record<string, { tono: 'success' | 'warning' | 'danger' | 'neutral'; texto: string }> = {
  active: { tono: 'success', texto: 'Aprobado · sus clientes ya lo ven' },
  pending_review: { tono: 'warning', texto: 'Esperando revisión de Atlas · sus clientes aún no lo ven' },
  rejected: { tono: 'danger', texto: 'Rechazado' },
  replaced: { tono: 'neutral', texto: 'Archivado' },
};

interface MerchantPaymentQrScreenProps {
  /**
   * Dentro de la pestaña «Mi QR de cobro» de «Mi empresa»: sin cabecera propia y con el expediente
   * ya resuelto por la pantalla que la contiene —incluido el selector, que pasa a ser uno solo
   * para las cuatro pestañas en vez de uno por pantalla—.
   */
  embedded?: boolean | undefined;
  partnerId?: string | undefined;
  nombre?: string | undefined;
  estadoExpediente?: string | undefined;
  /**
   * Qué hacer cuando un QR se registró y el expediente de quien contiene esta pantalla se queda
   * viejo.
   *
   * Subir el QR CIERRA un requisito del alta (`business_qr`, `bank_qr`). Sin este aviso el
   * comercio subía su código aquí y al volver a «Estado del expediente» seguía leyendo que le
   * faltaba: la pestaña vecina conservaba el embudo de antes de la subida. Mientras fueron dos
   * páginas distintas no se notaba —navegar volvía a pedirlo todo—, y al juntarlas dejó de serlo.
   */
  onDone?: (() => void) | undefined;
}

/**
 * El QR de cobro del comercio: el que ve el cliente cuando pulsa «pagar».
 *
 * ## Por qué existe esta pantalla
 *
 * El QR bancario se podía subir SÓLO dentro del alta, enterrado en «Mi empresa» junto a la matrícula
 * y los terminales. Y ahí dejaba de funcionar en cuanto el expediente se aprobaba: el backend cerraba
 * la edición con la aprobación, así que el único comercio que de verdad cobra —el aprobado, el que
 * está operando— era exactamente el que no podía subir su QR. El efecto en la app del cliente era
 * silencioso: pulsaba «pagar» y no había nada que enseñarle.
 *
 * Se separa del expediente porque no es un trámite de alta: es un dato vivo del negocio que cambia
 * cuando se cierra una cuenta, se cambia de banco o se rota el QR por fraude. Enterrarlo en el
 * trámite lo hacía parecer algo que se hace una vez.
 *
 * ## Por qué se ENSEÑA la imagen
 *
 * Antes sólo se veía el prefijo del hash. Eso prueba que hay un archivo, no que sea el archivo
 * correcto: un comercio que sube el QR de otra cuenta —o una captura borrosa— no se entera hasta que
 * un cliente transfiere el dinero a donde no debía. La imagen se trae por `fetch` autenticado y se
 * pinta desde un blob local, porque un `<img src>` contra la ruta del backend no puede mandar el
 * `Authorization` y daría 401.
 *
 * ## Por qué no hay «editar»
 *
 * Un QR se REEMPLAZA. El anterior queda archivado apuntando al nuevo, con su hash y su fecha, así
 * que siempre se puede reconstruir contra qué QR se cobró un día concreto. Un botón de editar
 * destruiría exactamente eso.
 */
export function MerchantPaymentQrScreen({
  embedded = false,
  partnerId: partnerIdProp,
  nombre: nombreProp,
  estadoExpediente: estadoProp,
  onDone,
}: MerchantPaymentQrScreenProps = {}) {
  const [partnerIdPropio, setPartnerIdPropio] = useState('');
  const [nombrePropio, setNombrePropio] = useState('');
  const [estadoPropio, setEstadoPropio] = useState('');
  const partnerId = partnerIdProp ?? partnerIdPropio;
  const nombre = nombreProp ?? nombrePropio;
  const estadoExpediente = estadoProp ?? estadoPropio;
  /*
   * Un usuario puede tener MÁS de un expediente. Antes se tomaba el primero sin decirlo, y el QR
   * podía subirse al comercio equivocado sin ningún aviso. Se guardan todos y se elige explícito.
   */
  const [expedientes, setExpedientes] = useState<{ partnerId: string; legalName: string | null; tradeName: string | null; status: string }[]>([]);
  const [codigos, setCodigos] = useState<PartnerQrCode[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ tono: 'success' | 'danger' | 'info'; texto: string } | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [entidad, setEntidad] = useState('');
  /* Las entidades con sigla ASFI las publica el backend: tecleada, una sigla mal escrita no cruza con el padrón. */
  const entidades = useOptions(domainLoader('domain:portal.bankInstitution'));
  const [cuenta, setCuenta] = useState('');
  const archivo = useRef<HTMLInputElement>(null);
  /*
   * El QR del NEGOCIO, que hasta ahora sólo se podía subir dentro del expediente.
   *
   * Son dos códigos distintos y por eso tienen su propio archivo y su propio aviso: el bancario es
   * con el que le pagan —lleva entidad y cuenta— y el del negocio es evidencia del alta. Compartir
   * un solo `input` obligaría a elegir cuál se está subiendo, que es justo la confusión que hacía
   * falta quitar.
   */
  const archivoNegocio = useRef<HTMLInputElement>(null);
  const [subiendoNegocio, setSubiendoNegocio] = useState(false);

  const recargar = useCallback(async (id: string) => {
    setCargando(true);
    try {
      setCodigos(await partnerOnboardingService.listQrCodes(id));
      setError(null);
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : 'No fue posible leer los QR del comercio.');
    } finally {
      setCargando(false);
    }
  }, []);

  /** Releer los QR y avisar a quien contiene la pantalla, cuyo expediente también quedó viejo. */
  const recargarYAvisar = useCallback(
    async (id: string) => {
      await recargar(id);
      onDone?.();
    },
    [onDone, recargar],
  );

  useEffect(() => {
    /* Embebida, el expediente —y con él el selector— lo resuelve «Mi empresa» para las cuatro pestañas. */
    if (partnerIdProp !== undefined) {
      if (partnerIdProp) void recargar(partnerIdProp);
      return;
    }
    let cancelado = false;
    merchantCreditService
      .misExpedientes()
      .then((resultado) => {
        if (cancelado) return;
        const perfiles = resultado.profiles ?? [];
        // Con varios, el aprobado primero: es el que cobra. Y se enseña cuál se eligió (ver selector).
        const propio = perfiles.find((perfil) => perfil.status === 'approved') ?? perfiles[0];
        if (!propio) {
          setError('Su comercio todavía no tiene expediente en Atlas: el ejecutivo de cuenta debe enviarlo a verificación desde el caso de alta. Hasta entonces esta pantalla no puede operar.');
          setCargando(false);
          return;
        }
        setExpedientes(perfiles);
        setPartnerIdPropio(propio.partnerId);
        setNombrePropio(propio.tradeName ?? propio.legalName ?? '');
        setEstadoPropio(propio.status);
        void recargar(propio.partnerId);
      })
      .catch((fallo: unknown) => {
        if (cancelado) return;
        setError(fallo instanceof Error ? fallo.message : 'No fue posible identificar su comercio.');
        setCargando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [partnerIdProp, recargar]);

  /**
   * La subida va en dos pasos: se pide el permiso y el binario viaja DIRECTO al almacenamiento.
   *
   * El ticket firma tipo y tamaño, así que el almacenamiento rechaza lo que no coincida con lo
   * autorizado, y el servidor mira el objeto real antes de escribir la fila: el expediente nunca
   * afirma tener una evidencia que no existe.
   */
  async function subir() {
    const file = archivo.current?.files?.[0];
    if (!file) {
      setAviso({ tono: 'info', texto: 'Elija primero la imagen de su QR bancario.' });
      return;
    }
    if (!entidad.trim()) {
      setAviso({ tono: 'info', texto: 'Elija la entidad de su banco: su sigla es lo que permite cruzarlo con ASFI.' });
      return;
    }

    setSubiendo(true);
    setAviso(null);
    try {
      /*
       * Se comprueba ANTES de subir. El servidor vuelve a comprobarlo y es el que manda —esto se
       * puede saltar—, pero avisar aquí ahorra el viaje entero al almacenamiento y no deja allí un
       * objeto que nadie va a registrar. Donde el navegador no sepa leer códigos, esto no bloquea.
       */
      if ((await imagenTieneQr(file)) === 'sin-codigo') {
        setAviso({ tono: 'danger', texto: AVISO_SIN_QR });
        return;
      }

      const ticket = await partnerOnboardingService.createQrUploadUrl(partnerId, {
        qrKind: 'bank',
        contentType: file.type === 'image/png' ? 'image/png' : 'image/jpeg',
        sizeBytes: file.size,
      });
      await uploadQrFile(ticket, file);
      await partnerOnboardingService.registerQr(partnerId, {
        qrKind: 'bank',
        storageKey: ticket.storageKey,
        bankInstitutionCode: entidad.trim().toUpperCase(),
        ...(cuenta.trim() ? { accountNumberMasked: cuenta.trim() } : {}),
      });
      setAviso({
        tono: 'success',
        texto: 'QR de cobro actualizado. Es el que verán sus clientes al pulsar «pagar» en la app.',
      });
      if (archivo.current) archivo.current.value = '';
      await recargarYAvisar(partnerId);
    } catch (fallo) {
      setAviso({ tono: 'danger', texto: fallo instanceof Error ? fallo.message : 'No se pudo subir el QR.' });
    } finally {
      setSubiendo(false);
    }
  }

  /**
   * El QR del negocio: mismo camino que el bancario, sin datos de banco.
   *
   * Vive aquí y ya no en el expediente por lo mismo que el bancario: el backend cierra la edición
   * del expediente al aprobarlo, así que el comercio que ya opera era el único que no podía
   * reemplazar su propio código. Y tenerlos en dos pantallas distintas obligaba a recordar cuál se
   * subía dónde.
   */
  async function subirNegocio() {
    const file = archivoNegocio.current?.files?.[0];
    if (!file) {
      setAviso({ tono: 'info', texto: 'Elija primero la imagen del QR de su negocio.' });
      return;
    }

    setSubiendoNegocio(true);
    setAviso(null);
    try {
      if ((await imagenTieneQr(file)) === 'sin-codigo') {
        setAviso({ tono: 'danger', texto: AVISO_SIN_QR });
        return;
      }
      const ticket = await partnerOnboardingService.createQrUploadUrl(partnerId, {
        qrKind: 'business',
        contentType: file.type === 'image/png' ? 'image/png' : 'image/jpeg',
        sizeBytes: file.size,
      });
      await uploadQrFile(ticket, file);
      await partnerOnboardingService.registerQr(partnerId, {
        qrKind: 'business',
        storageKey: ticket.storageKey,
      });
      setAviso({ tono: 'success', texto: 'QR del negocio actualizado.' });
      if (archivoNegocio.current) archivoNegocio.current.value = '';
      await recargarYAvisar(partnerId);
    } catch (fallo) {
      setAviso({ tono: 'danger', texto: fallo instanceof Error ? fallo.message : 'No se pudo subir el QR del negocio.' });
    } finally {
      setSubiendoNegocio(false);
    }
  }

  /*
   * «Vigente» es el APROBADO si lo hay; si no, el que espera revisión. Los dos pueden convivir: el
   * comercio sube uno nuevo y el aprobado sigue cobrando hasta que Atlas apruebe el nuevo.
   */
  const bancarios = codigos.filter((codigo) => codigo.qrKind === 'bank');
  const aprobado = bancarios.find((codigo) => codigo.status === 'active');
  const enRevision = bancarios.find((codigo) => codigo.status === 'pending_review');
  const vigente = aprobado ?? enRevision;
  const ultimoRechazo = bancarios.find((codigo) => codigo.status === 'rejected');
  const negocioVigente = codigos.find(
    (codigo) => codigo.qrKind === 'business' && (codigo.status === 'active' || codigo.status === 'pending_review'),
  );
  const historial = bancarios.filter((codigo) => codigo !== vigente && codigo !== enRevision);
  const bloqueo = motivoSinSubida(estadoExpediente);
  const estadoVigente = vigente ? (ESTADO_QR[vigente.status] ?? { tono: 'neutral' as const, texto: vigente.status }) : null;

  function elegirExpediente(id: string) {
    const elegido = expedientes.find((perfil) => perfil.partnerId === id);
    if (!elegido) return;
    setPartnerIdPropio(elegido.partnerId);
    setNombrePropio(elegido.tradeName ?? elegido.legalName ?? '');
    setEstadoPropio(elegido.status);
    setCodigos([]);
    void recargar(elegido.partnerId);
  }

  const acciones = (
          <>
            <BotonPdf
              label="Descargar PDF"
              data-testid="pdf-qr"
              disabled={cargando || !codigos.length}
              documento={() => ({
                title: 'Mi QR de cobro',
                subtitle: nombre ? `Portal del comercio · ${nombre}` : 'Portal del comercio',
                summary: [{ label: 'Códigos registrados', value: codigos.length }],
                notices: [
                  {
                    level: 'caution' as const,
                    title: 'La imagen del QR no va en este PDF',
                    text:
                      'Se listan los códigos registrados y su huella, no la imagen: un QR impreso desde un ' +
                      'informe puede acabar pegado en una caja sin que nadie compruebe que es el vigente. ' +
                      'La imagen se descarga desde esta misma pantalla.',
                  },
                ],
                sections: [
                  {
                    title: 'Códigos registrados',
                    fields: [
                      { label: 'Comercio', value: nombre || '—' },
                      { label: 'Estado del expediente', value: estadoExpediente || '—' },
                    ],
                    table: tablaPdf(
                      [
                        { key: 'qrKind', label: 'Tipo' },
                        { key: 'bankInstitutionCode', label: 'Entidad' },
                        { key: 'accountNumberMasked', label: 'Cuenta' },
                        { key: 'status', label: 'Estado' },
                        { key: 'registeredAt', label: 'Registrado' },
                      ],
                      codigos as unknown as Array<Record<string, unknown>>,
                    ),
                  },
                ],
              })}
            />
            <AtlasButton variant="secondary" icon="refresh" disabled={!partnerId} loading={cargando} onClick={() => partnerId && void recargar(partnerId)}>
              Actualizar
            </AtlasButton>
          </>
  );

  return (
    <div className="space-y-5">
      {embedded ? null : (
        <WorkspaceHeader
          breadcrumbs={[{ label: 'Portal comercio' }, { label: 'QR de cobro' }]}
          title="Mi QR de cobro"
          description="Es el código que sus clientes escanean para pagarle cada cuota. El dinero entra en su cuenta, no en la de Atlas."
          actions={acciones}
        />
      )}

      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          label="QR vigente"
          value={cargando ? '…' : vigente ? 'Sí' : 'No'}
          detail={vigente ? `${vigente.bankInstitutionCode ?? 'sin entidad'} · ${vigente.accountNumberMasked ?? 'sin cuenta'}` : 'Sus clientes no pueden pagarle'}
          icon="qr_code_2"
          tone={vigente ? 'teal' : 'purple'}
        />
        <MetricCard label="Comercio" value={nombre || '—'} detail={partnerId ? `Expediente ${partnerId} · ${estadoExpediente}` : 'Identificando…'} icon="storefront" />
        <MetricCard label="Reemplazos" value={cargando ? '…' : historial.length} detail="Los anteriores quedan archivados" icon="history" tone="purple" />
      </div>

      {!embedded && expedientes.length > 1 ? (
        <InlineNotice tone="info" title="Su usuario tiene varios expedientes">
          <label className="flex flex-wrap items-center gap-2 text-xs">
            <span>El QR se sube al expediente elegido:</span>
            <OptionSelect
              name="expediente-qr"
              ariaLabel="Expediente al que se sube el QR"
              compact
              className="min-w-64"
              value={partnerId}
              onChange={elegirExpediente}
              options={expedientes.map((perfil) => ({ value: perfil.partnerId, label: perfil.tradeName ?? perfil.legalName ?? `Expediente ${perfil.partnerId}`, description: `Expediente ${perfil.partnerId} · estado ${perfil.status}` }))}
            />
          </label>
        </InlineNotice>
      ) : null}
      {bloqueo ? (
        <InlineNotice tone="warning" title="Ahora mismo no se puede cambiar el QR" data-testid="qr-cobro-bloqueo">
          {bloqueo}
        </InlineNotice>
      ) : null}
      {ultimoRechazo && !aprobado && !enRevision ? (
        <InlineNotice tone="danger" title="Atlas rechazó su último QR" data-testid="qr-cobro-rechazo">
          {ultimoRechazo.reviewNote ?? 'No se indicó el motivo. Suba una imagen nítida del QR de su banco.'}
        </InlineNotice>
      ) : null}
      {enRevision && !aprobado ? (
        <InlineNotice tone="info" title="Su QR está en revisión">
          Atlas lo revisa antes de enseñárselo a sus clientes. Hasta entonces, la app les dice que el QR está pendiente de
          aprobación.
        </InlineNotice>
      ) : null}
      {error ? <InlineNotice tone="danger">{error}</InlineNotice> : null}
      {aviso ? (
        <div data-testid="qr-cobro-aviso">
          <InlineNotice tone={aviso.tono}>{aviso.texto}</InlineNotice>
        </div>
      ) : null}

      {!cargando && !vigente ? (
        <InlineNotice tone="warning" title="Sus clientes todavía no pueden pagarle">
          Mientras no suba su QR bancario, la app les dice que la cuota se paga a su comercio pero no tiene ningún código
          que enseñarles. Súbalo aquí abajo.
        </InlineNotice>
      ) : null}

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <Panel
          data-tutorial-id="qr-cobro-vigente"
          title="Lo que ve su cliente"
          description="Esta es la imagen exacta que aparece en la app cuando su cliente pulsa «pagar»."
          icon="smartphone"
          action={embedded ? acciones : undefined}
        >
          {cargando ? (
            <p className="py-10 text-center text-xs text-slate-500">Cargando…</p>
          ) : vigente ? (
            <div className="space-y-3">
              <QrImagen partnerId={partnerId} qrId={vigente.qrId} />
              <dl className="grid grid-cols-2 gap-2 text-xs">
                <Dato termino="Entidad" valor={vigente.bankInstitutionCode ?? '—'} />
                <Dato termino="Cuenta" valor={vigente.accountNumberMasked ?? '—'} mono />
                <Dato termino="Huella del archivo" valor={vigente.fingerprint} mono />
                <Dato termino="Subido" valor={new Date(vigente.createdAt).toLocaleString('es-BO')} />
              </dl>
              <StatusPill tone={estadoVigente?.tono ?? 'neutral'}>{estadoVigente?.texto ?? vigente.status}</StatusPill>
              {aprobado && enRevision ? (
                <p className="text-[11px] text-slate-500" data-testid="qr-cobro-nuevo-en-revision">
                  Hay un QR nuevo esperando revisión (huella {enRevision.fingerprint}). Sus clientes siguen viendo el
                  aprobado hasta que Atlas lo apruebe.
                </p>
              ) : null}
            </div>
          ) : (
            <div className="py-10 text-center">
              <Icon name="qr_code_2" className="text-[28px] text-slate-400" />
              <p className="mt-2 text-xs font-bold">Todavía no hay QR de cobro</p>
              <p className="mt-1 text-[11px] text-slate-500">Sus clientes ven la instrucción de pago sin código que escanear.</p>
            </div>
          )}
        </Panel>

        <Panel
          data-tutorial-id="qr-cobro-subir"
          title={vigente ? 'Reemplazar el QR' : 'Subir mi QR bancario'}
          description="Se guarda la imagen y su huella, no el número transcrito. El QR anterior queda archivado, nunca se sobrescribe."
          icon="upload"
        >
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-slate-700">Imagen del QR (PNG o JPG)</span>
              <input ref={archivo} type="file" accept="image/png,image/jpeg" className="text-xs" data-testid="input-qr-cobro" />
            </label>
            <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">
              {/* La sigla ASFI es lo que permite cruzar el QR con el padrón del regulador y frenar
                  un cobro contra una entidad sin licencia vigente. */}
              <FormField tooltip="Banco que emitió el QR, por su sigla ASFI. Ej.: BNB."
                kind="select"
                label="Entidad (sigla ASFI)"
                name="bankInstitutionCode"
                required
                value={entidad}
                onChange={(evento) => setEntidad(evento.target.value)}
                options={withEmpty(entidades, '— Elija su banco —')}
                hint="La entidad que emitió el QR."
                data-testid="campo-entidad"
              />
              <FormField tooltip="Últimos cuatro dígitos de la cuenta, precedidos de asteriscos. Ej.: ****7890."
                label="Cuenta enmascarada"
                name="accountNumberMasked"
                value={cuenta}
                onChange={(evento) => setCuenta(evento.target.value)}
                hint="****7890"
                data-testid="campo-cuenta"
              />
            </div>
            <AtlasButton
              type="button"
              icon="upload"
              loading={subiendo}
              disabled={!partnerId || bloqueo !== null}
              title={bloqueo ?? undefined}
              onClick={() => void subir()}
              data-testid="btn-subir-qr-cobro"
            >
              {vigente ? 'Reemplazar QR de cobro' : 'Subir QR de cobro'}
            </AtlasButton>
            <p className="text-[11px] text-slate-500">
              Sólo se guarda la cuenta ENMASCARADA: el expediente prueba de quién es la cuenta, no necesita operarla.
            </p>
          </div>
        </Panel>
      </div>

      {/*
        El QR del NEGOCIO, debajo del bancario y no al lado.
        
        El orden es la jerarquía: el bancario es con el que le pagan y es lo que esta pantalla viene a
        resolver; el del negocio es evidencia del alta. Ponerlos en paralelo diría que valen lo mismo
        y haría dudar de cuál es el que escanea el cliente — que es exactamente la duda que había
        cuando los dos vivían juntos en una pestaña del expediente.
      */}
      <Panel
        title={negocioVigente ? 'QR del negocio' : 'Subir el QR del negocio'}
        description="Es evidencia de tu alta, no el código con el que te pagan. Se reemplaza igual que el bancario: el anterior queda archivado."
        icon="storefront"
      >
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
          <div className="space-y-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-slate-700">Imagen del QR (PNG o JPG)</span>
              <input
                ref={archivoNegocio}
                type="file"
                accept="image/png,image/jpeg"
                className="text-xs"
                data-testid="input-qr-negocio"
              />
            </label>
            <AtlasButton
              type="button"
              icon="upload"
              loading={subiendoNegocio}
              disabled={!partnerId || bloqueo !== null}
              title={bloqueo ?? undefined}
              onClick={() => void subirNegocio()}
              data-testid="btn-subir-qr-negocio"
            >
              {negocioVigente ? 'Reemplazar QR del negocio' : 'Subir QR del negocio'}
            </AtlasButton>
          </div>
          <div className="text-xs">
            {negocioVigente ? (
              <dl className="space-y-1" data-testid="qr-negocio-vigente">
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Huella</dt>
                  <dd className="font-mono text-[11px]">{negocioVigente.fingerprint}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Estado</dt>
                  <dd>
                    <StatusPill tone={ESTADO_QR[negocioVigente.status]?.tono ?? 'neutral'}>
                      {ESTADO_QR[negocioVigente.status]?.texto ?? negocioVigente.status}
                    </StatusPill>
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="text-slate-500">
                Todavía no lo has subido. Falta como requisito del alta, y mientras falte el expediente no
                se puede enviar a revisión.
              </p>
            )}
          </div>
        </div>
      </Panel>

      {historial.length > 0 ? (
        <Panel title="QR anteriores" description="Se conservan para poder reconstruir contra qué QR se cobró cada día." icon="history">
          <table className="w-full text-left text-xs" data-testid="tabla-qr-historial">
            <thead className="text-[10px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="py-1">Entidad</th>
                <th className="py-1">Cuenta</th>
                <th className="py-1">Huella</th>
                <th className="py-1">Subido</th>
                <th className="py-1">Estado</th>
              </tr>
            </thead>
            <tbody>
              {historial.map((codigo) => (
                <tr key={codigo.qrId} className="border-t border-slate-100">
                  <td className="py-1.5">{codigo.bankInstitutionCode ?? '—'}</td>
                  <td className="py-1.5 font-mono">{codigo.accountNumberMasked ?? '—'}</td>
                  <td className="py-1.5 font-mono text-slate-500">{codigo.fingerprint}</td>
                  <td className="py-1.5">{new Date(codigo.createdAt).toLocaleDateString('es-BO')}</td>
                  <td className="py-1.5">
                    <StatusPill tone={ESTADO_QR[codigo.status]?.tono ?? 'neutral'}>{ESTADO_QR[codigo.status]?.texto ?? codigo.status}</StatusPill>
                    {codigo.status === 'rejected' && codigo.reviewNote ? (
                      <p className="mt-0.5 text-[11px] text-slate-500">{codigo.reviewNote}</p>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      ) : null}

      <InlineNotice tone="info" title="Atlas nunca recibe este dinero">
        Su cliente transfiere directo a la cuenta de este QR. Por eso, cuando avise que pagó, es usted quien lo confirma
        desde «Comprobantes por verificar»: es el único que ve la transferencia en su extracto.
      </InlineNotice>
    </div>
  );
}

/** Un par término/valor del detalle del QR. */
function Dato({ termino, valor, mono = false }: Readonly<{ termino: string; valor: string; mono?: boolean }>) {
  return (
    <div>
      <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{termino}</dt>
      <dd className={mono ? 'font-mono text-slate-800' : 'text-slate-800'}>{valor}</dd>
    </div>
  );
}

/**
 * La imagen del QR, traída con la sesión puesta.
 *
 * Un `<img src>` apuntando a la ruta del backend daría 401 —una etiqueta `<img>` no manda
 * `Authorization`— y se vería como una imagen rota, que se lee como «el archivo no está» cuando lo
 * que pasa es que nadie lo pidió con sesión. Se descarga por `fetch` autenticado y se pinta desde un
 * blob local, que se revoca al desmontar.
 */
function QrImagen({ partnerId, qrId }: Readonly<{ partnerId: string; qrId: string }>) {
  const [url, setUrl] = useState<string | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);
  const vigente = useRef<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    setUrl(null);
    setFallo(null);
    partnerOnboardingService
      .qrImageUrl(partnerId, qrId)
      .then((blobUrl) => {
        if (cancelado) {
          URL.revokeObjectURL(blobUrl);
          return;
        }
        vigente.current = blobUrl;
        setUrl(blobUrl);
      })
      .catch((error: unknown) => {
        if (!cancelado) setFallo(error instanceof Error ? error.message : 'No se pudo cargar la imagen del QR.');
      });
    return () => {
      cancelado = true;
      if (vigente.current) {
        URL.revokeObjectURL(vigente.current);
        vigente.current = null;
      }
    };
  }, [partnerId, qrId]);

  if (fallo) {
    return (
      <InlineNotice tone="warning" title="No se pudo mostrar el QR">
        {fallo}
      </InlineNotice>
    );
  }

  if (!url) return <div className="h-56 animate-pulse rounded-md bg-slate-100" aria-label="Cargando QR" />;

  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      {/* eslint-disable-next-line @next/next/no-img-element -- es un blob local: `next/image` exige una URL que el optimizador pueda buscar. */}
      <img src={url} alt="QR bancario del comercio" data-testid="qr-cobro-imagen" className="mx-auto max-h-64 w-auto" />
    </div>
  );
}
