'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AtlasButton } from '@/components/atlas/AtlasButton';
import { FormField } from '@/components/atlas/FormField';
import { Icon } from '@/components/atlas/Icon';
import { InlineNotice } from '@/components/atlas/InlineNotice';
import { Panel } from '@/components/atlas/Panel';
import { StatusPill } from '@/components/atlas/StatusPill';
import { WorkspaceHeader } from '@/components/atlas/WorkspaceHeader';
import { PosList, QrList, SubmissionGaps } from '@/components/screens/PartnerDossierPanels';
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
        title="Expediente del negocio"
        description="Declara tu empresa, tus locales, con qué cobras y tus terminales. Al enviar, el caso pasa a revisión."
      />

      {feedback ? (
        <div data-testid="expediente-feedback">
          <InlineNotice tone={feedback.tone}>{feedback.text}</InlineNotice>
        </div>
      ) : null}

      {partnerId === '' ? (
        <Panel title="Abrir expediente" icon="storefront">
          <form className="grid gap-3 md:grid-cols-2" onSubmit={abrirExpediente}>
            <FormField label="Razón social" name="legalName" required data-testid="campo-legalName" />
            <FormField label="Nombre comercial" name="tradeName" />
            <FormField label="NIT" name="taxId" required hint="Sólo dígitos." data-testid="campo-taxId" />
            <FormField label="Matrícula de comercio" name="commercialRegistry" />
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

      {state ? (
        <>
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
            <ul className="mt-3 space-y-1 text-xs" data-testid="lista-sucursales">
              {branches.map((branch) => (
                <li key={branch.branchId}>
                  <strong>{branch.branchCode}</strong> · {branch.name} {branch.city ? `· ${branch.city}` : ''}
                </li>
              ))}
            </ul>
          </Panel>

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
        </>
      ) : null}
    </div>
  );
}
