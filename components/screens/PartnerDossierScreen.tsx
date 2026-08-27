'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AtlasButton } from '@/components/atlas/AtlasButton';
import { FormField } from '@/components/atlas/FormField';
import { Icon } from '@/components/atlas/Icon';
import { InlineNotice } from '@/components/atlas/InlineNotice';
import { Panel } from '@/components/atlas/Panel';
import { TabbedPanels } from '@/components/atlas/TabbedPanels';
import { AVISO_SIN_QR, imagenTieneQr } from '@/lib/qrImagen';
import { StatusPill } from '@/components/atlas/StatusPill';
import { WorkspaceHeader } from '@/components/atlas/WorkspaceHeader';
import { BotonPdf } from '@/components/atlas/BotonPdf';
import { tablaPdf } from '@/lib/pdf';
import { QrCanvas } from '@/components/atlas/QrCanvas';
import { PosList, QrList, SubmissionGaps } from '@/components/screens/PartnerDossierPanels';
import { merchantCategoryOptions } from '@/lib/catalogs';
import { useAsyncResource } from '@/hooks/useAsyncResource';
import {
  partnerOnboardingService,
  uploadQrFile,
  type PartnerOnboardingState,
} from '@/services/partnerOnboardingService';
import type { JsonObject } from '@/services/types';

/**
 * Los campos escritos del formulario, sin los vacíos.
 *
 * Se descarta la cadena vacía en vez de mandarla: los campos opcionales del contrato exigen un
 * mínimo de longitud, así que un `""` se rechaza en el borde con un error de validación que no
 * describe lo que pasó —el usuario simplemente no rellenó algo que no era obligatorio—.
 */
function camposEscritos(form: FormData): JsonObject {
  const payload: JsonObject = {};
  for (const [name, value] of form.entries()) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (trimmed !== '') payload[name] = trimmed;
  }
  return payload;
}

/**
 * Las opciones de rubro, garantizando que la GUARDADA esté entre ellas.
 *
 * Un select que no contiene el valor actual no lo muestra: cae al primer elemento y el rubro que el
 * comercio sí tiene aparece como «Sin definir». Eso ya pasó —la base traía `EDUCATION` y el
 * catálogo decía `EDUCACION`— y lo grave no es cómo se ve, sino que guardar el formulario sin tocar
 * ese campo habría escrito el valor equivocado encima del bueno.
 *
 * Ahora un valor fuera de catálogo se añade como opción y se dice que lo está: se ve lo que hay
 * guardado, se puede corregir, y nadie lo pisa sin querer.
 */
function opcionesDeRubro(actual: string | null) {
  const opciones = [{ label: '— Sin definir —', value: '' }, ...merchantCategoryOptions];
  if (actual && !merchantCategoryOptions.some((opcion) => opcion.value === actual)) {
    opciones.push({ label: `${actual} (fuera de catálogo)`, value: actual });
  }
  return opciones;
}

/**
 * El expediente del comercio, desde el portal del propio comercio.
 *
 * Es la mitad visible de lo que el backend verifica: el comercio declara quién es, registra dónde
 * opera, sube con qué cobra —su QR y el de su cuenta bancaria— y da de alta sus terminales. Al
 * final envía, y **el envío no aprueba nada**: deja el caso en revisión, porque un onboarding que
 * se auto-aprueba al completar sus campos es un formulario, no una verificación.
 *
 * La pantalla enseña SIEMPRE lo que falta. Es la decisión de producto que la ordena: descubrir los
 * requisitos de uno en uno, a base de envíos rechazados, convierte un trámite en una pelea.
 */
