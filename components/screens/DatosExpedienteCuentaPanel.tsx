'use client';

import { useMemo, useState } from 'react';
import { AtlasButton } from '@/components/atlas/AtlasButton';
import { InlineNotice } from '@/components/atlas/InlineNotice';
import { Panel } from '@/components/atlas/Panel';
import { StatusPill } from '@/components/atlas/StatusPill';
import { StructuredActionForm, type FormSectionDefinition } from '@/components/screens/StructuredActionForm';
import { seccionDatosDelExpediente } from '@/components/screens/altas/cuentaB2b';
import { b2bService } from '@/services/b2bService';
import { adjuntarArchivosDelExpediente, describirFaltantesDelExpediente } from '@/services/expedienteDeCuenta';
import type { JsonObject, ResourceRow } from '@/services/types';

interface DatosExpedienteCuentaPanelProps {
  account: ResourceRow;
  /** Se llama tras guardar: la pantalla recarga la cuenta. */
  onSaved?: (() => void | Promise<void>) | undefined;
}

/**
 * Los datos del expediente del comercio que no se capturaron al registrar la empresa.
 *
 * Existe porque la compuerta del onboarding los exige (Pablo, 2026-10-02: «el usuario te lo pasa
 * una vez y esto debe estar listo y cargado») y antes no había dónde ponerlos después del alta:
 * el operador recibía el 422 con la lista y no tenía más salida que volver a crear la cuenta.
 * Son los MISMOS campos del alta (`seccionDatosDelExpediente`): una sola definición, dos sitios.
 *
 * Con todo completo el panel sólo informa; con algo pendiente abre el formulario con lo que la
 * cuenta ya tiene puesto. Lo que ya está no se pisa: el PATCH sólo manda lo que llega.
 */
export function DatosExpedienteCuentaPanel({ account, onSaved }: DatosExpedienteCuentaPanelProps) {
  const faltan = useMemo(() => (Array.isArray(account.dossierMissing) ? account.dossierMissing.map(String) : []), [account.dossierMissing]);
  const [editando, setEditando] = useState(false);
  const seccion = useMemo<FormSectionDefinition>(() => conValoresActuales(seccionDatosDelExpediente, account), [account]);
  const completo = faltan.length === 0;

  async function guardar(payload: JsonObject): Promise<ResourceRow> {
    const { dossier, poderNotarial, qrBancario } = payload as JsonObject & { dossier?: JsonObject; poderNotarial?: unknown; qrBancario?: unknown };
    const accountId = String(account.id);
    let actualizada: ResourceRow = account;
    if (dossier && Object.keys(dossier).length) actualizada = await b2bService.setAccountDossier(accountId, dossier);
    await adjuntarArchivosDelExpediente(accountId, { poderNotarial, qrBancario });
    return actualizada;
  }

  return (
    <Panel
      title="Datos del expediente"
      icon="fact_check"
      description="Matrícula, representante legal con su poder, casa matriz y QR de cobro: lo que el expediente del comercio exige y se pide una sola vez. Al abrir el onboarding viaja completo a Atlas."
      action={completo ? <StatusPill tone="success">Completo</StatusPill> : <AtlasButton variant="secondary" icon={editando ? 'close' : 'edit'} onClick={() => setEditando((v) => !v)} data-testid="btn-completar-expediente">{editando ? 'Cerrar' : 'Completar lo que falta'}</AtlasButton>}
      data-testid="panel-datos-expediente"
    >
      {completo ? (
        <p className="text-xs text-slate-600">La cuenta tiene todo lo que el expediente exige. Si el comercio cambia de QR o de representante, lo corrige desde su portal.</p>
      ) : (
        <InlineNotice tone="warning" title="Falta para abrir el onboarding">
          {`Falta ${describirFaltantesDelExpediente(faltan)}. Sin eso el caso de onboarding no se abre y el expediente del comercio nacería incompleto.`}
        </InlineNotice>
      )}
      {editando ? (
        <div className="mt-4" data-testid="form-datos-expediente">
          <StructuredActionForm
            embedded
            moduleLabel="CRM"
            title="Datos del expediente"
            description="Completa lo que falte; lo que ya está se conserva."
            submitLabel="Guardar datos del expediente"
            submitIcon="save"
            sections={[seccion]}
            onSubmit={guardar}
            onDone={async () => {
              setEditando(false);
              await onSaved?.();
            }}
          />
        </div>
      ) : null}
    </Panel>
  );
}

/** La misma sección del alta, con lo que la cuenta ya tiene como valor inicial (no se pide en blanco). */
function conValoresActuales(seccion: FormSectionDefinition, account: ResourceRow): FormSectionDefinition {
  return {
    ...seccion,
    description: undefined,
    fields: seccion.fields.map((field) => {
      if (!field.name.startsWith('dossier.')) return field;
      const valor = account[field.name.slice('dossier.'.length)];
      return valor === null || valor === undefined || valor === '' ? field : { ...field, defaultValue: String(valor) };
    }),
  };
}
