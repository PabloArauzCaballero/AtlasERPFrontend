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
import { SubmissionGaps } from '@/components/screens/PartnerDossierPanels';
import { merchantCategoryOptions } from '@/lib/catalogs';
import { useAsyncResource } from '@/hooks/useAsyncResource';
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
  /*
   * Las sucursales SÓLO se leen aquí: se dan de alta, se editan y se enlazan en «Sucursales».
   *
   * Esta pantalla llegó a tener su propio formulario de sucursales, y con él dos altas para el
   * mismo local: la del ERP —donde se sitúa cada venta y se asigna el personal— y la del
   * expediente —de donde cuelgan las cajas y su QR—. Nada garantizaba que hablaran del mismo
   * mostrador, y el comercio tenía que registrar su tienda dos veces para poder imprimir un
   * código. Hoy el enlace lo hace «Sucursales» al crear el local, y aquí sólo se resume.
   */
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
          ]}
        />
      ) : null}
    </div>
  );
}