export function PartnerDossierScreen() {
  const [partnerId, setPartnerId] = useState('');
  /*
   * `null` mientras no se sabe si este usuario ya tiene expediente. Distinguirlo de «no tiene» es
   * lo que evita el fallo que tenia esta pantalla: sin este estado, el primer render ya ofrecia
   * ABRIR expediente a un comercio que llevaba meses operando, y el que aceptaba terminaba con un
   * segundo expediente compitiendo con el suyo.
   */
  const [expedientePropio, setExpedientePropio] = useState<'buscando' | 'sin-expediente' | 'encontrado'>('buscando');
  /** La sucursal cuyo QR se esta mirando. Solo afecta a lo que se pinta. */
  const [sucursalAbierta, setSucursalAbierta] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'danger' | 'info'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const businessQrInput = useRef<HTMLInputElement>(null);
  const bankQrInput = useRef<HTMLInputElement>(null);

  const dossier = useAsyncResource<PartnerOnboardingState | null>(
    useCallback(async () => (partnerId ? partnerOnboardingService.getState(partnerId) : null), [partnerId]),
    false,
  );

  /*
   * En cuanto hay expediente se carga su estado. El recurso arranca en manual (`autoLoad = false`)
   * porque sin `partnerId` no hay nada que pedir; sin este efecto, abrir el expediente dejaba la
   * pantalla en blanco: el identificador ya estaba y nadie disparaba la primera lectura.
   */
  const { reload } = dossier;
  useEffect(() => {
    if (partnerId) void reload();
  }, [partnerId, reload]);

  /*
   * Cual es MI expediente, antes de ofrecer abrir ninguno.
   *
   * Un fallo aqui NO se trata como «no tiene expediente»: se deja el estado en `buscando` y se
   * explica el error. Confundir «no pude preguntar» con «no tiene» es justo lo que empuja a abrir
   * un expediente duplicado.
   */
  useEffect(() => {
    let cancelado = false;
    partnerOnboardingService
      .mine()
      .then((resultado) => {
        if (cancelado) return;
        const propio = resultado.profiles?.[0];
        if (!propio) {
          setExpedientePropio('sin-expediente');
          return;
        }
        setPartnerId(propio.partnerId);
        setExpedientePropio('encontrado');
      })
      .catch((error: unknown) => {
        if (cancelado) return;
        setFeedback({
          tone: 'danger',
          text: error instanceof Error ? error.message : 'No fue posible comprobar si ya tienes un expediente.',
        });
      });
    return () => {
      cancelado = true;
    };
  }, []);

  /** Toda acción termina releyendo el estado: el embudo tiene que reflejar lo que acaba de pasar. */
  const run = useCallback(
    async (label: string, action: () => Promise<unknown>) => {
      setBusy(true);
      setFeedback(null);
      try {
        await action();
        await dossier.reload();
        setFeedback({ tone: 'success', text: `${label}: listo.` });
      } catch (error) {
        setFeedback({ tone: 'danger', text: error instanceof Error ? error.message : `${label}: no se pudo completar.` });
      } finally {
        setBusy(false);
      }
    },
    [dossier],
  );

  async function abrirExpediente(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = camposEscritos(new FormData(event.currentTarget));
    setBusy(true);
    setFeedback(null);
    try {
      const profile = await partnerOnboardingService.start(payload);
      setPartnerId(profile.partnerId);
      setExpedientePropio('encontrado');
      setFeedback({ tone: 'success', text: `Expediente ${profile.partnerId} abierto.` });
    } catch (error) {
      // El 409 por NIT repetido trae el identificador del expediente que ya existe: se enseña tal
      // cual para que el comercio pueda continuarlo en vez de quedarse sin salida.
      setFeedback({ tone: 'danger', text: error instanceof Error ? error.message : 'No se pudo abrir el expediente.' });
    } finally {
      setBusy(false);
    }
  }

  /**
   * Subida del QR en dos pasos: se pide el permiso, se sube al almacenamiento y se registra.
   *
   * El binario NO pasa por la API: el ticket firma tipo y tamaño, así que el bucket rechaza lo que
   * no coincida con lo autorizado. Y el servidor mira el objeto antes de escribir la fila, de modo
   * que el expediente nunca afirma tener una evidencia que no existe.
   */
  async function subirQr(kind: 'business' | 'bank', input: HTMLInputElement | null) {
    const file = input?.files?.[0];
    if (!file) {
      setFeedback({ tone: 'info', text: 'Elige primero la imagen del QR.' });
      return;
    }
    /*
     * Antes de subir: si el navegador sabe leer códigos y esta imagen no lleva ninguno, se para
     * aquí. El servidor lo comprueba igual y es quien manda; esto sólo evita el viaje y el objeto
     * huérfano en el almacenamiento.
     */
    if ((await imagenTieneQr(file)) === 'sin-codigo') {
      setFeedback({ tone: 'danger', text: AVISO_SIN_QR });
      return;
    }

    const bankFields =
      kind === 'bank'
        ? {
            bankInstitutionCode: (document.querySelector<HTMLInputElement>('#bankInstitutionCode')?.value ?? '').toUpperCase(),
            accountNumberMasked: document.querySelector<HTMLInputElement>('#accountNumberMasked')?.value ?? '',
          }
        : {};

    await run(kind === 'bank' ? 'QR bancario' : 'QR del negocio', async () => {
      const ticket = await partnerOnboardingService.createQrUploadUrl(partnerId, {
        qrKind: kind,
        contentType: file.type === 'image/png' ? 'image/png' : 'image/jpeg',
        sizeBytes: file.size,
      });
      await uploadQrFile(ticket, file);
      await partnerOnboardingService.registerQr(partnerId, { qrKind: kind, storageKey: ticket.storageKey, ...bankFields });
    });
  }

  const state = dossier.data;
  const branches = state?.branches ?? [];

  return (
    <div className="space-y-4">
      <WorkspaceHeader
        title="Mi empresa"
        description="Los datos de tu negocio, dónde opera, con qué cobra y el QR que escanean tus clientes."
        actions={
          state ? (
            <BotonPdf
              label="Descargar PDF"
              data-testid="pdf-mi-empresa"
              documento={() => ({
                title: 'Mi empresa',
                subtitle: `${state.profile.legalName} · NIT ${state.profile.taxId}`,
                summary: [
                  { label: 'Estado', value: state.profile.onboardingStatus },
                  { label: 'Sucursales', value: branches.length },
                  { label: 'Terminales', value: (state.posTerminals ?? []).length },
                  { label: 'QR registrados', value: (state.qrCodes ?? []).length },
                ],
                ...(state.gaps.length
                  ? {
                      notices: [
                        {
                          level: 'caution' as const,
                          title: 'Expediente incompleto',
                          text: `Faltan ${state.gaps.length} requisito(s) por cubrir antes de poder enviarlo a revisión.`,
                        },
                      ],
                    }
                  : {}),
                sections: [
                  {
                    title: 'Ficha comercial',
                    fields: [
                      { label: 'Razón social', value: state.profile.legalName },
                      { label: 'Nombre comercial', value: state.profile.tradeName ?? '—' },
                      { label: 'NIT', value: state.profile.taxId },
                      { label: 'Rubro', value: state.profile.businessCategory ?? '—' },
                      { label: 'Correo de contacto', value: state.profile.contactEmail },
                      { label: 'Teléfono', value: state.profile.contactPhone ?? '—' },
                    ],
                  },
                  {
                    title: 'Sucursales',
                    table: tablaPdf(
                      [
                        { key: 'branchCode', label: 'Código' },
                        { key: 'name', label: 'Sucursal' },
                        { key: 'addressLine', label: 'Dirección' },
                      ],
                      branches as unknown as Array<Record<string, unknown>>,
                    ),
                  },
                  {
                    title: 'Terminales POS',
                    table: tablaPdf(
                      [
                        { key: 'terminalSerial', label: 'Serial' },
                        { key: 'terminalAlias', label: 'Alias' },
                        { key: 'status', label: 'Estado' },
                      ],
                      (state.posTerminals ?? []) as unknown as Array<Record<string, unknown>>,
                    ),
                  },
                ],
              })}
            />
          ) : null
        }
      />

      {feedback ? (
        <div data-testid="expediente-feedback">
          <InlineNotice tone={feedback.tone}>{feedback.text}</InlineNotice>
        </div>
      ) : null}

      {expedientePropio === 'buscando' && partnerId === '' ? (
        <Panel title="Mi empresa" icon="storefront">
          <p className="py-6 text-center text-xs text-slate-500">Comprobando si ya tienes un expediente…</p>
        </Panel>
      ) : null}

      {expedientePropio === 'sin-expediente' ? (
        <Panel title="Abrir expediente" icon="storefront" description="Todavía no tienes un expediente. Este es el primer paso.">
          <form className="grid gap-3 md:grid-cols-2" onSubmit={abrirExpediente}>
            <FormField label="Razón social" name="legalName" required data-testid="campo-legalName" />
            <FormField label="Nombre comercial" name="tradeName" />
            <FormField label="NIT" name="taxId" required hint="Sólo dígitos." data-testid="campo-taxId" />
            <FormField label="Matrícula de comercio" name="commercialRegistry" />
            <FormField
              kind="select"
              label="Rubro del negocio"
              name="businessCategory"
              data-testid="campo-businessCategory"
              options={[{ label: '— Seleccione —', value: '' }, ...merchantCategoryOptions]}
              hint="Agrupa tu cartera y las reglas de comisión. Se puede corregir después."
            />
            <FormField label="Correo de contacto" name="contactEmail" type="email" required data-testid="campo-contactEmail" />
            <FormField label="Teléfono" name="contactPhone" />
            <div className="md:col-span-2">
              <AtlasButton type="submit" disabled={busy} data-testid="btn-abrir-expediente">
                <Icon name="add_business" className="text-[18px]" /> Abrir expediente
              </AtlasButton>
            </div>
          </form>
        </Panel>
      ) : null}

      {/*
        * Un fallo al leer el expediente se DICE. Antes no: `state` se quedaba en `null` y la
        * pantalla se pintaba vacía bajo su título, que es la peor forma de fallar —el comercio no
        * sabe si no tiene datos o si el portal no pudo pedirlos, y las dos cosas se arreglan de
        * manera distinta—. Lo descubrimos con un 403 del gateway que aquí no se veía en absoluto.
        */}
      {dossier.error && !state ? (
        <InlineNotice tone="danger" title="No se pudo cargar tu empresa">
          {dossier.error}
        </InlineNotice>
      ) : null}

      {state ? (
        <TabbedPanels
          keepMounted
          tabs={[
            {
              id: 'estado',
              label: 'Estado del expediente',
              icon: 'fact_check',
              content: (
              <Panel
                title={state.profile.legalName}
                description={`NIT ${state.profile.taxId} · expediente ${state.profile.partnerId}`}
                icon="badge"
                action={<StatusPill tone={state.profile.onboardingStatus === 'approved' ? 'success' : 'info'}>{state.profile.onboardingStatus}</StatusPill>}
              >
                <SubmissionGaps gaps={state.gaps} ready={state.readyToSubmit} />
                <div className="mt-3">
                  <AtlasButton
                    type="button"
                    disabled={busy || !state.readyToSubmit}
                    data-testid="btn-enviar-revision"
                    onClick={() => void run('Envío a revisión', () => partnerOnboardingService.submit(partnerId))}
                  >
                    <Icon name="send" className="text-[18px]" /> Enviar a revisión
                  </AtlasButton>
                </div>
              </Panel>
              ),
            },
            {
              id: 'ficha',
              label: 'Ficha comercial',
              icon: 'edit_note',
              content: (
              <Panel
                title="Ficha comercial"
                description="Cómo se presenta tu negocio. La razón social, el NIT y la matrícula no se editan aquí: son los datos con los que Atlas verificó tu expediente."
                icon="edit_note"
              >
                <form
                  className="grid gap-3 md:grid-cols-3"
                  data-testid="form-ficha-comercial"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const payload = camposEscritos(new FormData(event.currentTarget));
                    void run('Ficha comercial', () => partnerOnboardingService.updateCommercialProfile(partnerId, payload));
                  }}
                >
                  <FormField
                    label="Nombre comercial"
                    name="tradeName"
                    defaultValue={state.profile.tradeName ?? ''}
                    data-testid="campo-tradeName"
                    hint="El nombre de la fachada, el que ve tu cliente."
                  />
                  <FormField
                    kind="select"
                    label="Rubro del negocio"
                    name="businessCategory"
                    defaultValue={state.profile.businessCategory ?? ''}
                    data-testid="campo-rubro"
                    options={opcionesDeRubro(state.profile.businessCategory)}
                  />
                  <FormField
                    label="Teléfono de contacto"
                    name="contactPhone"
                    defaultValue={state.profile.contactPhone ?? ''}
                    data-testid="campo-contactPhone"
                  />
                  <div className="md:col-span-3">
                    <AtlasButton type="submit" disabled={busy} data-testid="btn-guardar-ficha">
                      <Icon name="save" className="text-[18px]" /> Guardar ficha
                    </AtlasButton>
                  </div>
                </form>
                <dl className="mt-4 grid gap-3 border-t border-slate-100 pt-4 text-xs md:grid-cols-3">
                  <div>
                    <dt className="font-bold text-slate-500">Razón social</dt>
                    <dd className="text-slate-800">{state.profile.legalName}</dd>
                  </div>
                  <div>
                    <dt className="font-bold text-slate-500">NIT</dt>
                    <dd className="text-slate-800">{state.profile.taxId}</dd>
                  </div>
                  <div>
                    <dt className="font-bold text-slate-500">Matrícula de comercio</dt>
                    <dd className="text-slate-800">{state.profile.commercialRegistry ?? 'Sin declarar'}</dd>
                  </div>
                  <div>
                    <dt className="font-bold text-slate-500">Correo verificado</dt>
                    <dd className="text-slate-800">
                      {state.profile.contactEmail} {state.profile.emailVerified ? '· verificado' : '· sin verificar'}
                    </dd>
                  </div>
                </dl>
              </Panel>
              ),
            },
            {
              id: 'sucursales',
              label: 'Sucursales',
              icon: 'store',
              content: (
              <Panel title="Sucursales" icon="store" description="Dónde opera el negocio. De la sucursal cuelgan el QR y los terminales.">
                <form
                  className="grid gap-3 md:grid-cols-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const payload = camposEscritos(new FormData(event.currentTarget));
                    void run('Sucursal', () => partnerOnboardingService.registerBranch(partnerId, payload));
                    event.currentTarget.reset();
                  }}
                >
                  <FormField label="Código" name="branchCode" required data-testid="campo-branchCode" />
                  <FormField label="Nombre" name="name" required data-testid="campo-branchName" />
                  <FormField label="Dirección" name="addressLine" />
                  <div className="flex items-end">
                    <AtlasButton type="submit" disabled={busy} data-testid="btn-registrar-sucursal">
                      Registrar sucursal
                    </AtlasButton>
                  </div>
                </form>
                {/*
                  * Al abrir una sucursal se ve SU QR: el que hay que imprimir y pegar en ese mostrador.
                  *
                  * El QR es por terminal y no por sucursal, y esa diferencia importa cuando algo va
                  * mal: si un local tiene dos cajas, poder retirar el codigo de una sin cerrar la otra
                  * es la diferencia entre suspender un equipo y cerrar la tienda.
                  */}
                <ul className="mt-3 space-y-2 text-xs" data-testid="lista-sucursales">
                  {branches.map((branch) => {
                    const abierta = sucursalAbierta === branch.branchId;
                    const terminales = (state.posTerminals ?? []).filter((pos) => pos.branchId === branch.branchId);
                    return (
                      <li key={branch.branchId} className="rounded-lg border border-slate-200">
                        <button
                          type="button"
                          className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-slate-50"
                          data-testid={`sucursal-${branch.branchCode}`}
                          onClick={() => setSucursalAbierta(abierta ? null : branch.branchId)}
                        >
                          <span>
                            <strong>{branch.branchCode}</strong> · {branch.name}
                            {branch.city ? ` · ${branch.city}` : ''}
                          </span>
                          <span className="flex items-center gap-2 text-[10px] font-bold uppercase text-slate-500">
                            {terminales.length} {terminales.length === 1 ? 'terminal' : 'terminales'}
                            <Icon name={abierta ? 'expand_less' : 'qr_code_2'} className="text-[18px]" />
                          </span>
                        </button>

                        {abierta ? (
                          <div className="border-t border-slate-100 bg-slate-50/60 p-3" data-testid={`qr-sucursal-${branch.branchCode}`}>
                            {terminales.length === 0 ? (
                              <p className="text-slate-600">
                                Esta sucursal todavía no tiene ninguna caja dada de alta, así que no hay QR que imprimir.
                                Regístrala abajo, en <strong>Terminales POS</strong>.
                              </p>
                            ) : (
                              <div className="flex flex-wrap gap-4">
                                {terminales.map((pos) => (
                                  <div key={pos.terminalId} className="w-44 space-y-1.5 text-center">
                                    <QrCanvas value={pos.terminalSerial} size={176} className="mx-auto" />
                                    <p className="font-bold text-slate-800">{pos.terminalAlias ?? pos.terminalSerial}</p>
                                    <p className="font-mono text-[11px] text-slate-600">{pos.terminalSerial}</p>
                                    <StatusPill tone={pos.status === 'active' ? 'success' : 'warning'}>{pos.status}</StatusPill>
                                    {pos.status !== 'active' ? (
                                      <p className="text-[10px] text-slate-500">
                                        Mientras no esté activo, el teléfono del cliente rechaza este código.
                                      </p>
                                    ) : null}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </Panel>
              ),
            },
            {
              id: 'qr',
              label: 'Cobro por QR',
              icon: 'qr_code_2',
              content: (
              <Panel title="Cobro por QR" icon="qr_code_2" description="Se guarda la imagen y su huella, no el número transcrito. Un QR no se edita: se reemplaza.">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-slate-700">QR del negocio</p>
                    <input ref={businessQrInput} type="file" accept="image/png,image/jpeg" className="text-xs" data-testid="input-qr-negocio" />
                    <AtlasButton type="button" disabled={busy} onClick={() => void subirQr('business', businessQrInput.current)} data-testid="btn-subir-qr-negocio">
                      Subir QR del negocio
                    </AtlasButton>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-slate-700">QR bancario</p>
                    <input ref={bankQrInput} type="file" accept="image/png,image/jpeg" className="text-xs" data-testid="input-qr-bancario" />
                    <div className="grid grid-cols-2 gap-2">
                      {/* La sigla ASFI es lo que permite cruzar el QR con el padrón del regulador y
                          frenar un cobro contra una entidad sin licencia vigente. */}
                      <FormField label="Entidad (sigla ASFI)" name="bankInstitutionCode" id="bankInstitutionCode" hint="BNB, BME, BCR…" />
                      <FormField label="Cuenta enmascarada" name="accountNumberMasked" id="accountNumberMasked" hint="****7890" />
                    </div>
                    <AtlasButton type="button" disabled={busy} onClick={() => void subirQr('bank', bankQrInput.current)} data-testid="btn-subir-qr-bancario">
                      Subir QR bancario
                    </AtlasButton>
                  </div>
                </div>
                <div className="mt-4">
                  <QrList codes={state.qrCodes} />
                </div>
              </Panel>
              ),
            },
            {
              id: 'pos',
              label: 'Terminales POS',
              icon: 'point_of_sale',
              content: (
              <Panel title="Terminales POS" icon="point_of_sale" description="El terminal pertenece a una sucursal: un cobro ocurre en un lugar.">
                <form
                  className="grid gap-3 md:grid-cols-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const form = new FormData(event.currentTarget);
                    const branchId = String(form.get('branchId') ?? '');
                    const payload = camposEscritos(form);
                    delete payload.branchId;
                    void run('Terminal', () => partnerOnboardingService.registerPosTerminal(partnerId, branchId, payload));
                    event.currentTarget.reset();
                  }}
                >
                  <FormField
                    kind="select"
                    label="Sucursal"
                    name="branchId"
                    required
                    data-testid="campo-pos-sucursal"
                    options={branches.map((branch) => ({ label: `${branch.branchCode} · ${branch.name}`, value: branch.branchId }))}
                  />
                  <FormField label="Serial" name="terminalSerial" required data-testid="campo-pos-serial" />
                  <FormField label="Alias" name="terminalAlias" />
                  <div className="flex items-end">
                    <AtlasButton type="submit" disabled={busy || branches.length === 0} data-testid="btn-registrar-pos">
                      Registrar terminal
                    </AtlasButton>
                  </div>
                </form>
                <div className="mt-3">
                  <PosList
                    terminals={state.posTerminals}
                    branches={branches}
                    onChangeStatus={(terminalId, status) =>
                      void run('Estado del terminal', () => partnerOnboardingService.changePosStatus(partnerId, terminalId, { status }))
                    }
                  />
                </div>
              </Panel>
              ),
            },
          ]}
        />
      ) : null}
    </div>
  );
}
