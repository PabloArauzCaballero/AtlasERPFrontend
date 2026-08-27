'use client';

import { useCallback, useEffect, useState } from 'react';
import { AtlasButton } from '@/components/atlas/AtlasButton';
import { FormField } from '@/components/atlas/FormField';
import { Icon } from '@/components/atlas/Icon';
import { InlineNotice } from '@/components/atlas/InlineNotice';
import { Panel } from '@/components/atlas/Panel';
import { TabbedPanels } from '@/components/atlas/TabbedPanels';
import { PartnerRequirementsPanel } from './PartnerRequirementsPanel';
import { StatusPill } from '@/components/atlas/StatusPill';
import { WorkspaceHeader } from '@/components/atlas/WorkspaceHeader';
import { BotonPdf } from '@/components/atlas/BotonPdf';
import { tablaPdf } from '@/lib/pdf';
import { QrCanvas } from '@/components/atlas/QrCanvas';
import { SubmissionGaps } from '@/components/screens/PartnerDossierPanels';
import { merchantCategoryOptions } from '@/lib/catalogs';
import { useAsyncResource } from '@/hooks/useAsyncResource';
import { portalService } from '@/services/portalService';
import {
  partnerOnboardingService,
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
  /*
   * Las sucursales del ERP: la ÚNICA lista donde un local se da de alta.
   *
   * Es la que referencian las ventas y los usuarios del comercio, así que es la que manda. El
   * expediente no crea locales: declara cuáles de éstos entran, y guarda el puente `erpBranchId`.
   */
  const sucursalesDelErp = useAsyncResource(
    useCallback(() => portalService.listBranches(), []),
    true,
  );
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'danger' | 'info'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

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


  const state = dossier.data;
  const branches = state?.branches ?? [];
  /*
   * Lo que queda por declarar: las del ERP que todavía no tienen su reflejo en el expediente.
   *
   * Se cruza por `erpBranchId` y no por nombre — dos locales pueden llamarse igual — y así el
   * desplegable no ofrece dos veces el mismo mostrador, que era la forma de acabar con dos
   * sucursales del expediente apuntando al mismo sitio.
   */
  const declaradas = new Set(branches.map((sucursal) => sucursal.erpBranchId).filter(Boolean));
  const sucursalesPorDeclarar = (sucursalesDelErp.data ?? []).filter(
    (fila) => !declaradas.has(String(fila.id)),
  );

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
                {/* El formulario de cada requisito, junto al aviso que lo reclama. */}
                <div className="mt-4">
                  <PartnerRequirementsPanel
                    partnerId={partnerId}
                    pendientes={state.gaps.map((hueco) => hueco.requirement)}
                    ocupado={busy}
                    run={run}
                  />
                </div>
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
                  className="grid gap-3 md:grid-cols-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const form = new FormData(event.currentTarget);
                    const erpBranchId = String(form.get('erpBranchId') ?? '');
                    const sucursal = (sucursalesDelErp.data ?? []).find((fila) => String(fila.id) === erpBranchId);
                    if (!sucursal) {
                      setFeedback({ tone: 'info', text: 'Elige la sucursal que quieres declarar en el expediente.' });
                      return;
                    }
                    /*
                     * Se declara la sucursal QUE YA EXISTE, y se guarda con qué local del ERP se
                     * corresponde. `erpBranchId` es el puente, y se manda siempre: el campo estaba
                     * previsto desde el principio —«para que no haya dos verdades sobre el mismo
                     * local»— pero nadie lo rellenaba, así que en la práctica había dos.
                     *
                     * El cruce va por identificador y nunca por nombre: dos locales pueden llamarse
                     * igual, y enseñar el QR equivocado manda el dinero a otra caja.
                     */
                    void run('Sucursal', () =>
                      partnerOnboardingService.registerBranch(partnerId, {
                        erpBranchId,
                        branchCode: String(form.get('branchCode') ?? '').trim(),
                        name: String(sucursal.name ?? ''),
                        ...(sucursal.city ? { city: String(sucursal.city) } : {}),
                        ...(sucursal.address ? { addressLine: String(sucursal.address) } : {}),
                      }),
                    );
                    event.currentTarget.reset();
                  }}
                >
                  {/*
                    * Ya no se escribe una sucursal aquí: se ELIGE una de las del comercio.
                    *
                    * Registrar el local en dos sitios distintos producía dos listas que no se podían
                    * cruzar —el ERP es donde se le asignan usuarios y donde se sitúa cada venta; el
                    * expediente es de donde cuelgan las cajas y sus QR—, y nada garantizaba que
                    * hablaran del mismo mostrador. Un solo sitio para darla de alta, «Sucursales», y
                    * aquí sólo se declara cuál de ellas entra en el expediente.
                    */}
                  <FormField
                    kind="select"
                    label="Sucursal del comercio"
                    name="erpBranchId"
                    required
                    className="md:col-span-2"
                    data-testid="campo-sucursal-erp"
                    hint={
                      sucursalesPorDeclarar.length === 0
                        ? 'Todas tus sucursales ya están declaradas. Las nuevas se dan de alta en «Sucursales».'
                        : 'Se dan de alta en «Sucursales»; aquí sólo se declaran.'
                    }
                    options={[
                      { label: '— Elige una sucursal —', value: '' },
                      ...sucursalesPorDeclarar.map((fila) => ({
                        label: `${String(fila.name ?? 'Sucursal')}${fila.city ? ` · ${String(fila.city)}` : ''}`,
                        value: String(fila.id),
                      })),
                    ]}
                  />
                  <FormField label="Código" name="branchCode" required data-testid="campo-branchCode" hint="El que usas tú: SC-01…" />
                  <div className="md:col-span-3 flex justify-end">
                    <AtlasButton type="submit" disabled={busy || sucursalesPorDeclarar.length === 0} data-testid="btn-registrar-sucursal">
                      Declarar en el expediente
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
                                Esta sucursal todavía no tiene ninguna caja dada de alta, así que no hay QR que
                                imprimir. Regístrala aquí abajo.
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
                                    {/*
                                      * Suspender se hace DESDE el terminal y no desde una tabla aparte.
                                      *
                                      * Es una medida de contención —una caja que se pierde o que cobra lo que
                                      * no debe— y quien la toma está mirando ese mostrador, no una lista de
                                      * seriales donde hay que acertar la fila.
                                      */}
                                    <button
                                      type="button"
                                      className="w-full rounded border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                                      disabled={busy}
                                      data-testid={`btn-estado-pos-${pos.terminalSerial}`}
                                      onClick={() =>
                                        void run('Estado del terminal', () =>
                                          partnerOnboardingService.changePosStatus(partnerId, pos.terminalId, {
                                            status: pos.status === 'active' ? 'suspended' : 'active',
                                          }),
                                        )
                                      }
                                    >
                                      {pos.status === 'active' ? 'Suspender' : 'Reactivar'}
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/*
                              * El alta del terminal vive DENTRO de su sucursal, y por eso ya no pregunta a
                              * cuál pertenece: la sucursal es el sitio donde estás, no un campo que rellenar.
                              *
                              * Antes esto era una pestaña aparte con un desplegable de sucursales, y ahí el
                              * error fácil era dar de alta la caja en el local equivocado —el formulario no
                              * enseñaba en ningún momento de qué local hablaba—.
                              */}
                            <form
                              className="mt-4 grid gap-2 border-t border-slate-200 pt-3 md:grid-cols-3"
                              onSubmit={(event) => {
                                event.preventDefault();
                                const payload = camposEscritos(new FormData(event.currentTarget));
                                void run('Terminal', () =>
                                  partnerOnboardingService.registerPosTerminal(partnerId, branch.branchId, payload),
                                );
                                event.currentTarget.reset();
                              }}
                            >
                              <FormField label="Serial" name="terminalSerial" required data-testid={`campo-pos-serial-${branch.branchCode}`} />
                              <FormField label="Alias" name="terminalAlias" hint="Caja 1, Mostrador…" />
                              <div className="flex items-end">
                                <AtlasButton type="submit" disabled={busy} data-testid={`btn-registrar-pos-${branch.branchCode}`}>
                                  Registrar terminal aquí
                                </AtlasButton>
                              </div>
                            </form>
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </Panel>
              ),
            },
          ]}
        />
      ) : null}
    </div>
  );
}
